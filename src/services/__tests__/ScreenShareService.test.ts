/**
 * `use_screenshare` tests: denied without a prompt when the tenant turned sharing off — on the switch
 * alone, so a stored config that lost its credentials cannot reopen the picker — and prompted when on.
 * `startScreenShare` is idempotent both for an already-live stream and for two overlapping calls before
 * the first `getDisplayMedia` prompt resolves; `stopScreenShare` releases every track and is a no-op
 * when nothing is sharing.
 *
 * `startScreenShare`/`stopScreenShare` own module-level state (the active `MediaStream`) shared by the
 * whole `bun test` process (root `CLAUDE.md` has the general leak mechanism); the success case here
 * leaves it genuinely active, so `afterEach` calls `stopScreenShare()` to keep it from being read as
 * still sharing by `widget-smoke.test.tsx`/`ChatView.test.tsx`, mounted afterward.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { startScreenShare, stopScreenShare } from '@/services/ScreenShareService';
import { storageService } from '@/services/StorageService';
import { credentialedConfig } from '@/test/fixtures';

const getDisplayMedia = vi.fn();

const liveStream = () =>
  ({
    active: true,
    getVideoTracks: () => [{ readyState: 'live', addEventListener: vi.fn() }],
    getTracks: () => [{ stop: vi.fn() }],
  }) as unknown as MediaStream;

beforeEach(() => {
  vi.clearAllMocks();
  stopScreenShare();
  Object.defineProperty(navigator, 'mediaDevices', { value: { getDisplayMedia }, configurable: true });
});

afterEach(() => {
  stopScreenShare();
});

describe('use_screenshare', () => {
  it.each([
    [
      'the tenant turned screen sharing off',
      () => storageService.setConfig(credentialedConfig({ mtxId: 'id', mtxKey: 'key', use_screenshare: false })),
    ],
    [
      'the switch alone flips it — a stored config that lost its credentials must not reopen the picker',
      () => storageService.updateContext({ config: { use_screenshare: false } }),
    ],
  ] as const)('denies the request instead of prompting when %s', async (_label, setup) => {
    setup();

    await expect(startScreenShare()).rejects.toThrow('Screen sharing is disabled for this widget');
    expect(getDisplayMedia).not.toHaveBeenCalled();
  });

  it('prompts when the tenant left screen sharing on', async () => {
    storageService.setConfig(credentialedConfig({ mtxId: 'id', mtxKey: 'key' }));
    const stream = liveStream();
    getDisplayMedia.mockResolvedValue(stream);

    await expect(startScreenShare()).resolves.toBe(stream);
    expect(getDisplayMedia).toHaveBeenCalledTimes(1);
  });

  it('shares one prompt between two overlapping calls before it resolves', async () => {
    storageService.setConfig(credentialedConfig({ mtxId: 'id', mtxKey: 'key' }));
    const stream = liveStream();
    let resolvePrompt!: (stream: MediaStream) => void;
    getDisplayMedia.mockReturnValue(
      new Promise<MediaStream>(resolve => {
        resolvePrompt = resolve;
      }),
    );

    const first = startScreenShare();
    const second = startScreenShare();
    resolvePrompt(stream);

    await expect(first).resolves.toBe(stream);
    await expect(second).resolves.toBe(stream);
    expect(getDisplayMedia).toHaveBeenCalledTimes(1);
  });

  it('releases every track on stop, and is a no-op when nothing is sharing', async () => {
    storageService.setConfig(credentialedConfig({ mtxId: 'id', mtxKey: 'key' }));
    const stopTrack = vi.fn();
    const stream = {
      active: true,
      getVideoTracks: () => [{ readyState: 'live', addEventListener: vi.fn() }],
      getTracks: () => [{ stop: stopTrack }, { stop: stopTrack }],
    } as unknown as MediaStream;
    getDisplayMedia.mockResolvedValue(stream);

    await startScreenShare();
    stopScreenShare();

    expect(stopTrack).toHaveBeenCalledTimes(2);
    expect(() => stopScreenShare()).not.toThrow();
  });
});
