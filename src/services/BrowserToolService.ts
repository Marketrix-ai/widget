/**
 * Every browser action the agent can ask the widget to take on the HOST page, as one name → handler
 * registry (`tools`: label, wait-for-user flag and handler together, so no parallel list can drift);
 * `getFriendlyToolName` and `isWaitForUserTool` read it, `browserToolService` is the singleton.
 * `ChatContext` calls `executeTool` — in `show` mode it highlights the target and waits for the visitor
 * first — and posts back a `ToolExecutionResult`: `TextData`, `ExtractData`, `DropdownOptionsData` or a failure.
 *
 * Handlers: navigate · search · clickElement · typeText (input/textarea, contenteditable, any `value`,
 * else textContent; trailing `blur` because some frameworks validate only on it) · scroll · scrollToText ·
 * extract (10k cap) · goBack · wait · selectDropdownOption · getDropdownOptions · sendKeys · closeTab ·
 * done (`FINISH_TOOL`, one named export so dispatch, progress lines and settlement check one string) ·
 * getHtml, uncapped because the agent's parser indexes by `data-id` and a trimmed tree loses elements the
 * loop then cannot click · getScreenshot, off the EXISTING share since a fresh prompt bypasses a Deny.
 *
 * `deferred` reports an action DISPATCHED, never completed: a click or navigation can tear the page down
 * before the report is read. `httpUrl` admits only http(s) — `extract` feeds the model page-controlled
 * hrefs, so a raw target would let `javascript:` run in the HOST origin. `simulateKeyAction` reproduces
 * each key by hand because synthetic KeyboardEvents run no default action, returning null for keys
 * `sendKeys` already dispatched; `setNativeValue` writes through the prototype setter for React/Vue inputs.
 */

import type { InstructionType } from '../types';
import { errorMessage } from '../utils/errors';
import { domService } from './DomService';
import { activeScreenStream } from './ScreenShareService';
import { showModeService } from './ShowModeService';

export interface TextData {
  text: string;
}

export interface ExtractData {
  title: string;
  url: string;
  text: string;
  links: Array<{ text: string; href: string | null }>;
}

export interface DropdownOptionsData {
  options: Array<{ value: string; text: string }>;
}

type ToolFailure = { success: false; error: string };

export type ToolExecutionResult<T = TextData> =
  { success: true; data: T; afterResponseAttempt?: () => void } | ToolFailure;

interface ToolArgs {
  clear?: boolean;
  direction?: 'up' | 'down' | 'left' | 'right';
  engine?: 'duckduckgo' | 'google' | 'bing';
  extract_links?: boolean;
  index?: number;
  keys?: string;
  message?: string;
  new_tab?: boolean;
  option?: string;
  query?: string;
  seconds?: number;
  text?: string;
  url?: string;
}

const ok = (text: string): ToolExecutionResult => ({ success: true, data: { text } });
const okData = <T>(data: T): ToolExecutionResult<T> => ({ success: true, data });
const fail = (error: string): ToolFailure => ({ success: false, error });
const deferred = (text: string, action: () => void): ToolExecutionResult => ({
  success: true,
  data: { text },
  afterResponseAttempt: action,
});

const httpUrl = (value: string | undefined): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.href);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

const SCREENSHOT_FRAME_TIMEOUT_MS = 5000;

const TAB_ORDER_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const FINISH_TOOL = 'finish';

interface WidgetToolDef {
  label: string;
  waitForUser?: boolean;
  run: (args: ToolArgs) => ToolExecutionResult<unknown> | Promise<ToolExecutionResult<unknown>>;
}

export class BrowserToolService {
  private readonly tools: Record<string, WidgetToolDef> = {
    navigate: { label: 'Navigating', run: args => this.navigate(args) },
    search_web: { label: 'Searching', run: args => this.search(args) },
    click_element: { label: 'Clicking element', waitForUser: true, run: args => this.clickElement(args) },
    type_text: { label: 'Typing text', waitForUser: true, run: args => this.typeText(args) },
    scroll: { label: 'Scrolling', run: args => this.scroll(args) },
    scroll_to_text: { label: 'Scrolling to text', run: args => this.scrollToText(args) },
    extract: { label: 'Extracting content', run: args => this.extract(args) },
    go_back: { label: 'Going back', run: () => this.goBack() },
    wait_seconds: { label: 'Waiting', run: args => this.wait(args) },
    select_dropdown: { label: 'Selecting option', waitForUser: true, run: args => this.selectDropdownOption(args) },
    get_dropdown_options: { label: 'Reading dropdown options', run: args => this.getDropdownOptions(args) },
    send_keys: { label: 'Pressing key', waitForUser: true, run: args => this.sendKeys(args) },
    close_tab: { label: 'Closing tab', run: () => this.closeTab() },
    [FINISH_TOOL]: { label: 'Done', run: args => this.done(args) },
    get_html: { label: 'Reading the page', run: () => this.getHtml() },
    get_screenshot: { label: 'Taking screenshot', run: () => this.getScreenshot() },
  };

  getFriendlyToolName(browserToolName: string): string {
    return this.tools[browserToolName]?.label ?? browserToolName;
  }

  isWaitForUserTool(browserToolName: string): boolean {
    return !!this.tools[browserToolName]?.waitForUser;
  }

  async executeTool(
    browserToolName: string,
    args: Record<string, unknown>,
    mode: InstructionType,
    explanation = '',
  ): Promise<ToolExecutionResult<unknown>> {
    const toolArgs = args as ToolArgs;
    const tool = this.tools[browserToolName];
    try {
      console.log(`[BrowserToolService] Executing ${browserToolName} (mode: ${mode})`);

      if (mode === 'show' && tool?.waitForUser) {
        const index = toolArgs.index;
        if (index !== undefined) {
          const { element, error } = domService.getValidatedElement(index);
          if (!element) return fail(error || `Element ${index} not found`);

          await showModeService.showToolAction({
            element,
            explanation: explanation || `Execute ${browserToolName}`,
            browserToolName,
            isClickAction: browserToolName === 'click_element',
          });
        }
      }

      return tool ? await tool.run(toolArgs) : fail(`Unknown tool: ${browserToolName}`);
    } catch (error) {
      return fail(errorMessage(error));
    }
  }

  private navigate(args: ToolArgs): ToolExecutionResult {
    const url = httpUrl(args.url);
    if (!url) return fail('An http(s) URL is required');

    if (args.new_tab) {
      return window.open(url, '_blank')
        ? ok(`Opened ${url} in new tab`)
        : fail('The browser blocked opening a new tab');
    }
    return deferred(`Navigating to ${url}`, () => {
      window.location.href = url;
    });
  }

  private search(args: ToolArgs): ToolExecutionResult {
    if (!args.query) return fail('Query is required');

    const engine = args.engine || 'duckduckgo';
    const encoded = encodeURIComponent(args.query);
    let url = `https://duckduckgo.com/?q=${encoded}`;

    if (engine === 'google') url = `https://www.google.com/search?q=${encoded}`;
    if (engine === 'bing') url = `https://www.bing.com/search?q=${encoded}`;

    return deferred(`Searching for "${args.query}" on ${engine}`, () => {
      window.location.href = url;
    });
  }

  private async clickElement(args: ToolArgs): Promise<ToolExecutionResult> {
    if (args.index === undefined) return fail('Index required');

    const { element, error } = domService.getValidatedElement(args.index);
    if (!element) return fail(error || `Element ${args.index} not found`);

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(resolve => setTimeout(resolve, 100));

    return deferred(`Clicking element ${args.index}`, () => element.click());
  }

  private typeText(args: ToolArgs): ToolExecutionResult {
    if (args.index === undefined || args.text === undefined) return fail('Index and text required');

    const clear = args.clear !== false;

    const { element, error } = domService.getValidatedElement(args.index);
    if (!element) return fail(error || `Element ${args.index} not found`);

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.focus();
      this.setNativeValue(element, clear ? args.text : element.value + args.text);

      element.dispatchEvent(
        new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: args.text }),
      );
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true }));
    } else if (element.isContentEditable) {
      element.focus();
      const selection = window.getSelection();
      if (clear) selection?.selectAllChildren(element);
      else selection?.collapse(element, element.childNodes.length);

      if (!document.execCommand('insertText', false, args.text)) {
        return fail(`Could not insert text into element ${args.index}`);
      }
    } else if ('value' in element) {
      try {
        (element as HTMLInputElement).value = args.text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {
        return fail(`Failed to set value on element: ${errorMessage(e)}`);
      }
    } else {
      try {
        element.textContent = args.text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (e) {
        return fail(`Failed to set textContent: ${errorMessage(e)}`);
      }
    }

    return ok(`Typed text into element ${args.index}`);
  }

  private scroll(args: ToolArgs): ToolExecutionResult {
    const amount = window.innerHeight * 0.8;

    switch (args.direction) {
      case 'down':
        window.scrollBy({ top: amount, behavior: 'smooth' });
        break;
      case 'up':
        window.scrollBy({ top: -amount, behavior: 'smooth' });
        break;
      case 'left':
        window.scrollBy({ left: -amount, behavior: 'smooth' });
        break;
      case 'right':
        window.scrollBy({ left: amount, behavior: 'smooth' });
        break;
      default:
        return fail('Invalid direction');
    }
    return ok(`Scrolled ${args.direction}`);
  }

  private scrollToText(args: ToolArgs): ToolExecutionResult {
    if (!args.text) return fail('Text required');

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.textContent?.includes(args.text) && node.parentElement) {
        node.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return ok(`Scrolled to "${args.text}"`);
      }
    }
    return fail(`Text "${args.text}" not found`);
  }

  private extract(args: ToolArgs): ToolExecutionResult<ExtractData> {
    const includeLinks = args.extract_links !== false;
    const extractResult: ExtractData = {
      title: document.title,
      url: window.location.href,
      text: document.body.innerText.slice(0, 10000),
      links: includeLinks
        ? Array.from(document.querySelectorAll('a[href]'))
            .slice(0, 100)
            .map(a => ({
              text: a.textContent?.trim() || '',
              href: a.getAttribute('href'),
            }))
        : [],
    };
    return okData(extractResult);
  }

  private goBack(): ToolExecutionResult {
    if (window.history.length <= 1) return fail('No history');
    return deferred('Going back', () => window.history.back());
  }

  private async wait({ seconds }: ToolArgs): Promise<ToolExecutionResult> {
    if (seconds === undefined) return fail('Seconds required');
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    return ok(`Waited ${seconds}s`);
  }

  private selectDropdownOption(args: ToolArgs): ToolExecutionResult {
    if (args.index === undefined || !args.option) return fail('Index/Option required');

    const { element, error } = domService.getValidatedElement(args.index);
    if (!element) return fail(error || `Select ${args.index} not found`);

    if (!(element instanceof HTMLSelectElement)) {
      return fail(`Element ${args.index} is not a select element`);
    }

    const opt = Array.from(element.options).find(o => o.value === args.option || o.text === args.option);
    if (!opt) return fail(`Option ${args.option} not found`);

    element.value = opt.value;
    element.dispatchEvent(new Event('change', { bubbles: true }));

    return ok(`Selected ${args.option}`);
  }

  private getDropdownOptions(args: ToolArgs): ToolExecutionResult<DropdownOptionsData> {
    const index = args.index;
    if (index === undefined) return fail('Index required');

    const { element, error } = domService.getValidatedElement(index);
    if (!element) return fail(error || `Select ${index} not found`);

    if (!(element instanceof HTMLSelectElement)) {
      return fail(`Element ${index} is not a select element`);
    }

    const options = Array.from(element.options).map(o => ({ value: o.value, text: o.text }));
    return okData({ options });
  }

  private sendKeys(args: ToolArgs): ToolExecutionResult {
    if (args.index === undefined || !args.keys) return fail('Index/Keys required');

    const { element, error } = domService.getValidatedElement(args.index);
    if (!element) return fail(error || `Element ${args.index} not found`);

    element.focus();
    element.dispatchEvent(new KeyboardEvent('keydown', { key: args.keys, bubbles: true, cancelable: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { key: args.keys, bubbles: true, cancelable: true }));

    const actionResult = this.simulateKeyAction(element, args.keys);

    return ok(actionResult || `Sent keys ${args.keys}`);
  }

  private simulateKeyAction(element: HTMLElement, key: string): string | null {
    switch (key) {
      case 'Tab':
      case 'Shift+Tab': {
        const step = key === 'Tab' ? 1 : -1;
        const focusables = Array.from(document.querySelectorAll<HTMLElement>(TAB_ORDER_SELECTOR)).filter(
          el => el.offsetParent !== null,
        );
        const currentIndex = focusables.indexOf(element);
        const next = currentIndex === -1 ? undefined : focusables[currentIndex + step];
        if (!next) return `${key}: no ${step > 0 ? 'next' : 'previous'} focusable element`;
        next.focus();
        return `${key}: moved focus to ${next.tagName.toLowerCase()}${next.id ? `#${next.id}` : ''}`;
      }

      case 'Enter': {
        if (element instanceof HTMLButtonElement || element.getAttribute('role') === 'button') {
          element.click();
          return 'Enter: clicked button';
        }
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          const form = element.closest('form');
          if (form) {
            const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"], input[type="submit"]');
            if (submitBtn) {
              submitBtn.click();
              return 'Enter: clicked form submit button';
            } else {
              form.requestSubmit();
              return 'Enter: submitted form';
            }
          }
        }
        if (element instanceof HTMLAnchorElement) {
          element.click();
          return 'Enter: clicked link';
        }
        return 'Enter: dispatched event';
      }

      case 'Escape': {
        element.blur();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        return 'Escape: blurred element and dispatched to document';
      }

      case ' ':
      case 'Space': {
        if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
          element.click();
          return `Space: toggled ${element.type}`;
        }
        if (element instanceof HTMLButtonElement || element.getAttribute('role') === 'button') {
          element.click();
          return 'Space: clicked button';
        }
        return 'Space: dispatched event';
      }

      case 'ArrowDown': {
        if (element instanceof HTMLSelectElement) {
          const currentIdx = element.selectedIndex;
          if (currentIdx < element.options.length - 1) {
            element.selectedIndex = currentIdx + 1;
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return `ArrowDown: selected "${element.options[element.selectedIndex].text}"`;
          }
          return 'ArrowDown: already at last option';
        }
        return 'ArrowDown: dispatched event';
      }

      case 'ArrowUp': {
        if (element instanceof HTMLSelectElement) {
          const currentIdx = element.selectedIndex;
          if (currentIdx > 0) {
            element.selectedIndex = currentIdx - 1;
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return `ArrowUp: selected "${element.options[element.selectedIndex].text}"`;
          }
          return 'ArrowUp: already at first option';
        }
        return 'ArrowUp: dispatched event';
      }

      case 'Home': {
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          element.setSelectionRange(0, 0);
          return 'Home: moved cursor to start';
        }
        return 'Home: dispatched event';
      }

      case 'End': {
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          const len = element.value.length;
          element.setSelectionRange(len, len);
          return 'End: moved cursor to end';
        }
        return 'End: dispatched event';
      }

      case 'Backspace': {
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          const value = element.value;

          if (!value || value.length === 0) {
            return 'Backspace: input is empty, nothing to delete';
          }

          const start: number = element.selectionStart ?? value.length;
          const end: number = element.selectionEnd ?? value.length;

          let newValue: string;
          let newCursorPos: number;

          if (start === end && start > 0) {
            newValue = value.slice(0, start - 1) + value.slice(end);
            newCursorPos = start - 1;
          } else if (start !== end) {
            newValue = value.slice(0, start) + value.slice(end);
            newCursorPos = start;
          } else {
            return 'Backspace: cursor at start, nothing to delete';
          }

          this.setValueAndCaret(element, newValue, newCursorPos);

          return `Backspace: deleted character, value is now "${newValue}"`;
        }
        return 'Backspace: dispatched event';
      }

      case 'Delete': {
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          const start = element.selectionStart || 0;
          const end = element.selectionEnd || 0;
          const value = element.value;

          let newValue: string;

          if (start === end && start < value.length) {
            newValue = value.slice(0, start) + value.slice(end + 1);
          } else if (start !== end) {
            newValue = value.slice(0, start) + value.slice(end);
          } else {
            return 'Delete: cursor at end, nothing to delete';
          }

          this.setValueAndCaret(element, newValue, start);

          return `Delete: deleted character, value is now "${newValue}"`;
        }
        return 'Delete: dispatched event';
      }

      default:
        return null;
    }
  }

  private setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    const setter = Object.getOwnPropertyDescriptor(
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value',
    )?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
  }

  private setValueAndCaret(el: HTMLInputElement | HTMLTextAreaElement, value: string, caret: number): void {
    this.setNativeValue(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.setSelectionRange(caret, caret);
  }

  private closeTab(): ToolExecutionResult {
    window.close();
    return window.closed ? ok('Tab closed') : fail('The browser refused to close a tab this script did not open');
  }

  private done(args: ToolArgs): ToolExecutionResult {
    return ok(args.message || 'Task ended');
  }

  private getHtml(): ToolExecutionResult {
    try {
      const html = domService.reindexAndSnapshot();
      return ok(html);
    } catch (error) {
      return fail(errorMessage(error));
    }
  }

  private async getScreenshot(): Promise<ToolExecutionResult> {
    const stream = activeScreenStream();
    if (!stream) return fail('The visitor is not sharing their screen.');

    const video = document.createElement('video');
    try {
      video.srcObject = stream;
      video.autoplay = true;
      video.style.display = 'none';
      document.body.appendChild(video);

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('Screen capture produced no frame')),
          SCREENSHOT_FRAME_TIMEOUT_MS,
        );
        video.onloadeddata = () => {
          clearTimeout(timer);
          resolve();
        };
        video.onerror = () => {
          clearTimeout(timer);
          reject(new Error('Screen capture failed'));
        };
      });

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return fail('Could not read the shared screen: the browser refused a 2d canvas context.');
      ctx.drawImage(video, 0, 0);

      return ok(canvas.toDataURL('image/jpeg', 0.75));
    } catch (error) {
      return fail(errorMessage(error));
    } finally {
      video.remove();
    }
  }
}

export const browserToolService = new BrowserToolService();
