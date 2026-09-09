/**
 * Every browser action the agent can ask the widget to take on the HOST page, as one name → handler
 * registry: `tools` holds label, wait-for-user flag and handler together so no parallel list can drift, and
 * `executeTool` in `show` mode highlights the target and waits for the visitor before running the handler.
 *
 * `typeText` trails a `blur` because some frameworks validate only on it. `extract` truncates at 10k while
 * `getHtml` is uncapped — the agent's parser indexes by `data-id`, and a trimmed tree loses elements the
 * loop then cannot click. `getScreenshot` reads the EXISTING share, since a fresh prompt bypasses an
 * earlier Deny. `FINISH_TOOL` is one named export so dispatch, progress lines and the settlement check read
 * one string. `sendKeys` dispatches the KeyboardEvent and delegates the default action the browser
 * withholds to `keySimulation`. `deferred` reports an action DISPATCHED, never completed: a click or
 * navigation can tear the page down before the report is read.
 *
 * `element` / `selectElement` are the ONE way a handler reaches a host-page node: they resolve an index
 * through `domService` and THROW. `executeTool`'s catch is this file's ONLY error handler and no handler
 * may add a second — a throw already reaches the agent verbatim, so a local try/catch just rewrites the
 * same failure. `httpUrl` admits only http(s) — `extract` feeds the model page-controlled hrefs, so a raw
 * target would let `javascript:` run in the HOST origin; its bare catch is the same verdict as a rejected
 * protocol, an unparseable string being exactly a value that is not a URL.
 */

import type { InstructionType } from '../types';
import { errorMessage } from '../utils/errors';
import { domService } from './DomService';
import { isTextField, setNativeValue, simulateKeyAction } from './keySimulation';
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

  private element(index: number | undefined): HTMLElement {
    if (index === undefined) throw new Error('Index required');
    const { element, error } = domService.getValidatedElement(index);
    if (!element) throw new Error(error || `Element ${index} not found`);
    return element;
  }

  private selectElement(index: number | undefined): HTMLSelectElement {
    const element = this.element(index);
    if (!(element instanceof HTMLSelectElement)) throw new Error(`Element ${index} is not a select element`);
    return element;
  }

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
      if (mode === 'show' && tool?.waitForUser && toolArgs.index !== undefined) {
        await showModeService.showToolAction({
          element: this.element(toolArgs.index),
          explanation: explanation || `Execute ${browserToolName}`,
          browserToolName,
          isClickAction: browserToolName === 'click_element',
        });
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
    const element = this.element(args.index);

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(resolve => setTimeout(resolve, 100));

    return deferred(`Clicking element ${args.index}`, () => element.click());
  }

  private typeText(args: ToolArgs): ToolExecutionResult {
    if (args.text === undefined) return fail('Text required');

    const clear = args.clear !== false;
    const element = this.element(args.index);

    if (isTextField(element)) {
      element.focus();
      setNativeValue(element, clear ? args.text : element.value + args.text);

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
      (element as HTMLInputElement).value = args.text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      element.textContent = args.text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
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
    if (!args.option) return fail('Option required');

    const element = this.selectElement(args.index);
    const opt = Array.from(element.options).find(o => o.value === args.option || o.text === args.option);
    if (!opt) return fail(`Option ${args.option} not found`);

    element.value = opt.value;
    element.dispatchEvent(new Event('change', { bubbles: true }));

    return ok(`Selected ${args.option}`);
  }

  private getDropdownOptions(args: ToolArgs): ToolExecutionResult<DropdownOptionsData> {
    const options = Array.from(this.selectElement(args.index).options).map(o => ({ value: o.value, text: o.text }));
    return okData({ options });
  }

  private sendKeys(args: ToolArgs): ToolExecutionResult {
    if (!args.keys) return fail('Keys required');

    const element = this.element(args.index);
    element.focus();
    element.dispatchEvent(new KeyboardEvent('keydown', { key: args.keys, bubbles: true, cancelable: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { key: args.keys, bubbles: true, cancelable: true }));

    const actionResult = simulateKeyAction(element, args.keys);

    return ok(actionResult || `Sent keys ${args.keys}`);
  }

  private closeTab(): ToolExecutionResult {
    window.close();
    return window.closed ? ok('Tab closed') : fail('The browser refused to close a tab this script did not open');
  }

  private done(args: ToolArgs): ToolExecutionResult {
    return ok(args.message || 'Task ended');
  }

  private getHtml(): ToolExecutionResult {
    return ok(domService.reindexAndSnapshot());
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
