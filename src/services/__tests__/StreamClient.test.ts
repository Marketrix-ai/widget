/**
 * The whole `StreamClient` suite: registration lifecycle and the Retry affordance, over an `sdk` module mock whose
 * `widgetStream` / `widgetMessagePost` are `vi.fn()`s (`mockSdk`), so no SSE transport is involved. Both halves
 * drive the one singleton, which is why they share a file — split across two, each left the other's leaked
 * instance state behind. `freshClient()` disconnects the shared instance before handing it back for that reason;
 * `internals()` reaches the private fields a test has to stage, since there is no public way to park the client in
 * "open but never registered".
 *
 * Registration lifecycle pins that a caller parked on registration is always settled: disconnect rejects old
 * waiters without leaking into a remount, giving up reconnection or a refused credential rejects rather than
 * hanging, a refused credential outlives `connect`, and an open-but-unregistered stream is still pending — so a
 * send can never outrun registration.
 *
 * The retry cases pin that `reconnectNow` after a failed dial redials at once rather than after the backoff (only
 * `registered` ever resets the counters, so at the cap `scheduleReconnect` gives up for good and Retry is the only
 * way back — fake timers keep the pending timer from firing, proving the second `widgetStream` call came from
 * `reconnectNow` itself); that it also redials a stream stuck mid-dial rather than no-op on a connection that will
 * never resolve; and that auth rejection is terminal, with the surfaced error naming "credentials were rejected"
 * rather than going silent the way an unmatched `chat/error` would.
 */

import type * as SdkModule from '../../sdk';
import { sdk, type WidgetEvent } from '../../sdk';
import { flushMicrotasks } from '../../test/fixtures';
import { type StreamClient, streamClient, StreamGaveUpError } from '../StreamClient';

vi.mock('../../sdk', async importOriginal => {
  const actual = await importOriginal<typeof SdkModule>();
  return { ...actual, sdk: { widgetStream: vi.fn(), widgetMessagePost: vi.fn() } };
});

const mockSdk = vi.mocked(sdk);

interface StreamClientInternals {
  chatId: string;
  status: string;
  tornDown: boolean;
  credentialRejected: boolean;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  scheduleReconnect: () => void;
  handleMessage: (event: Record<string, unknown>) => void;
}

function internals(client: StreamClient): StreamClientInternals {
  return client as unknown as StreamClientInternals;
}

function emptyStream(): AsyncIterable<WidgetEvent> {
  return {
    async *[Symbol.asyncIterator]() {},
  };
}

function freshClient(): StreamClient {
  streamClient.disconnect();
  return streamClient;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSdk.widgetStream.mockResolvedValue(emptyStream());
});

afterEach(() => {
  streamClient.disconnect();
});

describe('StreamClient registration lifecycle', () => {
  it('rejects old registration waiters on disconnect without leaking into a remount', async () => {
    const client = freshClient();
    const registration = client.waitUntilRegistered();

    client.disconnect();

    await expect(registration).rejects.toThrow('Stream disconnected before registration');

    const inner = internals(client);
    inner.chatId = 'new-chat';
    inner.tornDown = false;
    const remountRegistration = client.waitUntilRegistered();
    inner.handleMessage({ type: 'registered', chat_id: 'new-chat', application_id: 2 });

    await expect(remountRegistration).resolves.toBeUndefined();
  });

  it('rejects a pending registration when reconnection gives up, rather than leaving it hanging', async () => {
    const client = freshClient();
    const inner = internals(client);
    inner.chatId = 'chat-1';
    inner.tornDown = false;

    const registration = client.waitUntilRegistered();
    inner.reconnectAttempts = inner.maxReconnectAttempts;
    inner.scheduleReconnect();

    await expect(registration).rejects.toBeInstanceOf(StreamGaveUpError);
  });

  it('rejects a pending registration when the credentials are refused', async () => {
    const client = freshClient();
    const inner = internals(client);
    inner.chatId = 'chat-1';
    inner.tornDown = false;

    const registration = client.waitUntilRegistered();
    inner.handleMessage({ type: 'chat/error', request_id: 'auth', error: 'unauthorized' });

    await expect(registration).rejects.toBeInstanceOf(StreamGaveUpError);
  });

  it('a rejected credential outlives connect, and a send cannot wait on a registration that will never come', async () => {
    const client = freshClient();
    const inner = internals(client);
    inner.chatId = 'chat-auth';
    inner.status = 'open';
    inner.tornDown = false;
    inner.credentialRejected = false;

    inner.handleMessage({ type: 'chat/error', request_id: 'auth', message: 'rejected' });
    expect(inner.credentialRejected).toBe(true);

    await client.connect('chat-auth');
    expect(inner.credentialRejected).toBe(true);
    expect(client.canReconnect()).toBe(false);

    await expect(client.waitUntilRegistered()).rejects.toThrow('credentials were rejected');
  });

  it('does not report a stream that has only reached open as connected', () => {
    const client = freshClient();
    const inner = internals(client);
    inner.chatId = 'chat-1';
    inner.status = 'open';

    expect(client.isConnected()).toBe(false);
  });

  it('leaves an open-but-unregistered stream still pending, so a send cannot outrun registration', async () => {
    const client = freshClient();
    const inner = internals(client);
    inner.chatId = 'chat-1';
    inner.status = 'open';
    inner.tornDown = false;

    let registered = false;
    const pending = client.waitUntilRegistered().then(() => {
      registered = true;
    });

    await flushMicrotasks();
    expect(registered).toBe(false);

    inner.handleMessage({ type: 'registered', chat_id: 'chat-1', application_id: 1 });
    await pending;
    expect(registered).toBe(true);
  });
});

describe('StreamClient retry affordance', () => {
  it('reconnectNow reopens the stream immediately, without waiting out the backoff', async () => {
    vi.useFakeTimers();
    const client = freshClient();
    mockSdk.widgetStream.mockRejectedValueOnce(new Error('network down'));
    await client.connect('chat-1');

    expect(mockSdk.widgetStream).toHaveBeenCalledTimes(1);
    expect(client.canReconnect()).toBe(true);

    mockSdk.widgetStream.mockResolvedValue(emptyStream());
    client.reconnectNow();
    expect(mockSdk.widgetStream).toHaveBeenCalledTimes(2);

    client.disconnect();
    vi.useRealTimers();
  });

  it('reconnectNow redials a stream stuck mid-dial, which canReconnect already offers Retry for', () => {
    const client = freshClient();
    mockSdk.widgetStream.mockReturnValue(new Promise(() => {}));
    void client.connect('chat-3');

    expect(mockSdk.widgetStream).toHaveBeenCalledTimes(1);
    expect(client.canReconnect()).toBe(true);

    client.reconnectNow();

    expect(mockSdk.widgetStream).toHaveBeenCalledTimes(2);
    client.disconnect();
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

    expect(errors[0]).toContain('credentials were rejected');
    expect(client.canReconnect()).toBe(false);
    client.removeCallbacks(callbacks);
    client.disconnect();
  });
});
