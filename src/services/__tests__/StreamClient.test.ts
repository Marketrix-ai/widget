/**
 * Vitest suite for `StreamClient`'s retry affordance — the toast's Retry button, i.e. `canReconnect()`
 * gating and `reconnectNow()` redialing — over an `sdk` module mock whose `widgetStream` /
 * `widgetMessagePost` are `vi.fn()`s (`mockSdk`), so no SSE transport is involved.
 *
 * Contents: `emptyStream()` yields a stream that opens and immediately ends, so `consumeEvents` runs its
 * reconnect tail; `freshClient()` disconnects the shared instance before handing it back, because
 * `StreamClient` is a singleton and state leaks between tests otherwise; the `beforeEach` clears the mocks,
 * so every `widgetStream` call count asserted below is absolute rather than cumulative across the suite.
 *
 * The three cases pin:
 * - **`reconnectNow` after a failed dial redials at once, not after the backoff.** Failed and not
 *   registered means a backoff timer is pending, and only `registered` ever resets the counters — so at
 *   the cap `scheduleReconnect` gives up for good and Retry is the only way back; fake timers keep the
 *   pending timer from firing, proving the second `widgetStream` call came from `reconnectNow` itself.
 * - **`reconnectNow` redials a stream stuck mid-dial** (`widgetStream` returning a never-settling
 *   promise) — a state `canReconnect()` already offers Retry for, so it must abort and redial rather
 *   than no-op on a connection that will never resolve.
 * - **auth rejection is terminal**: `canReconnect()` is false after it, since retrying only re-earns the
 *   401. The surfaced error must read "credentials were rejected" — `chat/error` otherwise settles the
 *   message whose id is the request id, and no message is ever id `'auth'`, so before the explicit
 *   branch the widget went permanently silent with no toast and no trace, terser dropping console in the
 *   bundle.
 */

import type * as SdkModule from '../../sdk';
import { sdk, type WidgetEvent } from '../../sdk';
import { StreamClient } from '../StreamClient';

vi.mock('../../sdk', async importOriginal => {
  const actual = await importOriginal<typeof SdkModule>();
  return { ...actual, sdk: { widgetStream: vi.fn(), widgetMessagePost: vi.fn() } };
});

const mockSdk = vi.mocked(sdk);

function emptyStream(): AsyncIterable<WidgetEvent> {
  return {
    async *[Symbol.asyncIterator]() {},
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
