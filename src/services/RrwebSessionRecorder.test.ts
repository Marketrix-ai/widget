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
