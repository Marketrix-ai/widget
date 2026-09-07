import { beforeEach, describe, expect, it, vi } from 'vitest';

import { startScreenShare, stopScreenShare } from '@/services/ScreenShareService';
import { storageService } from '@/services/StorageService';

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

describe('use_screenshare', () => {
  it('denies the request instead of prompting when the tenant turned screen sharing off', async () => {
    storageService.setConfig({ mtxId: 'id', mtxKey: 'key', use_screenshare: false });

    await expect(startScreenShare()).rejects.toThrow('Screen sharing is disabled for this widget');
    expect(getDisplayMedia).not.toHaveBeenCalled();
  });

  it('denies on the switch alone — a stored config that lost its credentials must not reopen the picker', async () => {
    storageService.updateContext({ config: { use_screenshare: false } });

    await expect(startScreenShare()).rejects.toThrow('Screen sharing is disabled for this widget');
    expect(getDisplayMedia).not.toHaveBeenCalled();
  });

  it('prompts when the tenant left screen sharing on', async () => {
    storageService.setConfig({ mtxId: 'id', mtxKey: 'key' });
    const stream = liveStream();
    getDisplayMedia.mockResolvedValue(stream);

    await expect(startScreenShare()).resolves.toBe(stream);
    expect(getDisplayMedia).toHaveBeenCalledTimes(1);
  });
});
