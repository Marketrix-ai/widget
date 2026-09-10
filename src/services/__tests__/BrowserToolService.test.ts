/**
 * Browser-tool tests. A tool that leaves the page (`navigate`, `search_web`, `go_back`) holds the
 * navigation until its response has been sent, so the agent hears the result before the page is gone.
 * `navigate` refuses `javascript:` (it would run in the host page) and resolves relative URLs; opening a
 * new tab reports whether the popup really opened; `close_tab` fails on a tab the script did not open.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { browserToolService, FINISH_TOOL } from '../BrowserToolService';
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
    const result = await browserToolService.executeTool('navigate', { url: 'https://host.test/next' }, 'do');

    expect(result.success).toBe(true);
    expect(navigations).toEqual([]);

    result.afterResponseAttempt?.();

    expect(navigations).toEqual(['https://host.test/next']);
  });

  it('search_web holds the navigation until the response is sent', async () => {
    const result = await browserToolService.executeTool('search_web', { query: 'widgets' }, 'do');

    expect(navigations).toEqual([]);

    result.afterResponseAttempt?.();

    expect(navigations).toEqual(['https://duckduckgo.com/?q=widgets']);
  });

  it('go_back holds the history move until the response is sent', async () => {
    window.history.pushState({}, '', '/second');
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});

    const result = await browserToolService.executeTool('go_back', {}, 'do');

    expect(back).not.toHaveBeenCalled();

    result.afterResponseAttempt?.();

    expect(back).toHaveBeenCalledOnce();
  });
});

describe('navigate constrains its target to http(s)', () => {
  it('refuses a javascript: URL instead of running it in the host page', async () => {
    const result = await browserToolService.executeTool('navigate', { url: 'javascript:alert(document.cookie)' }, 'do');

    expect(result.success).toBe(false);
    expect(result.error).toBe('An http(s) URL is required');
    expect(navigations).toEqual([]);
  });

  it('resolves a relative URL against the current page', async () => {
    const result = await browserToolService.executeTool('navigate', { url: '/next' }, 'do');

    expect(result.success).toBe(true);
    result.afterResponseAttempt?.();

    expect(navigations).toEqual(['https://host.test/next']);
  });
});

describe('navigate reports what the browser did with a new tab', () => {
  it('succeeds when the popup really opened', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);

    const result = await browserToolService.executeTool(
      'navigate',
      { url: 'https://host.test/next', new_tab: true },
      'do',
    );

    expect(open).toHaveBeenCalledWith('https://host.test/next', '_blank');
    expect(result.success).toBe(true);
  });

  it('fails when a popup blocker refuses it', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);

    const result = await browserToolService.executeTool(
      'navigate',
      { url: 'https://host.test/next', new_tab: true },
      'do',
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('The browser blocked opening a new tab');
  });
});

describe('close_tab reports what the browser did', () => {
  it('fails when the browser refuses to close a tab the script did not open', async () => {
    vi.spyOn(window, 'close').mockImplementation(() => {});

    const result = await browserToolService.executeTool('close_tab', {}, 'do');

    expect(result.success).toBe(false);
  });

  it('succeeds when the tab really closed', async () => {
    vi.spyOn(window, 'close').mockImplementation(() => {
      Object.defineProperty(window, 'closed', { configurable: true, value: true });
    });

    const result = await browserToolService.executeTool('close_tab', {}, 'do');

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
    expect(browserToolService.getFriendlyToolName('upload_file')).toBe('upload_file');
    expect(browserToolService.isWaitForUserTool('upload_file')).toBe(false);
  });
});

describe('a run the model ends is not a widget tool failure', () => {
  it('reports finish as executed when the agent sends only the closing message', async () => {
    const result = await browserToolService.executeTool(
      FINISH_TOOL,
      { message: 'Could not find the checkout button' },
      'do',
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ text: 'Could not find the checkout button' });
  });
});
