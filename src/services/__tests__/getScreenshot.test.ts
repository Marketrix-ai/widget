/**
 * `get_screenshot` tests: no active share fails instead of prompting a new one (which would bypass the
 * visitor's Deny), a stream that never delivers a frame fails instead of waiting forever and leaves no
 * video in the host page, a refused 2d canvas context reports failure rather than an all-black frame, and
 * — the success path a stubbed-`getContext` failure test alone would never exercise — a granted context
 * actually draws the video frame and returns the encoded data URI, not just a well-formed-looking result.
 *
 * `ScreenShareService` is faked with `vi.spyOn`, scoped per describe block to `beforeEach`/`afterEach`
 * rather than `vi.mock` — `../services/__tests__/ScreenShareService.test.ts` resolves the same module
 * via its own alias, so a module-scope mock here would leak into it by file-discovery order (root
 * `CLAUDE.md` has the general mechanism); each block's spy overrides only the one export it needs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { flushMicrotasks, mockMediaStream } from '../../test/fixtures';
import { resetDom } from '../../test/preload';
import { advanceTimersByTimeAsync } from '../../test/vi-compat';
import { browserToolService } from '../BrowserToolService';
import * as ScreenShareService from '../ScreenShareService';

describe('get_screenshot with no active screen share', () => {
  beforeEach(() => {
    vi.spyOn(ScreenShareService, 'activeScreenStream').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fails instead of prompting a new share, which would bypass the visitor Deny', async () => {
    const result = await browserToolService.executeTool('get_screenshot', {}, 'do');
    expect(result).toMatchObject({ success: false, error: expect.stringContaining('not sharing') });
    expect(document.querySelector('video')).toBeNull();
  });
});

describe('get_screenshot on a stream that never delivers a frame', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(ScreenShareService, 'activeScreenStream').mockReturnValue(mockMediaStream());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    resetDom();
  });

  it('fails instead of waiting forever, and leaves no video behind in the host page', async () => {
    const result = browserToolService.executeTool('get_screenshot', {}, 'do');
    await advanceTimersByTimeAsync(0);
    expect(document.querySelector('video')).not.toBeNull();

    await advanceTimersByTimeAsync(5000);

    expect(await result).toMatchObject({ success: false, error: expect.stringContaining('no frame') });
    expect(document.querySelector('video')).toBeNull();
  });
});

describe('get_screenshot when the browser refuses a 2d canvas context', () => {
  let getContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    vi.spyOn(ScreenShareService, 'activeScreenStream').mockReturnValue(mockMediaStream());
    getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as typeof getContext;
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, value: 320 });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, value: 240 });
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = getContext;
    resetDom();
    vi.restoreAllMocks();
  });

  it('reports a failure rather than a well-formed all-black frame', async () => {
    const result = browserToolService.executeTool('get_screenshot', {}, 'do');
    await flushMicrotasks();
    document.querySelector('video')?.dispatchEvent(new Event('loadeddata'));

    expect(await result).toMatchObject({ success: false });
    expect(document.querySelector('video')).toBeNull();
  });
});

describe('get_screenshot when the browser grants a 2d canvas context', () => {
  let getContext: typeof HTMLCanvasElement.prototype.getContext;
  let toDataURL: typeof HTMLCanvasElement.prototype.toDataURL;
  const drawImage = vi.fn();
  const mockToDataURL = vi.fn(() => 'data:image/jpeg;base64,fake-frame');

  beforeEach(() => {
    vi.spyOn(ScreenShareService, 'activeScreenStream').mockReturnValue(mockMediaStream());
    getContext = HTMLCanvasElement.prototype.getContext;
    toDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage })) as unknown as typeof getContext;
    HTMLCanvasElement.prototype.toDataURL = mockToDataURL;
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, value: 320 });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, value: 240 });
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = getContext;
    HTMLCanvasElement.prototype.toDataURL = toDataURL;
    resetDom();
    vi.restoreAllMocks();
  });

  it('draws the video frame and returns the encoded data URI, not just a well-formed failure', async () => {
    const result = browserToolService.executeTool('get_screenshot', {}, 'do');
    await flushMicrotasks();
    const video = document.querySelector('video');
    video?.dispatchEvent(new Event('loadeddata'));

    expect(await result).toMatchObject({ success: true, data: { text: 'data:image/jpeg;base64,fake-frame' } });
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0);
    expect(mockToDataURL).toHaveBeenCalledWith('image/jpeg', 0.75);
    expect(document.querySelector('video')).toBeNull();
  });
});
