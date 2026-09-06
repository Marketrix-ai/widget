import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { browserToolService } from '../BrowserToolService';
import { startScreenShare } from '../ScreenShareService';

vi.mock('../ScreenShareService', () => ({ startScreenShare: vi.fn() }));

describe('get_screenshot on a stream that never delivers a frame', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(startScreenShare).mockResolvedValue({} as MediaStream);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
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
    vi.mocked(startScreenShare).mockResolvedValue({} as MediaStream);
    getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as typeof getContext;
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, value: 320 });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, value: 240 });
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = getContext;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('reports a failure rather than a well-formed all-black frame', async () => {
    const result = browserToolService.executeTool('get_screenshot', {});
    await Promise.resolve();
    document.querySelector('video')?.dispatchEvent(new Event('loadeddata'));

    expect(await result).toMatchObject({ success: false });
    expect(document.querySelector('video')).toBeNull();
  });
});
