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
