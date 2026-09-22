/**
 * Tests for the screen-share store: a shared prompt across overlapping starts, sharing status tracking the
 * video track's own readyState, and subscribers notified on start, stop and a browser-ended track.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { mockMediaStream } from '../../test/fixtures';
import { activeScreenStream, startScreenShare, stopScreenShare, subscribeScreenShare } from '../ScreenShareService';

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

describe('the screen-share store', () => {
  it('prompts once and returns the stream', async () => {
    const stream = liveStream();
    getDisplayMedia.mockResolvedValue(stream);

    await expect(startScreenShare()).resolves.toBe(stream);
    expect(getDisplayMedia).toHaveBeenCalledTimes(1);
  });

  it('shares one prompt between two overlapping calls before it resolves', async () => {
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
    const track = { readyState: 'live', addEventListener: vi.fn() };
    const stream = mockMediaStream({ getVideoTracks: () => [track], getTracks: () => [{ stop: vi.fn() }] });
    getDisplayMedia.mockResolvedValue(stream);
    await startScreenShare();

    expect(activeScreenStream()).toBe(stream);

    track.readyState = 'ended';

    expect(activeScreenStream()).toBeNull();
  });

  it('rejects a prompt that resolves with no video track instead of returning it', async () => {
    getDisplayMedia.mockResolvedValue(mockMediaStream({ getVideoTracks: () => [], getTracks: () => [] }));

    await expect(startScreenShare()).rejects.toThrow('Screen sharing permission denied or no video track available');
  });

  it('releases every track on stop, and is a no-op when nothing is sharing', async () => {
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

  it('notifies subscribers on start, on stop, and when the browser ends the track', async () => {
    let ended!: () => void;
    const track = { readyState: 'live', addEventListener: (_: string, listener: () => void) => (ended = listener) };
    const stream = mockMediaStream({ getVideoTracks: () => [track], getTracks: () => [{ stop: vi.fn() }] });
    getDisplayMedia.mockResolvedValue(stream);
    const listener = vi.fn();
    const unsubscribe = subscribeScreenShare(listener);

    await startScreenShare();
    ended();
    await startScreenShare();
    stopScreenShare();
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(4);
  });
});
