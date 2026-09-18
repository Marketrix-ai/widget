/**
 * The whole `StreamClient` suite: registration lifecycle and the Retry affordance, over an `sdk` module mock whose
 * `widgetStream` / `widgetMessagePost` are `vi.fn()`s (`mockSdk`), so no SSE transport is involved. Both halves
 * drive the one singleton, which is why they share a file — split across two, each left the other's leaked
 * instance state behind. `freshClient()` disconnects the shared instance before handing it back for that reason;
 * `internals()` reaches the private fields a test has to stage, since there is no public way to park the client in
 * "open but never registered" — `StreamClientInternals`' fields are each typed by indexed access into the real
 * `StreamClient` (`StreamClient['handleMessage']` etc.), not a hand-written duplicate, so a real signature or
 * `StreamStatus` union change is a compile error here instead of a silently stale mock; that typing is what
 * caught `chat/error`'s hand-built fixture once carrying a `message` field the real schema has never had (`error`
 * is the field), an invalid event `handleMessage` happened not to read on that branch but would have on any that did.
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
 * rather than going silent the way an unmatched `chat/error` would. An open-but-not-yet-registered stream
 * still reads `canReconnect() === true`, matching a visitor hitting Retry before the handshake finished
 * while the old dial's iterator is still live — abort doesn't synchronously stop an in-flight fetch's
 * already-buffered chunks.
 *
 * `asMockedStream`/`emptyStream` cast a plain async iterable to `MockedStream`: oRPC's real `widgetStream`
 * resolves to its own private-field `AsyncIteratorClass`, which no plain async generator can structurally
 * satisfy, and the cast stands in for it — sufficient here since `StreamClient` only ever iterates the result.
 *
 * The fault-injection block drives the real reconnect machinery instead of reading source with regex:
 * `controlledStream()` is a double whose `push`/`fail`/`end` control a paused async generator, standing
 * in for a dropped/resumed SSE connection. It pins that a connection superseded by `reconnectNow` (the
 * old iterator still draining when the new one opens) never delivers its stale, already-superseded
 * events to `onMessage` — the guard a visitor relies on not to see an old turn replayed after a
 * reconnect — that each of the 10 retries actually fires within the documented
 * 1000ms-doubling-to-30000ms-cap schedule's own equal-jitter window ([base/2, base]), not just source
 * constants, and that give-up (either the attempt cap or the
 * `auth` `chat/error`) schedules no further dial no matter how long fake time advances.
 */

import { sdk, type WidgetEvent } from '../../sdk';
import { flushMicrotasks } from '../../test/fixtures';
import { advanceTimersByTimeAsync, mocked, mockSdkModule, restoreModuleAfterAll, waitFor } from '../../test/vi-compat';
import { type StreamClient, streamClient, StreamGaveUpError } from '../StreamClient';

vi.mock('../../sdk', () => mockSdkModule({ widgetStream: vi.fn(), widgetMessagePost: vi.fn() }));
restoreModuleAfterAll('../../sdk', () => import('../../sdk/index.ts?real'));

const mockSdk = mocked(sdk);

interface StreamClientInternals {
  chatId: StreamClient['chatId'];
  status: StreamClient['status'];
  tornDown: StreamClient['tornDown'];
  credentialRejected: StreamClient['credentialRejected'];
  reconnectAttempts: StreamClient['reconnectAttempts'];
  maxReconnectAttempts: StreamClient['maxReconnectAttempts'];
  scheduleReconnect: StreamClient['scheduleReconnect'];
  handleMessage: StreamClient['handleMessage'];
}

function internals(client: StreamClient): StreamClientInternals {
  return client as unknown as StreamClientInternals;
}

type MockedStream = Awaited<ReturnType<typeof sdk.widgetStream>>;

function asMockedStream(iterable: AsyncIterable<WidgetEvent>): MockedStream {
  return iterable as unknown as MockedStream;
}

function emptyStream(): MockedStream {
  return asMockedStream({
    async *[Symbol.asyncIterator]() {},
  });
}

function freshClient(): StreamClient {
  streamClient.disconnect();
  return streamClient;
}

function freshChatClient(status?: StreamClient['status']): { client: StreamClient; inner: StreamClientInternals } {
  const client = freshClient();
  const inner = internals(client);
  inner.chatId = 'chat-1';
  inner.tornDown = false;
  if (status !== undefined) inner.status = status;
  return { client, inner };
}

interface ControlledStream {
  stream: MockedStream;
  push: (event: WidgetEvent) => void;
  fail: (error: Error) => void;
  end: () => void;
}

function controlledStream(): ControlledStream {
  const pending: { resolve: (v: IteratorResult<WidgetEvent>) => void; reject: (e: unknown) => void }[] = [];
  const queue: WidgetEvent[] = [];
  let closed: 'ended' | Error | null = null;

  const settleNext = () => {
    if (pending.length === 0) return;
    if (queue.length > 0) pending.shift()!.resolve({ value: queue.shift()!, done: false });
    else if (closed === 'ended') pending.shift()!.resolve({ value: undefined, done: true });
    else if (closed) pending.shift()!.reject(closed);
  };

  const stream = asMockedStream({
    [Symbol.asyncIterator]() {
      return {
        next: () =>
          new Promise<IteratorResult<WidgetEvent>>((resolve, reject) => {
            pending.push({ resolve, reject });
            settleNext();
          }),
      };
    },
  });

  return {
    stream,
    push: event => {
      queue.push(event);
      settleNext();
    },
    fail: error => {
      closed = error;
      settleNext();
    },
    end: () => {
      closed = 'ended';
      settleNext();
    },
  };
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
    inner.handleMessage({ type: 'registered', chat_id: 'new-chat' });

    await expect(remountRegistration).resolves.toBeUndefined();
  });

  it('rejects a pending registration when reconnection gives up, rather than leaving it hanging', async () => {
    const { client, inner } = freshChatClient();

    const registration = client.waitUntilRegistered();
    inner.reconnectAttempts = inner.maxReconnectAttempts;
    inner.scheduleReconnect();

    await expect(registration).rejects.toBeInstanceOf(StreamGaveUpError);
  });

  it('rejects a pending registration when the credentials are refused', async () => {
    const { client, inner } = freshChatClient();

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

    inner.handleMessage({ type: 'chat/error', request_id: 'auth', error: 'rejected' });
    expect(inner.credentialRejected).toBe(true);

    await client.connect('chat-auth');
    expect(inner.credentialRejected).toBe(true);
    expect(client.canReconnect()).toBe(false);

    await expect(client.waitUntilRegistered()).rejects.toThrow('credentials were rejected');
  });

  it('does not report a stream that has only reached open as connected', () => {
    const { client } = freshChatClient('open');

    expect(client.isConnected()).toBe(false);
  });

  it('leaves an open-but-unregistered stream still pending, so a send cannot outrun registration', async () => {
    const { client, inner } = freshChatClient('open');

    let registered = false;
    const pending = client.waitUntilRegistered().then(() => {
      registered = true;
    });

    await flushMicrotasks();
    expect(registered).toBe(false);

    inner.handleMessage({ type: 'registered', chat_id: 'chat-1' });
    await pending;
    expect(registered).toBe(true);
  });
});

describe('StreamClient guard conditions', () => {
  it('reconnectNow is a no-op once already registered, rather than redialing regardless of canReconnect', () => {
    const { client } = freshChatClient('registered');
    client.reconnectNow();
    expect(mockSdk.widgetStream).not.toHaveBeenCalled();
  });

  it('connect no-ops for a chat id already connecting, open or registered, rather than redialing it', async () => {
    const { client } = freshChatClient('open');
    await client.connect('chat-1');
    expect(mockSdk.widgetStream).not.toHaveBeenCalled();
    client.disconnect();
  });

  it('a chat/error that is not the auth one leaves credentials untouched and reconnection still possible', () => {
    const { client, inner } = freshChatClient('open');
    const errors: Error[] = [];
    client.addCallbacks({ onError: e => errors.push(e) });

    inner.handleMessage({ type: 'chat/error', request_id: 'req-123', error: 'boom' });

    expect(inner.credentialRejected).toBe(false);
    expect(errors).toHaveLength(0);
    client.disconnect();
  });

  it('does not resume a scheduled reconnect once torn down before the timer fires', async () => {
    // Set tornDown directly (not via disconnect(), which also clears chatId) so the pending timer's
    // guard is the only thing standing between it and a stray dial on an abandoned client.
    vi.useFakeTimers();
    const client = freshClient();
    mockSdk.widgetStream.mockRejectedValueOnce(new Error('down'));
    await client.connect('chat-1');
    expect(mockSdk.widgetStream).toHaveBeenCalledTimes(1);

    internals(client).tornDown = true;
    mockSdk.widgetStream.mockResolvedValue(emptyStream());
    await advanceTimersByTimeAsync(1000);

    expect(mockSdk.widgetStream).toHaveBeenCalledTimes(1);
    internals(client).tornDown = false;
    client.disconnect();
    vi.useRealTimers();
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
    mockSdk.widgetStream.mockResolvedValue(
      asMockedStream({
        async *[Symbol.asyncIterator]() {
          yield { type: 'chat/error', request_id: 'auth', error: 'Authentication failed' } as WidgetEvent;
        },
      }),
    );

    await client.connect('chat-2');
    await waitFor(() => expect(errors.length).toBe(1));

    expect(errors[0]).toContain('credentials were rejected');
    expect(client.canReconnect()).toBe(false);
    client.removeCallbacks(callbacks);
    client.disconnect();
  });
});

describe('StreamClient fault injection', () => {
  it('drops events from a connection reconnectNow already superseded, never duplicating a rendered turn', async () => {
    const client = freshClient();
    const first = controlledStream();
    mockSdk.widgetStream.mockResolvedValueOnce(first.stream);
    await client.connect('chat-1');
    await flushMicrotasks();

    const received: WidgetEvent[] = [];
    const callbacks = { onMessage: (e: WidgetEvent) => received.push(e) };
    client.addCallbacks(callbacks);

    const second = controlledStream();
    mockSdk.widgetStream.mockResolvedValueOnce(second.stream);
    expect(client.canReconnect()).toBe(true);
    client.reconnectNow();
    await flushMicrotasks();

    first.push({ type: 'chat/response', request_id: 'req-1', text: 'stale turn' });
    await flushMicrotasks();
    expect(received).toHaveLength(0);

    second.push({ type: 'registered', chat_id: 'chat-1' });
    await waitFor(() => expect(received).toHaveLength(1));

    expect(received.some(e => e.type === 'chat/response')).toBe(false);
    expect(received[0]).toEqual({ type: 'registered', chat_id: 'chat-1' });

    client.removeCallbacks(callbacks);
    client.disconnect();
  });

  it('redials within the documented 1000ms-doubling-to-30000ms-cap schedule (equal jitter), giving up after the 10th', async () => {
    vi.useFakeTimers();
    const client = freshClient();
    const baseDelays = [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000, 30000, 30000];

    mockSdk.widgetStream.mockRejectedValue(new Error('down'));
    await client.connect('chat-1');
    expect(mockSdk.widgetStream).toHaveBeenCalledTimes(1);

    const errors: Error[] = [];
    client.addCallbacks({ onError: e => errors.push(e) });

    for (const [i, base] of baseDelays.entries()) {
      // Equal jitter halves the base delay then adds a uniform random half: the dial can fire any time in
      // [base/2, base], never earlier (a thundering-herd guard that still respects the schedule's own cap)
      // and never later (the schedule's own upper bound still holds).
      await advanceTimersByTimeAsync(base / 2 - 1);
      expect(mockSdk.widgetStream).toHaveBeenCalledTimes(i + 1);
      await advanceTimersByTimeAsync(base / 2 + 1);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(mockSdk.widgetStream).toHaveBeenCalledTimes(i + 2);
    }

    await advanceTimersByTimeAsync(30000);
    expect(mockSdk.widgetStream).toHaveBeenCalledTimes(baseDelays.length + 1);
    expect(errors.some(e => e instanceof StreamGaveUpError)).toBe(true);

    await advanceTimersByTimeAsync(120000);
    expect(mockSdk.widgetStream).toHaveBeenCalledTimes(baseDelays.length + 1);

    client.disconnect();
    vi.useRealTimers();
  });

  it('an auth give-up is terminal — no reconnect follows however long time advances', async () => {
    vi.useFakeTimers();
    const client = freshClient();
    const stream = controlledStream();
    mockSdk.widgetStream.mockResolvedValueOnce(stream.stream);
    await client.connect('chat-1');
    expect(mockSdk.widgetStream).toHaveBeenCalledTimes(1);

    stream.push({ type: 'chat/error', request_id: 'auth', error: 'unauthorized' });
    await Promise.resolve();

    expect(client.canReconnect()).toBe(false);
    await advanceTimersByTimeAsync(10 * 30000);
    expect(mockSdk.widgetStream).toHaveBeenCalledTimes(1);

    client.disconnect();
    vi.useRealTimers();
  });
});
