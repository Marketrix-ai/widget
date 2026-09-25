/**
 * Every browser action the agent can ask the widget to take on the host page, as one registry keyed by
 * the contract's tool names.
 * `TOOLS` maps each action to its handler; `executeTool` runs a call, through Show mode when the step waits
 * for the visitor, and reports any failure to the agent.
 * A link is followed only if it is http(s), since a page-controlled href could run script in the host origin.
 */

import type { WidgetEvent, WidgetToolResult } from '../sdk';
import type { InstructionType } from '../types';
import { toolExplanation, waitsForUser } from '../utils/chat';
import { errorMessage } from '../utils/errors';
import { domService } from './DomService';
import { isTextField, setFieldValue, simulateKeyAction } from './keySimulation';
import { activeScreenStream } from './ScreenShareService';
import { ShowModeCancelled, showModeService } from './ShowModeService';

type ToolFailure = { success: false; error: string; cancelled?: true };

type ToolExecutionResult<T extends WidgetToolResult = { text: string }> =
  { success: true; result: T; afterResponseAttempt?: () => void } | ToolFailure;

export type WidgetToolCall = Extract<WidgetEvent, { type: 'tool/call' }>;
export type WidgetToolName = WidgetToolCall['browser_tool'];
type ToolArgMap = { [K in WidgetToolName]: Extract<WidgetToolCall, { browser_tool: K }>['args'] };
export type ToolArgs<K extends WidgetToolName> = ToolArgMap[K];

const ok = (text: string): ToolExecutionResult => ({ success: true, result: { text } });
const okResult = <T extends WidgetToolResult>(result: T): ToolExecutionResult<T> => ({ success: true, result });
const fail = (error: string): ToolFailure => ({ success: false, error });
const deferred = (text: string, action: () => void): ToolExecutionResult => ({
  success: true,
  result: { text },
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

function elementAt(index: number): HTMLElement {
  const validated = domService.getValidatedElement(index);
  if (!validated.element) throw new Error(validated.error);
  return validated.element;
}

function selectAt(index: number): HTMLSelectElement {
  const found = elementAt(index);
  if (!(found instanceof HTMLSelectElement)) throw new Error(`Element ${index} is not a select element`);
  return found;
}

function navigate(args: ToolArgs<'navigate'>): ToolExecutionResult {
  const url = httpUrl(args.url);
  if (!url) return fail('An http(s) URL is required');

  if (args.new_tab) {
    return window.open(url, '_blank') ? ok(`Opened ${url} in new tab`) : fail('The browser blocked opening a new tab');
  }
  return deferred(`Navigating to ${url}`, () => {
    window.location.href = url;
  });
}

function search({ query, engine }: ToolArgs<'search'>): ToolExecutionResult {
  if (!query) return fail('Query is required');
  const url = SEARCH_URLS[engine] + encodeURIComponent(query);
  return deferred(`Searching for "${query}" on ${engine}`, () => {
    window.location.href = url;
  });
}

async function clickElement(args: ToolArgs<'click_element'>): Promise<ToolExecutionResult> {
  const element = elementAt(args.index);

  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await new Promise(resolve => setTimeout(resolve, 100));

  return deferred(`Clicking element ${args.index}`, () => element.click());
}

function typeText({ index, text, clear }: ToolArgs<'type_text'>): ToolExecutionResult {
  const element = elementAt(index);

  if (isTextField(element)) {
    element.focus();
    setFieldValue(element, clear ? text : element.value + text);
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  } else if (element.isContentEditable) {
    element.focus();
    const selection = window.getSelection();
    if (clear) selection?.selectAllChildren(element);
    else selection?.collapse(element, element.childNodes.length);

    if (!document.execCommand('insertText', false, text)) {
      return fail(`Could not insert text into element ${index}`);
    }
  } else if (element instanceof HTMLSelectElement) {
    element.value = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    element.textContent = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  return ok(`Typed text into element ${index}`);
}

function scroll({ direction, pages }: ToolArgs<'scroll'>): ToolExecutionResult {
  const sign = direction === 'down' ? 1 : -1;
  window.scrollBy({ top: sign * window.innerHeight * pages, behavior: 'smooth' });
  return ok(`Scrolled ${direction} ${pages} page(s)`);
}

function scrollToText({ text }: ToolArgs<'scroll_to_text'>): ToolExecutionResult {
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

function extract({ extract_links }: ToolArgs<'extract'>) {
  return okResult({
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

function goBack(): ToolExecutionResult {
  if (window.history.length <= 1) return fail('No history');
  return deferred('Going back', () => window.history.back());
}

async function wait({ seconds }: ToolArgs<'wait'>): Promise<ToolExecutionResult> {
  await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  return ok(`Waited ${seconds}s`);
}

function selectDropdownOption({ index, option }: ToolArgs<'select_dropdown_option'>): ToolExecutionResult {
  if (!option) return fail('Option required');

  const element = selectAt(index);
  const opt = Array.from(element.options).find(o => o.value === option || o.text === option);
  if (!opt) return fail(`Option ${option} not found`);

  element.value = opt.value;
  element.dispatchEvent(new Event('change', { bubbles: true }));

  return ok(`Selected ${option}`);
}

function getDropdownOptions({ index }: ToolArgs<'get_dropdown_options'>) {
  const options = Array.from(selectAt(index).options).map(o => ({ value: o.value, text: o.text }));
  return okResult({ options });
}

function sendKeys({ index, keys }: ToolArgs<'send_keys'>): ToolExecutionResult {
  const element = elementAt(index);
  element.focus();
  element.dispatchEvent(new KeyboardEvent('keydown', { key: keys, bubbles: true, cancelable: true }));
  element.dispatchEvent(new KeyboardEvent('keyup', { key: keys, bubbles: true, cancelable: true }));

  return ok(simulateKeyAction(element, keys));
}

function closeTab(): ToolExecutionResult {
  window.close();
  return window.closed ? ok('Tab closed') : fail('The browser refused to close a tab this script did not open');
}

async function getScreenshot(): Promise<ToolExecutionResult> {
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

const TOOLS: {
  [K in WidgetToolName]: (
    args: ToolArgMap[K],
  ) => ToolExecutionResult<WidgetToolResult> | Promise<ToolExecutionResult<WidgetToolResult>>;
} = {
  navigate,
  search,
  click_element: clickElement,
  type_text: typeText,
  scroll,
  scroll_to_text: scrollToText,
  extract,
  go_back: goBack,
  wait,
  select_dropdown_option: selectDropdownOption,
  get_dropdown_options: getDropdownOptions,
  send_keys: sendKeys,
  close_tab: closeTab,
  done: args => ok(args.message),
  get_html: () => ok(domService.reindexAndSnapshot()),
  get_screenshot: getScreenshot,
};

export async function executeTool<K extends WidgetToolName>(
  browserToolName: K,
  args: ToolArgs<K>,
  mode: InstructionType,
  explanation?: string,
): Promise<ToolExecutionResult<WidgetToolResult>> {
  const run: (
    args: ToolArgs<K>,
  ) => ToolExecutionResult<WidgetToolResult> | Promise<ToolExecutionResult<WidgetToolResult>> = TOOLS[browserToolName];
  try {
    if (mode === 'show' && waitsForUser(browserToolName) && 'index' in args) {
      await showModeService.showToolAction({
        element: elementAt(args.index),
        index: args.index,
        explanation: toolExplanation(browserToolName, explanation),
        browserToolName,
      });
    }
    return await run(args);
  } catch (error) {
    return error instanceof ShowModeCancelled ? { ...fail(error.message), cancelled: true } : fail(errorMessage(error));
  }
}
