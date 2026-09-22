/**
 * Tests for `RrwebSessionRecorder`: a rejected flush caps the buffer without dropping the Meta/
 * FullSnapshot baseline, retries keep going even with no new events, and start/stop respect an
 * in-flight metadata post and the stream's registration.
 */
import { record } from '@rrweb/record';
import { EventType, type eventWithTime } from '@rrweb/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { sdk } from '../../sdk';
import type { RrwebEvent } from '../../sdk/contracts/common';
import { flushMicrotasks } from '../../test/fixtures';
import { advanceTimersByTimeAsync, mocked, mockSdkModule, restoreModuleAfterAll } from '../../test/vi-compat';
import { RrwebSessionRecorder } from '../RrwebSessionRecorder';
import { streamClient } from '../StreamClient';

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
  const recorder = new RrwebSessionRecorder('chat-1', 1);
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
    expect(posted.events).toHaveLength(20_001);
    expect(posted.events.slice(0, 2).map(event => event.type)).toEqual([EventType.Meta, EventType.FullSnapshot]);
    expect(posted.events[posted.events.length - 1]?.timestamp).toBe(99_999);
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

describe('RrwebSessionRecorder lifecycle', () => {
  it('does not begin recording when stopped while metadata is in flight', async () => {
    let resolveMetadata!: () => void;
    mockSdk.widgetMessagePost.mockReturnValueOnce(
      new Promise(resolve => {
        resolveMetadata = () => resolve({ success: true });
      }),
    );
    const recorder = new RrwebSessionRecorder('old-chat', 1);

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

    const start = new RrwebSessionRecorder('chat-1', 1).start();
    await flushMicrotasks();

    expect(ready).toHaveBeenCalledWith('chat-1');
    expect(mockSdk.widgetMessagePost).not.toHaveBeenCalled();

    register();
    await start;

    expect(mockSdk.widgetMessagePost).toHaveBeenCalledTimes(1);
  });
});
