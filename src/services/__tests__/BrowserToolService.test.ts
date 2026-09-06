import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BROWSER_TOOLS, WAIT_FOR_USER_TOOLS } from '../../utils/chat';
import { browserToolService } from '../BrowserToolService';
import { domService } from '../DomService';
import { showModeService } from '../ShowModeService';

const locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location') as PropertyDescriptor;
let navigations: string[] = [];

beforeEach(() => {
  navigations = [];
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: Object.defineProperty({}, 'href', {
      get: () => 'https://host.test/start',
      set: (url: string) => {
        navigations.push(url);
      },
    }),
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', locationDescriptor);
  vi.restoreAllMocks();
});

describe('a tool that leaves the page reports itself before it goes', () => {
  it('navigate holds the navigation until the response is sent', async () => {
    const result = await browserToolService.executeTool('navigate', { url: 'https://host.test/next' });

    expect(result.success).toBe(true);
    expect(navigations).toEqual([]);

    result.afterResponseAttempt?.();

    expect(navigations).toEqual(['https://host.test/next']);
  });

  it('search holds the navigation until the response is sent', async () => {
    const result = await browserToolService.executeTool('search', { query: 'widgets' });

    expect(navigations).toEqual([]);

    result.afterResponseAttempt?.();

    expect(navigations).toEqual(['https://duckduckgo.com/?q=widgets']);
  });

  it('go_back holds the history move until the response is sent', async () => {
    window.history.pushState({}, '', '/second');
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});

    const result = await browserToolService.executeTool('go_back', {});

    expect(back).not.toHaveBeenCalled();

    result.afterResponseAttempt?.();

    expect(back).toHaveBeenCalledOnce();
  });
});

describe('navigate reports what the browser did with a new tab', () => {
  it('succeeds when the popup really opened', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);

    const result = await browserToolService.executeTool('navigate', { url: 'https://host.test/next', new_tab: true });

    expect(open).toHaveBeenCalledWith('https://host.test/next', '_blank');
    expect(result.success).toBe(true);
  });

  it('fails when a popup blocker refuses it', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);

    const result = await browserToolService.executeTool('navigate', { url: 'https://host.test/next', new_tab: true });

    expect(result.success).toBe(false);
    expect(result.error).toBe('The browser blocked opening a new tab');
  });
});

describe('close_tab reports what the browser did', () => {
  it('fails when the browser refuses to close a tab the script did not open', async () => {
    vi.spyOn(window, 'close').mockImplementation(() => {});

    const result = await browserToolService.executeTool('close_tab', {});

    expect(result.success).toBe(false);
  });

  it('succeeds when the tab really closed', async () => {
    vi.spyOn(window, 'close').mockImplementation(() => {
      Object.defineProperty(window, 'closed', { configurable: true, value: true });
    });

    const result = await browserToolService.executeTool('close_tab', {});

    expect(result.success).toBe(true);
    Object.defineProperty(window, 'closed', { configurable: true, value: false });
  });
});

describe('a tool nothing can perform is not offered at all', () => {
  it('upload_file is unknown, so show mode never asks the visitor to confirm it', async () => {
    vi.spyOn(domService, 'getValidatedElement').mockReturnValue({ element: document.createElement('input') });
    const staged = vi.spyOn(showModeService, 'showToolAction').mockResolvedValue();

    const result = await browserToolService.executeTool('upload_file', { index: 0 }, 'show');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown tool: upload_file');
    expect(staged).not.toHaveBeenCalled();
    expect(BROWSER_TOOLS.has('upload_file')).toBe(false);
    expect(WAIT_FOR_USER_TOOLS.has('upload_file')).toBe(false);
  });
});

describe('a run the model ends is not a widget tool failure', () => {
  it('reports done as executed when the agent sends only the closing message', async () => {
    const result = await browserToolService.executeTool('done', { message: 'Could not find the checkout button' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ text: 'Could not find the checkout button' });
  });
});
