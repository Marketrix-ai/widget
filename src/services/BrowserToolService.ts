/**
 * Every browser action the agent can ask the widget to take on the HOST page, as one name → handler
 * registry: `ChatContext` validates a `tool/call`'s `browser_tool`, calls `executeTool`, and posts the
 * outcome back as `tool/response`.
 *
 * Results: `TextData`, `ExtractData` and `DropdownOptionsData` are the payloads a handler can return
 * inside `ToolExecutionResult`, a success-or-`ToolFailure` union built by `ok`, `okData` and `fail`.
 * `deferred` builds a success carrying an `afterResponseAttempt` callback — it reports the action as
 * DISPATCHED, never completed, because a click or navigation can tear the page down before the report is
 * read, so the report goes out first and the deed lands after.
 *
 * `ToolArgs` is one shape for every tool's arguments: the wire carries a bare JSON object, so nothing is
 * guaranteed present and each handler guards the fields it needs. `httpUrl` resolves a candidate against
 * the current document and admits only http(s) — model output can be steered by page content it just read
 * (`extract` returns every `a[href]`), so a navigation target is untrusted input, and passing it through
 * raw would let a `javascript:` URL run in the HOST PAGE's origin via `window.location`. `FINISH_TOOL` is
 * the agent's completion signal, one named export so dispatch, progress-line suppression and task
 * settlement all check the same name instead of copies of the string.
 *
 * `BrowserToolService.tools` is the one registry: a tool's name, label, wait-for-user flag and handler
 * (`WidgetToolDef`) live together, so no separate label list or wait-for-user set can drift from it.
 * `getFriendlyToolName` and `isWaitForUserTool` read it; `executeTool` dispatches through it and, in
 * `show` mode for a wait-for-user tool given an index, first highlights the target through
 * `showModeService` and waits for the visitor. `browserToolService` is the shared singleton.
 *
 * Handlers: `navigate` opens a new tab or defers a same-tab location assignment · `search` defers one to
 * DuckDuckGo (default), Google or Bing · `clickElement` scrolls the element into view, settles, then
 * defers the click · `typeText` writes through the four input flavours (native input/textarea,
 * contenteditable via `execCommand`, anything else carrying a `value`, else `textContent`), appending
 * unless `clear`, and fires a trailing `blur` because some frameworks validate only on it · `scroll`
 * moves 80% of the viewport · `scrollToText` walks text nodes for the first match · `extract` returns
 * title, url, capped body text and links · `goBack` defers a history step and refuses an empty history ·
 * `wait` sleeps for `seconds` · `selectDropdownOption` and `getDropdownOptions`, both rejecting a
 * non-`<select>` · `sendKeys` dispatches the generic key events, then `simulateKeyAction` · `closeTab`,
 * which reports failure because a tab this script did not open cannot be closed · `done`, the
 * FINISH_TOOL handler · `getHtml`, which re-indexes and snapshots the whole document for the agent's
 * parser · `getScreenshot`, which grabs one frame off the visitor's EXISTING share, never prompting for
 * a new one (that would bypass a visitor's Deny), times out rather than waiting forever on a stream that
 * delivers no frame, and always removes its offscreen video from the host page.
 *
 * `simulateKeyAction` reproduces each key's expected behaviour by hand, because programmatic
 * KeyboardEvents are not "trusted" and the browser runs no default action for them: Tab/Shift+Tab move
 * focus along `TAB_ORDER_SELECTOR` (visible elements only), Enter activates a button/link or submits the
 * enclosing form, Escape blurs AND re-dispatches to `document` so modal close handlers see it, Space
 * toggles a checkbox/radio or clicks a button, the Arrow keys step a `<select>`, Home/End move the caret,
 * and Backspace/Delete edit the value themselves. It returns null for any other key, whose generic
 * keydown/keyup `sendKeys` has already dispatched. `setNativeValue` writes through the prototype's
 * `value` setter so React/Vue controlled inputs pick up the change; `setValueAndCaret` adds the
 * input/change events and caret restore the editing keys need.
 */

import type { InstructionType } from '../types';
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
      return fail(error instanceof Error ? error.message : String(error));
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
        return fail(`Failed to set value on element: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      try {
        element.textContent = args.text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (e) {
        return fail(`Failed to set textContent: ${e instanceof Error ? e.message : String(e)}`);
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
      return fail(String(error));
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
      return fail(String(error));
    } finally {
      video.remove();
    }
  }
}

export const browserToolService = new BrowserToolService();
