/**
 * Every browser action the agent can ask the widget to take on the host page, as one registry keyed by
 * the contract's tool names, so a tool the contract adds fails to compile until it has a handler.
 *
 * `tools` lists each action's label, whether it waits for the visitor, and its handler. `executeTool`
 * runs a call through Show mode's highlight-and-wait step when needed and returns the result.
 *
 * A handler throws rather than returning an error, since one place — `executeTool`'s catch — reports
 * every failure back to the agent. A link is only followed if it is http(s), since an extracted href
 * is page-controlled and could otherwise run script in the host page's own origin. `upload_file` always
 * fails: browsers never let a page script choose a file on the visitor's behalf.
 */

import type { WidgetEvent } from '../sdk';
import type { InstructionType } from '../types';
import { errorMessage } from '../utils/errors';
import { domService } from './DomService';
import { isTextField, setNativeValue, simulateKeyAction } from './keySimulation';
import { activeScreenStream } from './ScreenShareService';
import { ShowModeCancelled, showModeService } from './ShowModeService';

interface TextData {
  text: string;
}

interface ExtractData {
  title: string;
  url: string;
  text: string;
  links: Array<{ text: string; href: string | null }>;
}

interface DropdownOptionsData {
  options: Array<{ value: string; text: string }>;
}

type ToolFailure = { success: false; error: string; cancelled?: true };

export type ToolExecutionResult<T = TextData> =
  { success: true; data: T; afterResponseAttempt?: () => void } | ToolFailure;

export type WidgetToolCall = Extract<WidgetEvent, { type: 'tool/call' }>;
export type WidgetToolName = WidgetToolCall['browser_tool'];
type ToolArgMap = { [K in WidgetToolName]: Extract<WidgetToolCall, { browser_tool: K }>['args'] };
export type ToolArgs<K extends WidgetToolName> = ToolArgMap[K];

const ok = (text: string): ToolExecutionResult => ({ success: true, data: { text } });
const okData = <T>(data: T): ToolExecutionResult<T> => ({ success: true, data });
const fail = (error: string): ToolFailure => ({ success: false, error });
const deferred = (text: string, action: () => void): ToolExecutionResult => ({
  success: true,
  data: { text },
  afterResponseAttempt: action,
});

const httpUrl = (value: string): string | null => {
  try {
    const url = new URL(value, window.location.href);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

const SCREENSHOT_FRAME_TIMEOUT_MS = 5000;

const SEARCH_URLS: Record<ToolArgs<'search'>['engine'], string> = {
  duckduckgo: 'https://duckduckgo.com/?q=',
  google: 'https://www.google.com/search?q=',
  bing: 'https://www.bing.com/search?q=',
};

interface WidgetToolDef<K extends WidgetToolName> {
  label: string;
  waitForUser?: boolean;
  run: (args: ToolArgMap[K]) => ToolExecutionResult<unknown> | Promise<ToolExecutionResult<unknown>>;
}

export class BrowserToolService {
  private readonly tools: { [K in WidgetToolName]: WidgetToolDef<K> } = {
    navigate: { label: 'Navigating', run: args => this.navigate(args) },
    search: { label: 'Searching', run: args => this.search(args) },
    click_element: { label: 'Clicking element', waitForUser: true, run: args => this.clickElement(args) },
    type_text: { label: 'Typing text', waitForUser: true, run: args => this.typeText(args) },
    scroll: { label: 'Scrolling', run: args => this.scroll(args) },
    scroll_to_text: { label: 'Scrolling to text', run: args => this.scrollToText(args) },
    extract: { label: 'Extracting content', run: args => this.extract(args) },
    go_back: { label: 'Going back', run: () => this.goBack() },
    wait: { label: 'Waiting', run: args => this.wait(args) },
    select_dropdown_option: {
      label: 'Selecting option',
      waitForUser: true,
      run: args => this.selectDropdownOption(args),
    },
    get_dropdown_options: { label: 'Reading dropdown options', run: args => this.getDropdownOptions(args) },
    send_keys: { label: 'Pressing key', waitForUser: true, run: args => this.sendKeys(args) },
    close_tab: { label: 'Closing tab', run: () => this.closeTab() },
    upload_file: {
      label: 'Uploading file',
      run: () => fail('A web page cannot pick a file for the visitor; ask them to upload it themselves'),
    },
    done: { label: 'Done', run: args => ok(args.message) },
    get_html: { label: 'Reading the page', run: () => ok(domService.reindexAndSnapshot()) },
    get_screenshot: { label: 'Taking screenshot', run: () => this.getScreenshot() },
  };

  private element(index: number): HTMLElement {
    const { element, error } = domService.getValidatedElement(index);
    if (!element) throw new Error(error || `Element ${index} not found`);
    return element;
  }

  private selectElement(index: number): HTMLSelectElement {
    const element = this.element(index);
    if (!(element instanceof HTMLSelectElement)) throw new Error(`Element ${index} is not a select element`);
    return element;
  }

  getFriendlyToolName(browserToolName: WidgetToolName): string {
    return this.tools[browserToolName].label;
  }

  isWaitForUserTool(browserToolName: WidgetToolName): boolean {
    return !!this.tools[browserToolName].waitForUser;
  }

  async executeTool<K extends WidgetToolName>(
    browserToolName: K,
    args: ToolArgs<K>,
    mode: InstructionType,
    explanation = '',
  ): Promise<ToolExecutionResult<unknown>> {
    const tool: WidgetToolDef<K> = this.tools[browserToolName];
    try {
      if (mode === 'show' && tool.waitForUser && 'index' in args) {
        await showModeService.showToolAction({
          element: this.element(args.index),
          explanation: explanation || `Execute ${browserToolName}`,
          browserToolName,
          isClickAction: browserToolName === 'click_element',
        });
      }
      return await tool.run(args);
    } catch (error) {
      return error instanceof ShowModeCancelled
        ? { ...fail(error.message), cancelled: true }
        : fail(errorMessage(error));
    }
  }

  private navigate(args: ToolArgs<'navigate'>): ToolExecutionResult {
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

  private search({ query, engine }: ToolArgs<'search'>): ToolExecutionResult {
    if (!query) return fail('Query is required');
    const url = SEARCH_URLS[engine] + encodeURIComponent(query);
    return deferred(`Searching for "${query}" on ${engine}`, () => {
      window.location.href = url;
    });
  }

  private async clickElement(args: ToolArgs<'click_element'>): Promise<ToolExecutionResult> {
    const element = this.element(args.index);

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(resolve => setTimeout(resolve, 100));

    return deferred(`Clicking element ${args.index}`, () => element.click());
  }

  private typeText({ index, text, clear }: ToolArgs<'type_text'>): ToolExecutionResult {
    const element = this.element(index);

    if (isTextField(element)) {
      element.focus();
      setNativeValue(element, clear ? text : element.value + text);

      element.dispatchEvent(
        new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }),
      );
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true }));
    } else if (element.isContentEditable) {
      element.focus();
      const selection = window.getSelection();
      if (clear) selection?.selectAllChildren(element);
      else selection?.collapse(element, element.childNodes.length);

      if (!document.execCommand('insertText', false, text)) {
        return fail(`Could not insert text into element ${index}`);
      }
    } else if ('value' in element) {
      (element as HTMLInputElement).value = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      element.textContent = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    return ok(`Typed text into element ${index}`);
  }

  private scroll({ direction, pages }: ToolArgs<'scroll'>): ToolExecutionResult {
    const sign = direction === 'down' ? 1 : -1;
    window.scrollBy({ top: sign * window.innerHeight * pages, behavior: 'smooth' });
    return ok(`Scrolled ${direction} ${pages} page(s)`);
  }

  private scrollToText({ text }: ToolArgs<'scroll_to_text'>): ToolExecutionResult {
    if (!text) return fail('Text required');

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.textContent?.includes(text)) {
        node.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return ok(`Scrolled to "${text}"`);
      }
    }
    return fail(`Text "${text}" not found`);
  }

  private extract({ extract_links }: ToolArgs<'extract'>): ToolExecutionResult<ExtractData> {
    return okData({
      title: document.title,
      url: window.location.href,
      text: document.body.innerText.slice(0, 10000),
      links: extract_links
        ? Array.from(document.querySelectorAll('a[href]'))
            .slice(0, 100)
            .map(a => ({ text: a.textContent?.trim() || '', href: a.getAttribute('href') }))
        : [],
    });
  }

  private goBack(): ToolExecutionResult {
    if (window.history.length <= 1) return fail('No history');
    return deferred('Going back', () => window.history.back());
  }

  private async wait({ seconds }: ToolArgs<'wait'>): Promise<ToolExecutionResult> {
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    return ok(`Waited ${seconds}s`);
  }

  private selectDropdownOption({ index, option }: ToolArgs<'select_dropdown_option'>): ToolExecutionResult {
    if (!option) return fail('Option required');

    const element = this.selectElement(index);
    const opt = Array.from(element.options).find(o => o.value === option || o.text === option);
    if (!opt) return fail(`Option ${option} not found`);

    element.value = opt.value;
    element.dispatchEvent(new Event('change', { bubbles: true }));

    return ok(`Selected ${option}`);
  }

  private getDropdownOptions({ index }: ToolArgs<'get_dropdown_options'>): ToolExecutionResult<DropdownOptionsData> {
    const options = Array.from(this.selectElement(index).options).map(o => ({ value: o.value, text: o.text }));
    return okData({ options });
  }

  private sendKeys({ index, keys }: ToolArgs<'send_keys'>): ToolExecutionResult {
    const element = this.element(index);
    element.focus();
    element.dispatchEvent(new KeyboardEvent('keydown', { key: keys, bubbles: true, cancelable: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { key: keys, bubbles: true, cancelable: true }));

    return ok(simulateKeyAction(element, keys) ?? `Sent keys ${keys}`);
  }

  private closeTab(): ToolExecutionResult {
    window.close();
    return window.closed ? ok('Tab closed') : fail('The browser refused to close a tab this script did not open');
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
    } finally {
      video.remove();
    }
  }
}

export const browserToolService = new BrowserToolService();
