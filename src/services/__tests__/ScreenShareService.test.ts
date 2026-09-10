/**
 * `use_screenshare` tests: denied without a prompt when the tenant turned sharing off — on the switch
 * alone, so a stored config that lost its credentials cannot reopen the picker — and prompted when on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

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

// `startScreenShare`/`stopScreenShare` own MODULE-LEVEL state (the active `MediaStream`) shared by the
// whole `bun test` process — "prompts when the tenant left screen sharing on" leaves it genuinely
// active on success, and with no other file's `beforeEach` calling `stopScreenShare()` for it, a widget
// mounted afterward (`widget-smoke.test.tsx`, `ChatView.test.tsx`) reads `isScreenSharing()` as true and
// renders "Stop screen sharing" — hiding the "Start screen sharing" button those tests click.
afterEach(() => {
  stopScreenShare();
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
