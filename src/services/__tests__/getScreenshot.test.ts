/**
 * `get_screenshot` tests: no active share fails instead of prompting a new one (which would bypass the
 * visitor's Deny), a stream that never delivers a frame fails instead of waiting forever and leaves no
 * video in the host page, and a refused 2d canvas context reports failure rather than an all-black frame.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { flushMicrotasks } from '../../test/fixtures';
import { resetDom } from '../../test/preload';
import { advanceTimersByTimeAsync } from '../../test/vi-compat';
import { browserToolService } from '../BrowserToolService';
import * as ScreenShareService from '../ScreenShareService';

// A `vi.mock('../ScreenShareService', factory)` replaces the module for the whole `bun test` process
// by resolved path, not just this file — `../services/__tests__/ScreenShareService.test.ts` resolves
// the SAME absolute file (via its own `@/services/ScreenShareService` alias) and would inherit
// whichever describe block's factory happened to register last, depending on file discovery order
// (which differs between local runs and CI). `vi.spyOn`, scoped to `beforeEach`/`afterEach` per describe
// block below, only ever overrides the one export each block needs and is undone immediately after.

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
