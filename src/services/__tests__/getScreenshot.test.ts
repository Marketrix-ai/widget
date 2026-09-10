/**
 * `get_screenshot` tests: no active share fails instead of prompting a new one (which would bypass the
 * visitor's Deny), a stream that never delivers a frame fails instead of waiting forever and leaves no
 * video in the host page, and a refused 2d canvas context reports failure rather than an all-black frame.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushMicrotasks } from '../../test/fixtures';
import { resetDom } from '../../test/setup';
import { browserToolService } from '../BrowserToolService';
import { activeScreenStream } from '../ScreenShareService';

vi.mock('../ScreenShareService', () => ({ activeScreenStream: vi.fn() }));

describe('get_screenshot with no active screen share', () => {
  beforeEach(() => {
    vi.mocked(activeScreenStream).mockReturnValue(null);
  });

  it('fails instead of prompting a new share, which would bypass the visitor Deny', async () => {
    const result = await browserToolService.executeTool('get_screenshot', {});
    expect(result).toMatchObject({ success: false, error: expect.stringContaining('not sharing') });
    expect(document.querySelector('video')).toBeNull();
  });
});

describe('get_screenshot on a stream that never delivers a frame', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(activeScreenStream).mockReturnValue({} as MediaStream);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetDom();
  });

  it('fails instead of waiting forever, and leaves no video behind in the host page', async () => {
    const result = browserToolService.executeTool('get_screenshot', {});
    await vi.advanceTimersByTimeAsync(0);
    expect(document.querySelector('video')).not.toBeNull();

    await vi.advanceTimersByTimeAsync(5000);

    expect(await result).toMatchObject({ success: false, error: expect.stringContaining('no frame') });
    expect(document.querySelector('video')).toBeNull();
  });
});

describe('get_screenshot when the browser refuses a 2d canvas context', () => {
  let getContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    vi.mocked(activeScreenStream).mockReturnValue({} as MediaStream);
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
    const result = browserToolService.executeTool('get_screenshot', {});
    await flushMicrotasks();
    document.querySelector('video')?.dispatchEvent(new Event('loadeddata'));

    expect(await result).toMatchObject({ success: false });
    expect(document.querySelector('video')).toBeNull();
  });
});
