/**
 * `get_screenshot` tests: no active share fails instead of prompting a new one (which would bypass the
 * visitor's Deny), a stream that never delivers a frame fails instead of waiting forever and leaves no
 * video in the host page, and a refused 2d canvas context reports failure rather than an all-black frame.
 *
 * `ScreenShareService` is faked with `vi.spyOn`, scoped per describe block to `beforeEach`/`afterEach`
 * rather than `vi.mock` — `../services/__tests__/ScreenShareService.test.ts` resolves the same module
 * via its own alias, so a module-scope mock here would leak into it by file-discovery order (root
 * `CLAUDE.md` has the general mechanism); each block's spy overrides only the one export it needs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { flushMicrotasks } from '../../test/fixtures';
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
    const result = await browserToolService.executeTool('get_screenshot', {});
    expect(result).toMatchObject({ success: false, error: expect.stringContaining('not sharing') });
    expect(document.querySelector('video')).toBeNull();
  });
});

describe('get_screenshot on a stream that never delivers a frame', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(ScreenShareService, 'activeScreenStream').mockReturnValue({} as MediaStream);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    resetDom();
  });

  it('fails instead of waiting forever, and leaves no video behind in the host page', async () => {
    const result = browserToolService.executeTool('get_screenshot', {});
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
    vi.spyOn(ScreenShareService, 'activeScreenStream').mockReturnValue({} as MediaStream);
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
