/**
 * Tests for `startScreenShare`/`stopScreenShare`: denial when the tenant has screen sharing off,
 * idempotent starts and a shared prompt across overlapping calls, and that sharing status tracks the
 * video track's own readyState.
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
