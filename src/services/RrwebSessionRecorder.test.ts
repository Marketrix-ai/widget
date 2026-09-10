/**
 * `RrwebSessionRecorder` tests: a rejected flush caps the buffer without discarding the Meta and
 * FullSnapshot every later event replays against; stopping while metadata is in flight never begins
 * recording; and the metadata post waits until the stream has registered the chat.
 */
import { record } from '@rrweb/record';
import { EventType } from '@rrweb/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { sdk } from '../sdk';
import { flushMicrotasks } from '../test/fixtures';
import { advanceTimersByTimeAsync, mocked } from '../test/vi-compat';
import { RrwebSessionRecorder } from './RrwebSessionRecorder';
import { streamClient } from './StreamClient';

vi.mock('@rrweb/record', () => ({ record: vi.fn(() => vi.fn()) }));
vi.mock('../sdk', () => ({ sdk: { widgetMessagePost: vi.fn() } }));

const mockSdk = mocked(sdk);

beforeEach(() => {
  vi.spyOn(streamClient, 'ready').mockResolvedValue();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

type Emit = (event: { type: number; data: Record<string, never>; timestamp: number }) => void;

const startRecorder = async (): Promise<{ recorder: RrwebSessionRecorder; emit: Emit }> => {
  mockSdk.widgetMessagePost.mockResolvedValueOnce(undefined);
  const recorder = new RrwebSessionRecorder('chat-1', 1);
  await recorder.start();
  return { recorder, emit: mocked(record).mock.calls[0][0].emit as unknown as Emit };
};

describe('a flush the api rejects', () => {
  it('caps the buffer without discarding the Meta and FullSnapshot every later event is replayed against', async () => {
    vi.useFakeTimers();
    const { emit } = await startRecorder();
    mockSdk.widgetMessagePost.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);

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
    expect(posted.events.at(-1)?.timestamp).toBe(99_999);
    vi.useRealTimers();
  });
});

describe('RrwebSessionRecorder lifecycle', () => {
  it('does not begin recording when stopped while metadata is in flight', async () => {
    let resolveMetadata!: () => void;
    mockSdk.widgetMessagePost.mockReturnValueOnce(
      new Promise(resolve => {
        resolveMetadata = () => resolve(undefined);
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

describe('a recorder posting into a chat the api has not registered', () => {
  it('holds the metadata post until the stream is registered', async () => {
    let register!: () => void;
    const ready = vi.spyOn(streamClient, 'ready').mockReturnValue(
      new Promise<void>(resolve => {
        register = resolve;
      }),
    );
    mockSdk.widgetMessagePost.mockResolvedValueOnce(undefined);

    const start = new RrwebSessionRecorder('chat-1', 1).start();
    await flushMicrotasks();

    expect(ready).toHaveBeenCalledWith('chat-1');
    expect(mockSdk.widgetMessagePost).not.toHaveBeenCalled();

    register();
    await start;

    expect(mockSdk.widgetMessagePost).toHaveBeenCalledOnce();
  });
});
