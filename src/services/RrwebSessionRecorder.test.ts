import { record } from '@rrweb/record';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { sdk } from '../sdk';
import { RrwebSessionRecorder } from './RrwebSessionRecorder';

vi.mock('@rrweb/record', () => ({ record: vi.fn(() => vi.fn()) }));
vi.mock('../sdk', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    sdk: { widgetMessagePost: vi.fn() },
  };
});

const mockSdk = vi.mocked(sdk);

afterEach(() => {
  vi.clearAllMocks();
});

type Emit = (event: { type: number; data: Record<string, never>; timestamp: number }) => void;

const startRecorder = async (): Promise<{ recorder: RrwebSessionRecorder; emit: Emit }> => {
  mockSdk.widgetMessagePost.mockResolvedValueOnce(undefined);
  const recorder = new RrwebSessionRecorder('chat-1', 1);
  await recorder.start();
  return { recorder, emit: vi.mocked(record).mock.calls[0][0].emit as unknown as Emit };
};

describe('a flush the api rejects', () => {
  it('requeues the batch newest-first up to a cap, instead of growing for the life of the page', async () => {
    vi.useFakeTimers();
    const { emit } = await startRecorder();
    mockSdk.widgetMessagePost.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);

    for (let i = 0; i < 20_005; i++) emit({ type: 3, data: {}, timestamp: i });
    await vi.advanceTimersByTimeAsync(500);

    emit({ type: 3, data: {}, timestamp: 99_999 });
    await vi.advanceTimersByTimeAsync(500);

    const posted = mockSdk.widgetMessagePost.mock.lastCall?.[0].command as { events: Array<{ timestamp: number }> };
    expect(posted.events).toHaveLength(20_001);
    expect(posted.events[0].timestamp).toBe(5);
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
