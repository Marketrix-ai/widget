/**
 * `use_screenshare` tests: denied without a prompt when the tenant turned sharing off — on the switch
 * alone, so a stored config that lost its credentials cannot reopen the picker — and prompted when on.
 * `startScreenShare` is idempotent both for an already-live stream and for two overlapping calls before
 * the first `getDisplayMedia` prompt resolves; `stopScreenShare` releases every track and is a no-op
 * when nothing is sharing. `activeScreenStream`/`isScreenSharing` read the video track's OWN readyState,
 * not just stream liveness, and `startScreenShare` rejects a prompt that resolves with zero video tracks
 * instead of returning an unusable stream.
 *
 * `startScreenShare`/`stopScreenShare` own module-level state (the active `MediaStream`) shared by the
 * whole `bun test` process (root `CLAUDE.md` has the general leak mechanism); the success case here
 * leaves it genuinely active, so `afterEach` calls `stopScreenShare()` to keep it from being read as
 * still sharing by `widget-smoke.test.tsx`/`ChatView.test.tsx`, mounted afterward.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { activeScreenStream, isScreenSharing, startScreenShare, stopScreenShare } from '@/services/ScreenShareService';
import { storageService } from '@/services/StorageService';
import { credentialedConfig, mockMediaStream } from '@/test/fixtures';

const getDisplayMedia = vi.fn();

const liveStream = () =>
  mockMediaStream({
    getVideoTracks: () => [{ readyState: 'live', addEventListener: vi.fn() }],
    getTracks: () => [{ stop: vi.fn() }],
  });

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

  it('reports not sharing once the video track itself ends, even while the stream object is still active', async () => {
    storageService.setConfig(credentialedConfig({ mtxId: 'id', mtxKey: 'key' }));
    const track = { readyState: 'live', addEventListener: vi.fn() };
    const stream = mockMediaStream({ getVideoTracks: () => [track], getTracks: () => [{ stop: vi.fn() }] });
    getDisplayMedia.mockResolvedValue(stream);
    await startScreenShare();

    expect(isScreenSharing()).toBe(true);
    expect(activeScreenStream()).toBe(stream);

    track.readyState = 'ended';

    expect(isScreenSharing()).toBe(false);
    expect(activeScreenStream()).toBeNull();
  });

  it('rejects a prompt that resolves with no video track instead of returning it', async () => {
    storageService.setConfig(credentialedConfig({ mtxId: 'id', mtxKey: 'key' }));
    getDisplayMedia.mockResolvedValue(mockMediaStream({ getVideoTracks: () => [], getTracks: () => [] }));

    await expect(startScreenShare()).rejects.toThrow('Screen sharing permission denied or no video track available');
  });

  it('releases every track on stop, and is a no-op when nothing is sharing', async () => {
    storageService.setConfig(credentialedConfig({ mtxId: 'id', mtxKey: 'key' }));
    const stopTrack = vi.fn();
    const stream = mockMediaStream({
      getVideoTracks: () => [{ readyState: 'live', addEventListener: vi.fn() }],
      getTracks: () => [{ stop: stopTrack }, { stop: stopTrack }],
    });
    getDisplayMedia.mockResolvedValue(stream);

    await startScreenShare();
    stopScreenShare();

    expect(stopTrack).toHaveBeenCalledTimes(2);
    expect(() => stopScreenShare()).not.toThrow();
  });
});
