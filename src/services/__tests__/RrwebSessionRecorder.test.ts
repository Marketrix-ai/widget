/**
 * `RrwebSessionRecorder` tests: a rejected flush caps the buffer without discarding the Meta and
 * FullSnapshot every later event replays against, and retries on its own timer even when the host page
 * goes idle and rrweb emits nothing new to piggyback the retry on; stopping while metadata is in flight
 * never begins recording; the metadata post waits until the stream has registered the chat; and calling
 * `start()` again while already recording is a no-op, never a second `record()` arming a duplicate
 * rrweb instance.
 *
 * `Emit`'s parameter is typed from `@rrweb/types`'s real `eventWithTime` (`type`/`timestamp`, the two
 * fields this suite's buffering logic cares about) plus the real `emit`'s `isCheckout` second parameter,
 * not a hand-rolled shape that could drift from the library's actual callback signature; `data` stays
 * `unknown` since no test here reads it.
 */
import { record } from '@rrweb/record';
import { EventType, type eventWithTime } from '@rrweb/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { sdk } from '../../sdk';
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

const startRecorder = async (): Promise<{ recorder: RrwebSessionRecorder; emit: Emit }> => {
  mockSdk.widgetMessagePost.mockResolvedValueOnce({ success: true });
  const recorder = new RrwebSessionRecorder('chat-1', 1);
  await recorder.start();
  const call = mocked(record).mock.calls[0];
  const options = call?.[0];
  if (!options) throw new Error('expected @rrweb/record to have been called');
  return { recorder, emit: options.emit as unknown as Emit };
};

describe('a flush the api rejects', () => {
  const startWithARejectedFlush = async () => {
    vi.useFakeTimers();
    const { emit } = await startRecorder();
    mockSdk.widgetMessagePost.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ success: true });
    return emit;
  };

  it('caps the buffer without discarding the Meta and FullSnapshot every later event is replayed against', async () => {
    const emit = await startWithARejectedFlush();

    emit({ type: EventType.Meta, data: {}, timestamp: 0 });
    emit({ type: EventType.FullSnapshot, data: {}, timestamp: 1 });
    for (let i = 2; i < 20_005; i++) emit({ type: EventType.IncrementalSnapshot, data: {}, timestamp: i });
    await advanceTimersByTimeAsync(500);

    emit({ type: EventType.IncrementalSnapshot, data: {}, timestamp: 99_999 });
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

    emit({ type: EventType.Meta, data: {}, timestamp: 0 });
    await advanceTimersByTimeAsync(500);
    expect(mockSdk.widgetMessagePost).toHaveBeenCalledTimes(2);

    await advanceTimersByTimeAsync(500);

    const posted = mockSdk.widgetMessagePost.mock.lastCall?.[0].command as {
      events: Array<{ type: number; data: Record<string, never>; timestamp: number }>;
    };
    expect(mockSdk.widgetMessagePost).toHaveBeenCalledTimes(3);
    expect(posted.events).toEqual([{ type: EventType.Meta, data: {}, timestamp: 0 }]);
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
