import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { browserToolService } from '../BrowserToolService';

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

    result.afterResponseSent?.();

    expect(navigations).toEqual(['https://host.test/next']);
  });

  it('search holds the navigation until the response is sent', async () => {
    const result = await browserToolService.executeTool('search', { query: 'widgets' });

    expect(navigations).toEqual([]);

    result.afterResponseSent?.();

    expect(navigations).toEqual(['https://duckduckgo.com/?q=widgets']);
  });

  it('go_back holds the history move until the response is sent', async () => {
    window.history.pushState({}, '', '/second');
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});

    const result = await browserToolService.executeTool('go_back', {});

    expect(back).not.toHaveBeenCalled();

    result.afterResponseSent?.();

    expect(back).toHaveBeenCalledOnce();
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
