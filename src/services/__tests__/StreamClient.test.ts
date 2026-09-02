import type * as SdkModule from '../../sdk';
import { sdk, type WidgetEvent } from '../../sdk';
import { StreamClient } from '../StreamClient';

vi.mock('../../sdk', async importOriginal => {
  const actual = await importOriginal<typeof SdkModule>();
  return { ...actual, sdk: { widgetStream: vi.fn(), widgetMessagePost: vi.fn() } };
});

const mockSdk = vi.mocked(sdk);

/** A stream that opens and immediately ends, so `consumeEvents` runs its reconnect tail. */
function emptyStream(): AsyncIterable<WidgetEvent> {
  return {
    async *[Symbol.asyncIterator]() {
      /* no events */
    },
  };
}

function freshClient(): StreamClient {
  const client = StreamClient.getInstance();
  client.disconnect();
  return client;
}

describe('StreamClient retry affordance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSdk.widgetStream.mockResolvedValue(emptyStream());
  });

  it('reconnectNow reopens the stream immediately, without waiting out the backoff', async () => {
    vi.useFakeTimers();
    const client = freshClient();
    mockSdk.widgetStream.mockRejectedValueOnce(new Error('network down'));
    await client.connect('chat-1');

    // Failed, not registered: a backoff timer is pending and only `registered` ever resets the counters,
    // so at the cap `scheduleReconnect` gives up for good. The toast's Retry must be able to undo that.
    expect(mockSdk.widgetStream).toHaveBeenCalledTimes(1);
    expect(client.canReconnect()).toBe(true);

    mockSdk.widgetStream.mockResolvedValue(emptyStream());
    client.reconnectNow();
    expect(mockSdk.widgetStream).toHaveBeenCalledTimes(2);

    client.disconnect();
    vi.useRealTimers();
  });

  it('canReconnect is false once auth is rejected — retrying only re-earns the 401', async () => {
    const client = freshClient();
    const errors: string[] = [];
    const callbacks = { onError: (e: Error) => errors.push(e.message) };
    client.addCallbacks(callbacks);
    mockSdk.widgetStream.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        yield { type: 'chat/error', request_id: 'auth', error: 'Authentication failed' } as WidgetEvent;
      },
    });

    await client.connect('chat-2');
    await vi.waitFor(() => expect(errors.length).toBe(1));

    // `chat/error` settles the message whose id is the request id, and no message is ever id 'auth' —
    // so without this the widget went permanently silent, console being dropped by terser in the bundle.
    expect(errors[0]).toContain('credentials were rejected');
    expect(client.canReconnect()).toBe(false);
    client.removeCallbacks(callbacks);
    client.disconnect();
  });
});
