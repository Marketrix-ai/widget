/**
 * Tests for `StreamClient`'s one published state, over a mocked `sdk` module so no real SSE transport is involved.
 * Covers that a caller parked on registration is always settled (disconnect, give-up, refused credential), the
 * exponential-backoff reconnect schedule and its jitter window, the visitor-facing notice each state derives, that a
 * superseded connection's stale events never reach a later turn, that a throwing subscriber leaves the stream up,
 * and that an evicted tab re-mints its id.
 */

import { AsyncIteratorClass } from '@orpc/client';

import type { WidgetClient, WidgetEvent } from '../../sdk';
import { asStreamClientInternals, flushMicrotasks } from '../../test/fixtures';
import { advanceTimersByTimeAsync, mockSdk, waitFor } from '../../test/vi-compat';
import { streamClient, streamNotice } from '../StreamClient';

type StreamClient = typeof streamClient;

const widgetStream = vi.fn<WidgetClient['widgetStream']>();
const widgetMessagePost = vi.fn<WidgetClient['widgetMessagePost']>();
mockSdk({ widgetStream, widgetMessagePost });

type MockedStream = Awaited<ReturnType<WidgetClient['widgetStream']>>;

function asMockedStream(iterable: AsyncIterable<WidgetEvent>): MockedStream {
  const iterator = iterable[Symbol.asyncIterator]();
  return new AsyncIteratorClass(
    () => iterator.next(),
    async () => {
      await iterator.return?.();
    },
  );
}

function emptyStream(): MockedStream {
  return asMockedStream({
    async *[Symbol.asyncIterator]() {},
  });
}

function freshClient(): StreamClient {
  streamClient.disconnect();
  streamClient.setCredentials({ marketrix_id: 'mtx_1', marketrix_key: 'key_1' });
  return streamClient;
}

async function registeredClient(chatId = 'chat-1'): Promise<{ client: StreamClient; stream: ControlledStream }> {
  const client = freshClient();
  const stream = controlledStream();
  widgetStream.mockResolvedValueOnce(stream.stream);
  await client.connect(chatId);
  stream.push({ type: 'registered', chat_id: chatId });
  await waitFor(() => expect(client.getState().phase).toBe('registered'));
  return { client, stream };
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
    const next = pending[0];
    if (!next) return;
    const value = queue.shift();
    if (value) next.resolve({ value, done: false });
    else if (closed === 'ended') next.resolve({ value: undefined, done: true });
    else if (closed) next.reject(closed);
    else return;
    pending.shift();
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
  widgetStream.mockResolvedValue(emptyStream());
});

afterEach(() => {
  streamClient.disconnect();
  vi.useRealTimers();
});

describe('StreamClient registration lifecycle', () => {
  it('rejects a registration waiter on disconnect without leaking into a remount', async () => {
    const client = freshClient();
    widgetStream.mockReturnValueOnce(new Promise(() => {}));
    const registration = client.ready('old-chat');
    await flushMicrotasks();

    client.disconnect();
    await expect(registration).rejects.toThrow('Stream disconnected before registration');

    const stream = controlledStream();
    widgetStream.mockResolvedValueOnce(stream.stream);
    const remount = client.ready('new-chat');
    await flushMicrotasks();
    stream.push({ type: 'registered', chat_id: 'new-chat' });
    await expect(remount).resolves.toBeUndefined();
  });

  it('rejects a pending registration when reconnection gives up, rather than leaving it hanging', async () => {
    const client = freshClient();
    widgetStream.mockReturnValueOnce(new Promise(() => {}));
    const registration = client.ready('chat-1');
    await flushMicrotasks();

    asStreamClientInternals().backoff('chat-1', 10);

    await expect(registration).rejects.toThrow('Could not reconnect to the assistant');
  });

  it('rejects a pending registration when the credentials are refused', async () => {
    const client = freshClient();
    const stream = controlledStream();
    widgetStream.mockResolvedValueOnce(stream.stream);
    const registration = client.ready('chat-1');
    await flushMicrotasks();

    stream.push({ type: 'chat/error', request_id: 'auth', error: 'unauthorized' });

    await expect(registration).rejects.toThrow('credentials were rejected');
  });

  it('a rejected credential outlives connect, and a send cannot wait on a registration that will never come', async () => {
    const client = freshClient();
    const stream = controlledStream();
    widgetStream.mockResolvedValueOnce(stream.stream);
    await client.connect('chat-auth');
    stream.push({ type: 'chat/error', request_id: 'auth', error: 'rejected' });
    await waitFor(() =>
      expect(client.getState()).toEqual({ phase: 'gaveUp', chatId: 'chat-auth', reason: 'credentials' }),
    );

    await client.connect('chat-other');
    expect(widgetStream).toHaveBeenCalledTimes(1);
    await expect(client.ready('chat-auth')).rejects.toThrow('credentials were rejected');
  });

  it('leaves an open-but-unregistered stream pending, so a send cannot outrun registration', async () => {
    const client = freshClient();
    const stream = controlledStream();
    widgetStream.mockResolvedValueOnce(stream.stream);
    let registered = false;
    const pending = client.ready('chat-1').then(() => {
      registered = true;
    });

    await flushMicrotasks();
    expect(client.getState().phase).toBe('open');
    expect(registered).toBe(false);

    stream.push({ type: 'registered', chat_id: 'chat-1' });
    await pending;
    expect(registered).toBe(true);
  });

  it('publishes every phase it passes through to subscribers', async () => {
    const client = freshClient();
    const phases: string[] = [];
    const unsubscribe = client.subscribe(state => phases.push(state.phase));
    const stream = controlledStream();
    widgetStream.mockResolvedValueOnce(stream.stream);

    await client.connect('chat-1');
    stream.push({ type: 'registered', chat_id: 'chat-1' });
    await waitFor(() => expect(phases).toEqual(['connecting', 'open', 'registered']));

    client.disconnect();
    expect(phases.at(-1)).toBe('idle');
    unsubscribe();
  });
});

describe('StreamClient notice', () => {
  it.each([
    [{ phase: 'idle' }, undefined],
    [{ phase: 'connecting', chatId: 'c', gen: 1, attempt: 0 }, undefined],
    [{ phase: 'registered', chatId: 'c', gen: 1 }, undefined],
    [{ phase: 'backoff', chatId: 'c', attempt: 1 }, true],
    [{ phase: 'connecting', chatId: 'c', gen: 2, attempt: 1 }, true],
    [{ phase: 'gaveUp', chatId: 'c', reason: 'exhausted' }, true],
    [{ phase: 'gaveUp', chatId: 'c', reason: 'credentials' }, false],
  ] as const)('derives the banner for %o', (state, canRetry) => {
    expect(streamNotice(state)?.canRetry).toBe(canRetry);
  });
});

describe('StreamClient guard conditions', () => {
  it('reconnectNow is a no-op once already registered', async () => {
    const { client } = await registeredClient();
    client.reconnectNow();
    expect(widgetStream).toHaveBeenCalledTimes(1);
  });

  it('connect no-ops for a chat id already connecting, open or registered, rather than redialing it', async () => {
    const { client } = await registeredClient();
    await client.connect('chat-1');
    expect(widgetStream).toHaveBeenCalledTimes(1);
  });

  it('a chat/error that is not the auth one leaves the stream registered', async () => {
    const { client, stream } = await registeredClient();

    stream.push({ type: 'chat/error', request_id: 'req-123', error: 'boom' });
    await flushMicrotasks();

    expect(client.getState().phase).toBe('registered');
  });

  it('does not resume a scheduled reconnect once torn down before the timer fires', async () => {
    vi.useFakeTimers();
    const client = freshClient();
    widgetStream.mockRejectedValueOnce(new Error('down'));
    await client.connect('chat-1');
    expect(client.getState()).toEqual({ phase: 'backoff', chatId: 'chat-1', attempt: 1 });

    client.disconnect();
    await advanceTimersByTimeAsync(1000);

    expect(widgetStream).toHaveBeenCalledTimes(1);
  });
});

describe('StreamClient retry affordance', () => {
  it('reconnectNow reopens the stream immediately, without waiting out the backoff', async () => {
    vi.useFakeTimers();
    const client = freshClient();
    widgetStream.mockRejectedValueOnce(new Error('network down'));
    await client.connect('chat-1');
    expect(streamNotice(client.getState())?.canRetry).toBe(true);

    client.reconnectNow();
    expect(widgetStream).toHaveBeenCalledTimes(2);
  });

  it('reconnectNow redials a stream stuck mid-dial', () => {
    const client = freshClient();
    widgetStream.mockReturnValue(new Promise(() => {}));
    void client.connect('chat-3');

    client.reconnectNow();

    expect(widgetStream).toHaveBeenCalledTimes(2);
  });

  it('offers no Retry once auth is rejected — retrying only re-earns the 401', async () => {
    const client = freshClient();
    widgetStream.mockResolvedValue(
      asMockedStream({
        async *[Symbol.asyncIterator]() {
          yield { type: 'chat/error', request_id: 'auth', error: 'Authentication failed' };
        },
      }),
    );

    await client.connect('chat-2');
    await waitFor(() => expect(client.getState().phase).toBe('gaveUp'));

    expect(streamNotice(client.getState())).toEqual({
      message: 'Chat is unavailable — the widget credentials were rejected.',
      canRetry: false,
    });
    client.reconnectNow();
    expect(widgetStream).toHaveBeenCalledTimes(1);
  });
});

describe('StreamClient.send', () => {
  it('rejects immediately with no active chat, rather than sending without one', async () => {
    const client = freshClient();
    await expect(client.send({ type: 'chat/stop' })).rejects.toThrow('No active chat');
    expect(widgetMessagePost).not.toHaveBeenCalled();
  });

  it('posts with the same chat id and tab id the stream connected with, so the api can key both to one tab', async () => {
    widgetMessagePost.mockResolvedValueOnce({ success: true });
    const client = freshClient();
    await client.connect('chat-1');

    await client.send({ type: 'chat/stop' });

    const streamCall = widgetStream.mock.calls[0]?.[0];
    const sendCall = widgetMessagePost.mock.calls[0]?.[0];
    expect(sendCall?.chat_id).toBe('chat-1');
    expect(sendCall?.tab_id).toBe(streamCall?.tab_id);
  });

  it('rethrows the sdk rejection rather than swallowing it after logging', async () => {
    const client = freshClient();
    await client.connect('chat-1');
    widgetMessagePost.mockRejectedValueOnce(new Error('offline'));

    await expect(client.send({ type: 'chat/stop' })).rejects.toThrow('offline');
  });
});

describe('StreamClient fault injection', () => {
  it('drops events from a connection reconnectNow already superseded, never duplicating a rendered turn', async () => {
    const client = freshClient();
    const first = controlledStream();
    widgetStream.mockResolvedValueOnce(first.stream);
    await client.connect('chat-1');
    await flushMicrotasks();

    const received: WidgetEvent[] = [];
    const off = client.onEvent(e => received.push(e));

    const second = controlledStream();
    widgetStream.mockResolvedValueOnce(second.stream);
    client.reconnectNow();
    await flushMicrotasks();

    first.push({ type: 'chat/response', request_id: 'req-1', text: 'stale turn' });
    await flushMicrotasks();
    expect(received).toHaveLength(0);

    second.push({ type: 'registered', chat_id: 'chat-1' });
    await waitFor(() => expect(received).toHaveLength(1));

    expect(received[0]).toEqual({ type: 'registered', chat_id: 'chat-1' });
    off();
  });

  it('redials within the documented 1000ms-doubling-to-30000ms-cap schedule (equal jitter), giving up after the 10th', async () => {
    vi.useFakeTimers();
    const client = freshClient();
    const baseDelays = [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000, 30000, 30000];

    widgetStream.mockRejectedValue(new Error('down'));
    await client.connect('chat-1');
    expect(widgetStream).toHaveBeenCalledTimes(1);

    for (const [i, base] of baseDelays.entries()) {
      expect(client.getState()).toEqual({ phase: 'backoff', chatId: 'chat-1', attempt: i + 1 });
      await advanceTimersByTimeAsync(base / 2 - 1);
      expect(widgetStream).toHaveBeenCalledTimes(i + 1);
      await advanceTimersByTimeAsync(base / 2 + 1);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(widgetStream).toHaveBeenCalledTimes(i + 2);
    }

    await advanceTimersByTimeAsync(30000);
    expect(widgetStream).toHaveBeenCalledTimes(baseDelays.length + 1);
    expect(client.getState()).toEqual({ phase: 'gaveUp', chatId: 'chat-1', reason: 'exhausted' });

    await advanceTimersByTimeAsync(120000);
    expect(widgetStream).toHaveBeenCalledTimes(baseDelays.length + 1);
  });

  it('starts the backoff of a dropped registered stream from the first attempt', async () => {
    vi.useFakeTimers();
    const { client, stream } = await registeredClient();

    stream.fail(new Error('dropped'));
    await waitFor(() => expect(client.getState()).toEqual({ phase: 'backoff', chatId: 'chat-1', attempt: 1 }));
  });

  it('redials under a fresh tab id when a page sharing its tab id evicts the registered stream', async () => {
    vi.useFakeTimers();
    const { client, stream } = await registeredClient();

    const redial = controlledStream();
    widgetStream.mockResolvedValueOnce(redial.stream);
    stream.end();
    await waitFor(() => expect(widgetStream).toHaveBeenCalledTimes(2), 2000);

    const [first, second] = widgetStream.mock.calls.map(([input]) => input.tab_id);
    expect(second).not.toBe(first);
    expect(client.getState().phase).toBe('open');
  });

  it('keeps the stream when a subscriber throws, rather than redialing as if the transport failed', async () => {
    const client = freshClient();
    const stream = controlledStream();
    widgetStream.mockResolvedValueOnce(stream.stream);
    await client.connect('chat-1');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const received: WidgetEvent[] = [];
    const offThrowing = client.onEvent(() => {
      throw new Error('subscriber bug');
    });
    const offListening = client.onEvent(e => received.push(e));

    stream.push({ type: 'registered', chat_id: 'chat-1' });
    stream.push({ type: 'chat/response', request_id: 'req-1', text: 'still here' });
    await waitFor(() => expect(received).toHaveLength(2));

    expect(client.getState().phase).toBe('registered');
    expect(widgetStream).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(2);

    consoleError.mockRestore();
    offThrowing();
    offListening();
  });

  it('an auth give-up is terminal — no reconnect follows however long time advances', async () => {
    vi.useFakeTimers();
    const client = freshClient();
    const stream = controlledStream();
    widgetStream.mockResolvedValueOnce(stream.stream);
    await client.connect('chat-1');

    stream.push({ type: 'chat/error', request_id: 'auth', error: 'unauthorized' });

    await waitFor(() => expect(client.getState().phase).toBe('gaveUp'));
    await advanceTimersByTimeAsync(10 * 30000);
    expect(widgetStream).toHaveBeenCalledTimes(1);
  });
});
