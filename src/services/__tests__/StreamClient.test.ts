/**
 * Tests for `StreamClient`'s registration lifecycle and the Retry affordance, over a mocked `sdk` module
 * so no real SSE transport is involved. Covers that a caller parked on registration is always settled
 * (disconnect, give-up, refused credential), the exponential-backoff reconnect schedule and its jitter
 * window, that a superseded connection's stale events never reach a later turn, and that an evicted tab re-mints its id.
 */

import { sdk, type WidgetEvent } from '../../sdk';
import { flushMicrotasks } from '../../test/fixtures';
import { advanceTimersByTimeAsync, mocked, mockSdkModule, restoreModuleAfterAll, waitFor } from '../../test/vi-compat';
import { streamClient, StreamGaveUpError } from '../StreamClient';

type StreamClient = typeof streamClient;

vi.mock('../../sdk', () => mockSdkModule({ widgetStream: vi.fn(), widgetMessagePost: vi.fn() }));
restoreModuleAfterAll('../../sdk', () => import('../../sdk/index.ts?real'));

const mockSdk = mocked(sdk);

interface StreamClientInternals {
  chatId: StreamClient['chatId'];
  status: StreamClient['status'];
  tornDown: StreamClient['tornDown'];
  credentialRejected: StreamClient['credentialRejected'];
  reconnectAttempts: StreamClient['reconnectAttempts'];
  scheduleReconnect: StreamClient['scheduleReconnect'];
  handleMessage: StreamClient['handleMessage'];
  isConnected: StreamClient['isConnected'];
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

async function awaitingRegistration(client: StreamClient, chatId: string): Promise<{ registration: Promise<void> }> {
  const connect = vi.spyOn(client, 'connect').mockResolvedValue();
  const registration = client.ready(chatId);
  connect.mockRestore();
  await flushMicrotasks();
  return { registration };
}

function freshClient(): StreamClient {
  streamClient.disconnect();
  streamClient.setCredentials({ marketrix_id: 'mtx_1', marketrix_key: 'key_1' });
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
    const { registration } = await awaitingRegistration(client, 'old-chat');

    client.disconnect();

    await expect(registration).rejects.toThrow('Stream disconnected before registration');

    const inner = internals(client);
    inner.chatId = 'new-chat';
    inner.tornDown = false;
    const { registration: remountRegistration } = await awaitingRegistration(client, 'new-chat');
    inner.handleMessage({ type: 'registered', chat_id: 'new-chat' });

    await expect(remountRegistration).resolves.toBeUndefined();
  });

  it('rejects a pending registration when reconnection gives up, rather than leaving it hanging', async () => {
    const { client, inner } = freshChatClient();

    const { registration } = await awaitingRegistration(client, 'chat-1');
    inner.reconnectAttempts = 10;
    inner.scheduleReconnect();

    await expect(registration).rejects.toBeInstanceOf(StreamGaveUpError);
  });

  it('rejects a pending registration when the credentials are refused', async () => {
    const { client, inner } = freshChatClient();

    const { registration } = await awaitingRegistration(client, 'chat-1');
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

    await expect(client.ready('chat-auth')).rejects.toThrow('credentials were rejected');
  });

  it('does not report a stream that has only reached open as connected', () => {
    const { client } = freshChatClient('open');

    expect(internals(client).isConnected()).toBe(false);
  });

  it('leaves an open-but-unregistered stream still pending, so a send cannot outrun registration', async () => {
    const { client, inner } = freshChatClient('open');

    let registered = false;
    const pending = (await awaitingRegistration(client, 'chat-1')).registration.then(() => {
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

describe('StreamClient.send', () => {
  it('rejects immediately with no active chat, rather than sending without one', async () => {
    const client = freshClient();
    await expect(client.send({ type: 'chat/stop' })).rejects.toThrow('No active chat');
    expect(mockSdk.widgetMessagePost).not.toHaveBeenCalled();
  });

  it('posts with the same chat id and tab id the stream connected with, so the api can key both to one tab', async () => {
    mockSdk.widgetMessagePost.mockResolvedValueOnce({ success: true });
    const client = freshClient();
    await client.connect('chat-1');

    await client.send({ type: 'chat/stop' });

    const streamCall = mockSdk.widgetStream.mock.calls[0]?.[0] as { tab_id: string };
    const sendCall = mockSdk.widgetMessagePost.mock.calls[0]?.[0] as { chat_id: string; tab_id: string };
    expect(sendCall.chat_id).toBe('chat-1');
    expect(sendCall.tab_id).toBe(streamCall.tab_id);
    client.disconnect();
  });

  it('rethrows the sdk rejection rather than swallowing it after logging', async () => {
    const client = freshClient();
    await client.connect('chat-1');
    mockSdk.widgetMessagePost.mockRejectedValueOnce(new Error('offline'));

    await expect(client.send({ type: 'chat/stop' })).rejects.toThrow('offline');
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

  it('redials under a fresh tab id when a page sharing its tab id evicts the registered stream', async () => {
    vi.useFakeTimers();
    const client = freshClient();
    const evicted = controlledStream();
    mockSdk.widgetStream.mockResolvedValueOnce(evicted.stream);
    await client.connect('chat-1');
    evicted.push({ type: 'registered', chat_id: 'chat-1' });
    await flushMicrotasks();

    const redial = controlledStream();
    mockSdk.widgetStream.mockResolvedValueOnce(redial.stream);
    evicted.end();
    await flushMicrotasks();
    await advanceTimersByTimeAsync(1000);

    const [first, second] = mockSdk.widgetStream.mock.calls.map(([input]) => input.tab_id);
    expect(mockSdk.widgetStream).toHaveBeenCalledTimes(2);
    expect(second).not.toBe(first);

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
