/**
 * Tests for `RrwebSessionRecorder`: a rejected flush caps the buffer without dropping the Meta/FullSnapshot
 * baseline, retries keep going even with no new events on a doubling delay that pauses while the chat is not
 * registered, a rejected session open is retried, start/stop respect an in-flight metadata post and the stream's
 * registration, and a newly registered chat gets its own session.
 */
import type { record as recordFn } from '@rrweb/record';
import { EventType } from '@rrweb/types';
import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import type { WidgetClient } from '../../sdk';
import type { RrwebEvent } from '../../sdk/contracts/rrweb';
import { asStreamClientInternals, flushMicrotasks } from '../../test/fixtures';
import { advanceTimersByTimeAsync, mockSdk } from '../../test/vi-compat';
import { RrwebSessionRecorder } from '../RrwebSessionRecorder';
import type { StreamState } from '../StreamClient';

const record = vi.fn<(...args: Parameters<typeof recordFn>) => ReturnType<typeof recordFn>>(() => vi.fn());
vi.mock('@rrweb/record', () => ({ record }));
const widgetMessagePost = vi.fn<WidgetClient['widgetMessagePost']>();
mockSdk({ widgetMessagePost });

const lastPostedEvents = () => {
  const command = widgetMessagePost.mock.lastCall?.[0].command;
  if (command?.type !== 'rrweb/events')
    throw new Error(`last post was ${command?.type ?? 'nothing'}, not rrweb/events`);
  return command.events;
};

const registered = (chatId = 'chat-1'): StreamState => ({ phase: 'registered', chatId, gen: 1 });
const gaveUp: StreamState = { phase: 'gaveUp', chatId: 'chat-1', reason: 'exhausted' };
const enter = (state: StreamState) => {
  asStreamClientInternals().state = state;
};

const recorders: RrwebSessionRecorder[] = [];
const newRecorder = (): RrwebSessionRecorder => {
  const recorder = new RrwebSessionRecorder();
  recorders.push(recorder);
  return recorder;
};

beforeEach(() => {
  enter(registered());
});

afterEach(async () => {
  await Promise.all(recorders.splice(0).map(recorder => recorder.stop()));
  enter({ phase: 'idle' });
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

type Emit = NonNullable<NonNullable<Parameters<typeof recordFn>[0]>['emit']>;

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
  widgetMessagePost.mockResolvedValueOnce({ success: true });
  const recorder = newRecorder();
  recorder.start();
  await waitFor(() => expect(record).toHaveBeenCalled());
  const emit = record.mock.calls[0]?.[0]?.emit;
  if (!emit) throw new Error('expected @rrweb/record to have been called with an emit');
  return { recorder, emit };
};

describe('rrweb event validation', () => {
  it('drops an event outside the generated wire schema with one warning, never throwing into the host page', async () => {
    const { recorder, emit } = await startRecorder();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    for (let i = 0; i < 2; i++) {
      expect(() => emit({ type: EventType.DomContentLoaded, data: { extra: true }, timestamp: 0 })).not.toThrow();
    }
    await recorder.stop();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(widgetMessagePost).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('a flush the api rejects', () => {
  const startWithARejectedFlush = async () => {
    vi.useFakeTimers();
    const { emit } = await startRecorder();
    widgetMessagePost.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ success: true });
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

    const events = lastPostedEvents();
    expect(events).toHaveLength(20_000);
    expect(events.slice(0, 2).map(event => event.type)).toEqual([EventType.Meta, EventType.FullSnapshot]);
    expect(events[events.length - 1]?.timestamp).toBe(19_999);
    vi.useRealTimers();
  });

  it('retries on its own timer with no new events to piggyback on, and drops nothing', async () => {
    const emit = await startWithARejectedFlush();

    emit(metaEvent(0));
    await advanceTimersByTimeAsync(500);
    expect(widgetMessagePost).toHaveBeenCalledTimes(2);

    await advanceTimersByTimeAsync(500);

    const events = lastPostedEvents();
    expect(widgetMessagePost).toHaveBeenCalledTimes(3);
    expect(events).toEqual([metaEvent(0)]);
    vi.useRealTimers();
  });
});

describe('a flush that keeps failing', () => {
  it('backs off on a doubling delay instead of polling every 500ms', async () => {
    vi.useFakeTimers();
    const { recorder, emit } = await startRecorder();
    widgetMessagePost.mockRejectedValue(new Error('offline'));

    emit(metaEvent(0));
    await advanceTimersByTimeAsync(500);
    await advanceTimersByTimeAsync(500);
    await advanceTimersByTimeAsync(1000);
    expect(widgetMessagePost).toHaveBeenCalledTimes(4);

    await advanceTimersByTimeAsync(1999);
    expect(widgetMessagePost).toHaveBeenCalledTimes(4);
    await advanceTimersByTimeAsync(1);
    expect(widgetMessagePost).toHaveBeenCalledTimes(5);
    recorder.stop();
    vi.useRealTimers();
  });

  it('stops retrying while the chat is not registered and resumes when it registers again', async () => {
    vi.useFakeTimers();
    const { recorder, emit } = await startRecorder();
    widgetMessagePost.mockRejectedValueOnce(new Error('offline'));

    emit(metaEvent(0));
    await advanceTimersByTimeAsync(500);
    enter(gaveUp);
    emit(incrementalEvent(1));
    await advanceTimersByTimeAsync(120_000);
    expect(widgetMessagePost).toHaveBeenCalledTimes(2);

    widgetMessagePost.mockResolvedValueOnce({ success: true });
    enter(registered());
    await flushMicrotasks();
    const events = lastPostedEvents();
    expect(widgetMessagePost).toHaveBeenCalledTimes(3);
    expect(events).toEqual([metaEvent(0), incrementalEvent(1)]);
    recorder.stop();
    vi.useRealTimers();
  });
});

describe('a recorder whose chat is not registered', () => {
  it('bounds the buffer while nothing flushes', async () => {
    vi.useFakeTimers();
    const { recorder, emit } = await startRecorder();
    enter(gaveUp);

    for (let i = 0; i < 20_010; i++) emit(incrementalEvent(i));
    widgetMessagePost.mockResolvedValueOnce({ success: true });
    enter(registered());
    await flushMicrotasks();

    const events = lastPostedEvents();
    expect(events).toHaveLength(20_000);
    recorder.stop();
    vi.useRealTimers();
  });

  it('flushes again once a cleared chat registers its new thread', async () => {
    vi.useFakeTimers();
    Object.assign(record, { takeFullSnapshot: vi.fn() });
    const { recorder, emit } = await startRecorder();
    enter(gaveUp);
    widgetMessagePost.mockResolvedValue({ success: true });

    enter(registered('chat-2'));
    await waitFor(() => expect(widgetMessagePost.mock.lastCall?.[0].chat_id).toBe('chat-2'));
    emit(incrementalEvent(1));
    await advanceTimersByTimeAsync(500);

    const posted = widgetMessagePost.mock.lastCall?.[0];
    expect(posted?.chat_id).toBe('chat-2');
    expect(posted?.command).toMatchObject({ type: 'rrweb/events', events: [incrementalEvent(1)] });
    recorder.stop();
    vi.useRealTimers();
  });
});

describe('a stream not yet registered', () => {
  it('starts recording once the chat registers, with a metadata post carrying no ids of its own', async () => {
    enter({ phase: 'connecting', chatId: 'chat-1', gen: 1, attempt: 0 });
    widgetMessagePost.mockResolvedValue({ success: true });
    const recorder = newRecorder();

    recorder.start();
    await flushMicrotasks();
    expect(record).not.toHaveBeenCalled();
    expect(widgetMessagePost).not.toHaveBeenCalled();

    enter(registered());
    await waitFor(() => expect(record).toHaveBeenCalledTimes(1));
    expect(widgetMessagePost.mock.lastCall?.[0].command.type).toBe('rrweb/metadata');
    expect(widgetMessagePost.mock.lastCall?.[0].command).not.toHaveProperty('chat_id');
    expect(widgetMessagePost.mock.lastCall?.[0].command).not.toHaveProperty('application_id');
    recorder.stop();
  });
});

describe('a session open the api rejects', () => {
  it('retries after the backoff delay and starts recording, without throwing into the host page', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    widgetMessagePost.mockRejectedValueOnce(new Error('503')).mockResolvedValue({ success: true });
    const recorder = newRecorder();

    recorder.start();
    await waitFor(() => expect(warn.mock.calls.flat().join(' ')).toContain('503'));
    expect(record).not.toHaveBeenCalled();

    await waitFor(() => expect(record).toHaveBeenCalledTimes(1));
    expect(widgetMessagePost).toHaveBeenCalledTimes(2);
    recorder.stop();
  });
});

describe('RrwebSessionRecorder lifecycle', () => {
  it('does not begin recording when stopped while metadata is in flight', async () => {
    let resolveMetadata!: () => void;
    widgetMessagePost.mockReturnValueOnce(
      new Promise(resolve => {
        resolveMetadata = () => resolve({ success: true });
      }),
    );
    const recorder = newRecorder();

    recorder.start();
    await flushMicrotasks();
    recorder.stop();
    resolveMetadata();
    await flushMicrotasks();

    expect(record).not.toHaveBeenCalled();
  });
});

describe('RrwebSessionRecorder.stop', () => {
  it('flushes whatever is buffered instead of dropping it', async () => {
    const { recorder, emit } = await startRecorder();
    widgetMessagePost.mockClear();
    widgetMessagePost.mockResolvedValueOnce({ success: true });
    emit(metaEvent(0));

    recorder.stop();
    await flushMicrotasks();

    const events = lastPostedEvents();
    expect(events).toEqual([metaEvent(0)]);
  });
});

describe('a recorder already recording', () => {
  it('is a no-op on a second start(), never arming a duplicate rrweb instance', async () => {
    const { recorder } = await startRecorder();
    record.mockClear();
    widgetMessagePost.mockClear();

    recorder.start();
    await flushMicrotasks();

    expect(record).not.toHaveBeenCalled();
    expect(widgetMessagePost).not.toHaveBeenCalled();
  });
});

describe('a newly registered chat', () => {
  it('moves the recording to the new thread as a fresh session starting from a full snapshot', async () => {
    const takeFullSnapshot = vi.fn();
    Object.assign(record, { takeFullSnapshot });
    const { recorder } = await startRecorder();
    widgetMessagePost.mockResolvedValue({ success: true });

    enter(registered('chat-2'));
    await waitFor(() => expect(takeFullSnapshot).toHaveBeenCalledTimes(1));

    const metadata = widgetMessagePost.mock.calls
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
