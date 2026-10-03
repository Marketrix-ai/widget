/**
 * Tests for the screen-share store: a shared prompt across overlapping starts, sharing status tracking the
 * video track's own readyState, and subscribers notified on start, stop and a browser-ended track.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { FakeMediaStream, FakeTrack } from '../../test/fixtures';
import { activeScreenStream, startScreenShare, stopScreenShare, subscribeScreenShare } from '../ScreenShareService';

const getDisplayMedia = vi.fn<MediaDevices['getDisplayMedia']>();

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
    const stream = new FakeMediaStream();
    getDisplayMedia.mockResolvedValue(stream);

    await expect(startScreenShare()).resolves.toBe(stream);
    expect(getDisplayMedia).toHaveBeenCalledTimes(1);
  });

  it('shares one prompt between two overlapping calls before it resolves', async () => {
    const stream = new FakeMediaStream();
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
    const track = new FakeTrack();
    const stream = new FakeMediaStream([track]);
    getDisplayMedia.mockResolvedValue(stream);
    await startScreenShare();

    expect(activeScreenStream()).toBe(stream);

    track.readyState = 'ended';

    expect(activeScreenStream()).toBeNull();
  });

  it('rejects a prompt that resolves with no video track instead of returning it', async () => {
    getDisplayMedia.mockResolvedValue(new FakeMediaStream([]));

    await expect(startScreenShare()).rejects.toThrow('Screen sharing permission denied or no video track available');
  });

  it('releases every track on stop, and is a no-op when nothing is sharing', async () => {
    const tracks = [new FakeTrack(), new FakeTrack()];
    getDisplayMedia.mockResolvedValue(new FakeMediaStream(tracks));

    await startScreenShare();
    stopScreenShare();

    expect(tracks.map(track => track.stop.mock.calls.length)).toEqual([1, 1]);
    expect(() => stopScreenShare()).not.toThrow();
  });

  it('notifies subscribers on start, on stop, and when the browser ends the track', async () => {
    const track = new FakeTrack();
    getDisplayMedia.mockResolvedValue(new FakeMediaStream([track]));
    const listener = vi.fn();
    const unsubscribe = subscribeScreenShare(listener);

    await startScreenShare();
    track.end();
    await startScreenShare();
    stopScreenShare();
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(4);
  });
});
