/**
 * Tests for `BrowserToolService`'s tool execution: navigation tools defer until their response is
 * sent, inputs are validated and failures come back as typed results rather than thrown, and Show
 * mode's default explanation and click-dedupe behavior.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { browserToolService, FINISH_TOOL, type ToolExecutionResult } from '../BrowserToolService';
import { domService } from '../DomService';
import { showModeService } from '../ShowModeService';

type ToolSuccess<T> = Extract<ToolExecutionResult<T>, { success: true }>;
type ToolFailure<T> = Extract<ToolExecutionResult<T>, { success: false }>;

function assertSuccess<T>(result: ToolExecutionResult<T>): asserts result is ToolSuccess<T> {
  if (!result.success) throw new Error(`expected success, got failure: ${result.error}`);
}

function assertFailure<T>(result: ToolExecutionResult<T>): asserts result is ToolFailure<T> {
  if (result.success) throw new Error('expected failure, got success');
}

function expectFailure<T>(result: ToolExecutionResult<T>, error: string): void {
  expect(result.success).toBe(false);
  assertFailure(result);
  expect(result.error).toBe(error);
}

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
    assertSuccess(result);
    expect(navigations).toEqual([]);

    result.afterResponseAttempt?.();

    expect(navigations).toEqual(['https://host.test/next']);
  });

  it('search_web holds the navigation until the response is sent', async () => {
    const result = await browserToolService.executeTool('search_web', { query: 'widgets' }, 'do');

    expect(navigations).toEqual([]);
    assertSuccess(result);

    result.afterResponseAttempt?.();

    expect(navigations).toEqual(['https://duckduckgo.com/?q=widgets']);
  });

  it('go_back holds the history move until the response is sent', async () => {
    window.history.pushState({}, '', '/second');
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});

    const result = await browserToolService.executeTool('go_back', {}, 'do');

    expect(back).not.toHaveBeenCalled();
    assertSuccess(result);

    result.afterResponseAttempt?.();

    expect(back).toHaveBeenCalledTimes(1);
  });
});

describe('navigate constrains its target to http(s)', () => {
  it('refuses a javascript: URL instead of running it in the host page', async () => {
    const result = await browserToolService.executeTool('navigate', { url: 'javascript:alert(document.cookie)' }, 'do');

    expectFailure(result, 'An http(s) URL is required');
    expect(navigations).toEqual([]);
  });

  it('resolves a relative URL against the current page', async () => {
    const result = await browserToolService.executeTool('navigate', { url: '/next' }, 'do');

    expect(result.success).toBe(true);
    assertSuccess(result);
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

    expectFailure(result, 'The browser blocked opening a new tab');
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

    expectFailure(result, 'Unknown tool: upload_file');
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
    assertSuccess(result);
    expect(result.data).toEqual({ text: 'Could not find the checkout button' });
  });
});

describe('a Do tool call against a missing index fails typed, never throws', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = () => {};
  });

  it.each(['click_element', 'type_text', 'send_keys', 'select_dropdown', 'get_dropdown_options'])(
    '%s reports element-not-found instead of throwing out of the loop',
    async toolName => {
      const result = await browserToolService.executeTool(
        toolName,
        { index: 999, text: 'x', keys: 'Enter', option: 'x' },
        'do',
      );

      expectFailure(result, 'Element 999 not found');
    },
  );

  it('selecting a dropdown on a non-select element is rejected as typed, not thrown', async () => {
    document.body.innerHTML = '<input style="position: fixed" />';
    vi.spyOn(domService, 'getValidatedElement').mockReturnValue({ element: document.querySelector('input') });

    const result = await browserToolService.executeTool('select_dropdown', { index: 0, option: 'x' }, 'do');

    expectFailure(result, 'Element 0 is not a select element');
  });
});

describe('typeText writes through the same native setter for input and textarea', () => {
  it.each(['input', 'textarea'])('produces identical resulting value and event order for %s', async tag => {
    document.body.innerHTML = `<${tag} style="position: fixed"></${tag}>`;
    const element = document.querySelector(tag) as HTMLInputElement | HTMLTextAreaElement;
    vi.spyOn(domService, 'getValidatedElement').mockReturnValue({ element });
    const seen: string[] = [];
    for (const type of ['input', 'change', 'blur']) element.addEventListener(type, e => seen.push(e.type));

    const result = await browserToolService.executeTool('type_text', { index: 0, text: 'hello' }, 'do');

    expect(result.success).toBe(true);
    expect(element.value).toBe('hello');
    expect(seen).toEqual(['input', 'change', 'blur']);
  });
});

describe("show mode's real visitor click reaches the element's handler exactly once", () => {
  beforeEach(() => {
    Element.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, width: 10, height: 10 }) as DOMRect;
    document.elementFromPoint = () => null;
    Element.prototype.scrollIntoView = () => {};
  });

  afterEach(() => {
    showModeService.cleanup();
  });

  it('fires the deferred click once, not once for the staging click and once for the confirm', async () => {
    document.body.innerHTML = '<button style="position: fixed">Buy</button>';
    const button = document.querySelector('button') as HTMLButtonElement;
    domService.reindexAndSnapshot();
    let clicks = 0;
    button.addEventListener('click', () => clicks++);

    const pending = browserToolService.executeTool('click_element', { index: 0 }, 'show', 'Click Buy');
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));

    const result = await pending;
    assertSuccess(result);
    expect(clicks).toBe(0);

    result.afterResponseAttempt?.();
    expect(clicks).toBe(1);
  });
});

describe('a missing element surfaces the reason domService gave', () => {
  it('uses the specific reason instead of the generic not-found message', async () => {
    vi.spyOn(domService, 'getValidatedElement').mockReturnValue({
      element: null,
      error: 'Element 0 is not currently visible',
    });

    const result = await browserToolService.executeTool('click_element', { index: 0 }, 'do');

    expectFailure(result, 'Element 0 is not currently visible');
  });
});

describe("show mode's default explanation only fills in a blank one", () => {
  beforeEach(() => {
    document.body.innerHTML = '<button style="position: fixed">Buy</button>';
    Element.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, width: 10, height: 10 }) as DOMRect;
    document.elementFromPoint = () => null;
    Element.prototype.scrollIntoView = () => {};
    domService.reindexAndSnapshot();
  });

  afterEach(() => {
    showModeService.cleanup();
  });

  it('passes the caller-supplied explanation through unchanged', async () => {
    const staged = vi.spyOn(showModeService, 'showToolAction').mockResolvedValue();

    await browserToolService.executeTool('click_element', { index: 0 }, 'show', 'Click the Buy button');

    expect(staged).toHaveBeenCalledWith(expect.objectContaining({ explanation: 'Click the Buy button' }));
  });

  it('falls back to a generated explanation when the caller leaves it blank', async () => {
    const staged = vi.spyOn(showModeService, 'showToolAction').mockResolvedValue();

    await browserToolService.executeTool('click_element', { index: 0 }, 'show');

    expect(staged).toHaveBeenCalledWith(expect.objectContaining({ explanation: 'Execute click_element' }));
  });
});

describe('search_web picks the engine URL by name', () => {
  it.each([
    ['google', 'https://www.google.com/search?q=widgets'],
    ['bing', 'https://www.bing.com/search?q=widgets'],
    [undefined, 'https://duckduckgo.com/?q=widgets'],
  ] as const)('engine %s', async (engine, expectedUrl) => {
    const result = await browserToolService.executeTool('search_web', { query: 'widgets', engine }, 'do');

    assertSuccess(result);
    result.afterResponseAttempt?.();
    expect(navigations).toEqual([expectedUrl]);
  });
});

describe('typeText branches beyond input/textarea', () => {
  beforeEach(() => {
    domService.reindexAndSnapshot();
  });

  it('appends instead of replacing when clear is false', async () => {
    document.body.innerHTML = '<input style="position: fixed" value="existing-" />';
    const element = document.querySelector('input') as HTMLInputElement;
    vi.spyOn(domService, 'getValidatedElement').mockReturnValue({ element });

    const result = await browserToolService.executeTool('type_text', { index: 0, text: 'more', clear: false }, 'do');

    expect(result.success).toBe(true);
    expect(element.value).toBe('existing-more');
  });

  it('writes through execCommand on a contentEditable element', async () => {
    document.body.innerHTML = '<div style="position: fixed"></div>';
    const element = document.querySelector('div') as HTMLElement;
    Object.defineProperty(element, 'isContentEditable', { value: true });
    vi.spyOn(domService, 'getValidatedElement').mockReturnValue({ element });
    const execCommand = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: typeof execCommand }).execCommand = execCommand;

    const result = await browserToolService.executeTool('type_text', { index: 0, text: 'hello' }, 'do');

    expect(result.success).toBe(true);
    expect(execCommand).toHaveBeenCalledWith('insertText', false, 'hello');
  });

  it('sets .value directly on a non-text-field element that exposes one, like a select', async () => {
    document.body.innerHTML = '<select style="position: fixed"><option value="x">x</option></select>';
    const element = document.querySelector('select') as HTMLSelectElement;
    vi.spyOn(domService, 'getValidatedElement').mockReturnValue({ element });

    const result = await browserToolService.executeTool('type_text', { index: 0, text: 'x' }, 'do');

    expect(result.success).toBe(true);
    expect(element.value).toBe('x');
  });
});

describe('extract', () => {
  const stubInnerText = () =>
    Object.defineProperty(document.body, 'innerText', { configurable: true, value: document.body.textContent });

  it('includes link text, falling back to empty string rather than a falsy DOM read', async () => {
    document.body.innerHTML = '<a href="/a"></a><a href="/b">Bought</a>';
    stubInnerText();

    const result = await browserToolService.executeTool('extract', {}, 'do');

    assertSuccess(result);
    const data = result.data as { links: Array<{ text: string; href: string | null }> };
    expect(data.links).toEqual([
      { text: '', href: '/a' },
      { text: 'Bought', href: '/b' },
    ]);
  });

  it('omits links entirely when extract_links is false', async () => {
    document.body.innerHTML = '<a href="/a">A</a>';
    stubInnerText();

    const result = await browserToolService.executeTool('extract', { extract_links: false }, 'do');

    assertSuccess(result);
    expect((result.data as { links: unknown[] }).links).toEqual([]);
  });
});

describe('goBack refuses when there is no history to go back to', () => {
  it('fails with no history when history.length is 1', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window.history, 'length');
    Object.defineProperty(window.history, 'length', { configurable: true, get: () => 1 });

    const result = await browserToolService.executeTool('go_back', {}, 'do');

    expectFailure(result, 'No history');
    if (descriptor) Object.defineProperty(window.history, 'length', descriptor);
  });
});

describe('wait_seconds requires seconds', () => {
  it('fails without seconds and succeeds with them', async () => {
    const missing = await browserToolService.executeTool('wait_seconds', {}, 'do');
    expectFailure(missing, 'Seconds required');

    const succeeded = await browserToolService.executeTool('wait_seconds', { seconds: 0 }, 'do');
    expect(succeeded.success).toBe(true);
  });
});

describe('selectDropdownOption matches by value OR by visible text', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<select style="position: fixed"><option value="v1">Text One</option><option value="v2">Text Two</option></select>';
    vi.spyOn(domService, 'getValidatedElement').mockReturnValue({
      element: document.querySelector('select') as HTMLSelectElement,
    });
  });

  it('matches an option by its value', async () => {
    const result = await browserToolService.executeTool('select_dropdown', { index: 0, option: 'v2' }, 'do');
    expect(result.success).toBe(true);
    expect((document.querySelector('select') as HTMLSelectElement).value).toBe('v2');
  });

  it('matches an option by its visible text when the value differs', async () => {
    const result = await browserToolService.executeTool('select_dropdown', { index: 0, option: 'Text One' }, 'do');
    expect(result.success).toBe(true);
    expect((document.querySelector('select') as HTMLSelectElement).value).toBe('v1');
  });
});

describe('sendKeys falls back to a generic message only when the key has no reported effect', () => {
  it('reports the specific effect for a handled key', async () => {
    document.body.innerHTML = '<input style="position: fixed" value="abc" />';
    const element = document.querySelector('input') as HTMLInputElement;
    element.focus();
    element.setSelectionRange(0, 0);
    vi.spyOn(domService, 'getValidatedElement').mockReturnValue({ element });

    const result = await browserToolService.executeTool('send_keys', { index: 0, keys: 'End' }, 'do');

    assertSuccess(result);
    expect(result.data).toEqual({ text: 'End: moved cursor to end' });
  });

  it('falls back to the generic "Sent keys" message for a key with no reported effect', async () => {
    document.body.innerHTML = '<div tabindex="0" style="position: fixed"></div>';
    const element = document.querySelector('div') as HTMLElement;
    vi.spyOn(domService, 'getValidatedElement').mockReturnValue({ element });

    const result = await browserToolService.executeTool('send_keys', { index: 0, keys: 'F1' }, 'do');

    assertSuccess(result);
    expect(result.data).toEqual({ text: 'Sent keys F1' });
  });
});
