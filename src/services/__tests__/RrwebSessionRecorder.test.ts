/**
 * Tests for `RrwebSessionRecorder`: a rejected flush caps the buffer without dropping the Meta/
 * FullSnapshot baseline, retries keep going even with no new events on a doubling delay that pauses while the
 * stream has given up, start/stop respect an in-flight metadata post and the stream's registration, and a
 * cleared chat moves the recording to its new thread.
 */
import { record } from '@rrweb/record';
import { EventType, type eventWithTime } from '@rrweb/types';
import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { sdk, type WidgetEvent } from '../../sdk';
import type { RrwebEvent } from '../../sdk/contracts/rrweb';
import { flushMicrotasks } from '../../test/fixtures';
import { advanceTimersByTimeAsync, mocked, mockSdkModule, restoreModuleAfterAll } from '../../test/vi-compat';
import { RrwebSessionRecorder } from '../RrwebSessionRecorder';
import { streamClient, StreamGaveUpError } from '../StreamClient';

vi.mock('@rrweb/record', () => ({ record: vi.fn(() => vi.fn()) }));
vi.mock('../../sdk', () => mockSdkModule({ widgetMessagePost: vi.fn() }));
restoreModuleAfterAll('../../sdk', () => import('../../sdk/index.ts?real'));

const mockSdk = mocked(sdk);

beforeEach(() => {
  vi.spyOn(streamClient, 'ready').mockResolvedValue();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

type Emit = (event: Pick<eventWithTime, 'type' | 'timestamp'> & { data: unknown }, isCheckout?: boolean) => void;

const metaEvent = (timestamp: number): Extract<RrwebEvent, { type: 4 }> => ({
  type: EventType.Meta,
  data: { href: 'https://example.com', width: 1280, height: 720 },
  timestamp,
});
const fullSnapshotEvent = (timestamp: number): Extract<RrwebEvent, { type: 2 }> => ({
  type: EventType.FullSnapshot,
  data: { node: { type: 0, id: 1, childNodes: [] }, initialOffset: { top: 0, left: 0 } },
  timestamp,
});
const incrementalEvent = (timestamp: number): Extract<RrwebEvent, { type: 3 }> => ({
  type: EventType.IncrementalSnapshot,
  data: { source: 4, width: 1280, height: 720 },
  timestamp,
});

const startRecorder = async (): Promise<{ recorder: RrwebSessionRecorder; emit: Emit }> => {
  mockSdk.widgetMessagePost.mockResolvedValueOnce({ success: true });
  const recorder = new RrwebSessionRecorder('chat-1');
  await recorder.start();
  const call = mocked(record).mock.calls[0];
  const options = call?.[0];
  if (!options) throw new Error('expected @rrweb/record to have been called');
  return { recorder, emit: options.emit as unknown as Emit };
};

describe('rrweb event validation', () => {
  it('rejects an event outside the generated wire schema before buffering it', async () => {
    const { emit } = await startRecorder();

    expect(() => emit({ type: EventType.DomContentLoaded, data: { extra: true }, timestamp: 0 })).toThrow();
    expect(mockSdk.widgetMessagePost).toHaveBeenCalledTimes(1);
  });
});

describe('a flush the api rejects', () => {
  const startWithARejectedFlush = async () => {
    vi.useFakeTimers();
    const { emit } = await startRecorder();
    mockSdk.widgetMessagePost.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ success: true });
    return emit;
  };

  it('caps the buffer without discarding the Meta and FullSnapshot every later event is replayed against', async () => {
    const emit = await startWithARejectedFlush();

    emit(metaEvent(0));
    emit(fullSnapshotEvent(1));
    for (let i = 2; i < 20_005; i++) emit(incrementalEvent(i));
    await advanceTimersByTimeAsync(500);

    emit(incrementalEvent(99_999));
    await advanceTimersByTimeAsync(500);

    const posted = mockSdk.widgetMessagePost.mock.lastCall?.[0].command as {
      events: Array<{ type: number; timestamp: number }>;
    };
    expect(posted.events).toHaveLength(20_000);
    expect(posted.events.slice(0, 2).map(event => event.type)).toEqual([EventType.Meta, EventType.FullSnapshot]);
    expect(posted.events[posted.events.length - 1]?.timestamp).toBe(19_999);
    vi.useRealTimers();
  });

  it('retries on its own timer with no new events to piggyback on, and drops nothing', async () => {
    const emit = await startWithARejectedFlush();

    emit(metaEvent(0));
    await advanceTimersByTimeAsync(500);
    expect(mockSdk.widgetMessagePost).toHaveBeenCalledTimes(2);

    await advanceTimersByTimeAsync(500);

    const posted = mockSdk.widgetMessagePost.mock.lastCall?.[0].command as {
      events: RrwebEvent[];
    };
    expect(mockSdk.widgetMessagePost).toHaveBeenCalledTimes(3);
    expect(posted.events).toEqual([metaEvent(0)]);
    vi.useRealTimers();
  });
});

describe('a flush that keeps failing', () => {
  const internals = (client: typeof streamClient) =>
    client as unknown as { handleMessage: (event: WidgetEvent) => void; giveUp: (message: string) => void };

  it('backs off on a doubling delay instead of polling every 500ms', async () => {
    vi.useFakeTimers();
    const { recorder, emit } = await startRecorder();
    mockSdk.widgetMessagePost.mockRejectedValue(new Error('offline'));

    emit(metaEvent(0));
    await advanceTimersByTimeAsync(500);
    await advanceTimersByTimeAsync(500);
    await advanceTimersByTimeAsync(1000);
    expect(mockSdk.widgetMessagePost).toHaveBeenCalledTimes(4);

    await advanceTimersByTimeAsync(1999);
    expect(mockSdk.widgetMessagePost).toHaveBeenCalledTimes(4);
    await advanceTimersByTimeAsync(1);
    expect(mockSdk.widgetMessagePost).toHaveBeenCalledTimes(5);
    recorder.stop();
    vi.useRealTimers();
  });

  it('stops retrying once the stream gives up and resumes when it registers again', async () => {
    vi.useFakeTimers();
    const { recorder, emit } = await startRecorder();
    mockSdk.widgetMessagePost.mockRejectedValueOnce(new Error('offline'));

    emit(metaEvent(0));
    await advanceTimersByTimeAsync(500);
    internals(streamClient).giveUp('Could not reconnect to the assistant. Try again.');
    emit(incrementalEvent(1));
    await advanceTimersByTimeAsync(120_000);
    expect(mockSdk.widgetMessagePost).toHaveBeenCalledTimes(2);

    mockSdk.widgetMessagePost.mockResolvedValueOnce({ success: true });
    internals(streamClient).handleMessage({ type: 'registered', chat_id: 'chat-1' });
    await flushMicrotasks();
    const posted = mockSdk.widgetMessagePost.mock.lastCall?.[0].command as { events: RrwebEvent[] };
    expect(mockSdk.widgetMessagePost).toHaveBeenCalledTimes(3);
    expect(posted.events).toEqual([metaEvent(0), incrementalEvent(1)]);
    recorder.stop();
    vi.useRealTimers();
  });
});

describe('a recorder whose stream has given up', () => {
  const internals = (client: typeof streamClient) =>
    client as unknown as { handleMessage: (event: WidgetEvent) => void; giveUp: (message: string) => void };

  it('bounds the buffer while nothing flushes', async () => {
    vi.useFakeTimers();
    const { recorder, emit } = await startRecorder();
    internals(streamClient).giveUp('Could not reconnect to the assistant. Try again.');

    for (let i = 0; i < 20_010; i++) emit(incrementalEvent(i));
    mockSdk.widgetMessagePost.mockResolvedValueOnce({ success: true });
    internals(streamClient).handleMessage({ type: 'registered', chat_id: 'chat-1' });
    await flushMicrotasks();

    const posted = mockSdk.widgetMessagePost.mock.lastCall?.[0].command as { events: RrwebEvent[] };
    expect(posted.events).toHaveLength(20_000);
    recorder.stop();
    vi.useRealTimers();
  });

  it('flushes again once a cleared chat registers its new thread', async () => {
    vi.useFakeTimers();
    Object.assign(record, { takeFullSnapshot: vi.fn() });
    const { recorder, emit } = await startRecorder();
    internals(streamClient).giveUp('Could not reconnect to the assistant. Try again.');
    mockSdk.widgetMessagePost.mockResolvedValue({ success: true });

    internals(streamClient).handleMessage({ type: 'registered', chat_id: 'chat-2' });
    await waitFor(() => expect(mockSdk.widgetMessagePost.mock.lastCall?.[0].chat_id).toBe('chat-2'));
    emit(incrementalEvent(1));
    await advanceTimersByTimeAsync(500);

    const posted = mockSdk.widgetMessagePost.mock.lastCall?.[0];
    expect(posted?.chat_id).toBe('chat-2');
    expect(posted?.command).toMatchObject({ type: 'rrweb/events', events: [incrementalEvent(1)] });
    recorder.stop();
    vi.useRealTimers();
  });
});

describe('a stream that gives up before the chat first registers', () => {
  it('starts recording once a retry registers the chat', async () => {
    const internals = streamClient as unknown as { handleMessage: (event: WidgetEvent) => void };
    vi.spyOn(streamClient, 'ready')
      .mockRejectedValueOnce(new StreamGaveUpError('Could not reconnect to the assistant. Try again.'))
      .mockResolvedValue();
    mockSdk.widgetMessagePost.mockResolvedValue({ success: true });
    const recorder = new RrwebSessionRecorder('chat-1');

    await recorder.start();
    expect(record).not.toHaveBeenCalled();

    internals.handleMessage({ type: 'registered', chat_id: 'chat-1' });
    await waitFor(() => expect(record).toHaveBeenCalledTimes(1));
    expect(mockSdk.widgetMessagePost.mock.lastCall?.[0].command.type).toBe('rrweb/metadata');
    expect(mockSdk.widgetMessagePost.mock.lastCall?.[0].command).not.toHaveProperty('chat_id');
    expect(mockSdk.widgetMessagePost.mock.lastCall?.[0].command).not.toHaveProperty('application_id');
    recorder.stop();
  });
});

describe('RrwebSessionRecorder lifecycle', () => {
  it('does not begin recording when stopped while metadata is in flight', async () => {
    let resolveMetadata!: () => void;
    mockSdk.widgetMessagePost.mockReturnValueOnce(
      new Promise(resolve => {
        resolveMetadata = () => resolve({ success: true });
      }),
    );
    const recorder = new RrwebSessionRecorder('old-chat');

    const start = recorder.start();
    recorder.stop();
    resolveMetadata();
    await start;

    expect(record).not.toHaveBeenCalled();
  });
});

describe('RrwebSessionRecorder.stop', () => {
  it('flushes whatever is buffered instead of dropping it', async () => {
    const { recorder, emit } = await startRecorder();
    mockSdk.widgetMessagePost.mockClear();
    mockSdk.widgetMessagePost.mockResolvedValueOnce({ success: true });
    emit(metaEvent(0));

    recorder.stop();
    await flushMicrotasks();

    const posted = mockSdk.widgetMessagePost.mock.lastCall?.[0].command as {
      events: RrwebEvent[];
    };
    expect(posted.events).toEqual([metaEvent(0)]);
  });
});

describe('a recorder already recording', () => {
  it('is a no-op on a second start(), never arming a duplicate rrweb instance', async () => {
    const { recorder } = await startRecorder();
    mocked(record).mockClear();
    mockSdk.widgetMessagePost.mockClear();

    await recorder.start();

    expect(record).not.toHaveBeenCalled();
    expect(mockSdk.widgetMessagePost).not.toHaveBeenCalled();
  });
});

describe('a recorder posting into a chat the api has not registered', () => {
  it('holds the metadata post until the stream is registered', async () => {
    let register!: () => void;
    const ready = vi.spyOn(streamClient, 'ready').mockReturnValue(
      new Promise<void>(resolve => {
        register = resolve;
      }),
    );
    mockSdk.widgetMessagePost.mockResolvedValueOnce({ success: true });

    const start = new RrwebSessionRecorder('chat-1').start();
    await flushMicrotasks();

    expect(ready).toHaveBeenCalledWith('chat-1');
    expect(mockSdk.widgetMessagePost).not.toHaveBeenCalled();

    register();
    await start;

    expect(mockSdk.widgetMessagePost).toHaveBeenCalledTimes(1);
  });
});

describe('a cleared chat', () => {
  it('moves the recording to the new thread as a fresh session starting from a full snapshot', async () => {
    const takeFullSnapshot = vi.fn();
    Object.assign(record, { takeFullSnapshot });
    const listen = vi.spyOn(streamClient, 'addCallbacks');
    const { recorder } = await startRecorder();
    const onMessage = listen.mock.calls[0]?.[0].onMessage;
    if (!onMessage) throw new Error('expected the recorder to listen to the stream');
    mockSdk.widgetMessagePost.mockResolvedValue({ success: true });

    onMessage({ type: 'registered', chat_id: 'chat-2' });
    await waitFor(() => expect(takeFullSnapshot).toHaveBeenCalledTimes(1));

    const metadata = mockSdk.widgetMessagePost.mock.calls
      .map(([input]) => input)
      .filter(input => input.command.type === 'rrweb/metadata');
    expect(metadata.map(input => input.chat_id)).toEqual(['chat-1', 'chat-2']);
    const [first, second] = metadata.map(
      input => input.command.type === 'rrweb/metadata' && input.command.rrweb_session_id,
    );
    expect(second).not.toBe(first);
    recorder.stop();
  });
});
