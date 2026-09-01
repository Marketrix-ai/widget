import { WAIT_FOR_USER_TOOLS } from '../utils/chat';
import { domService } from './DomService';
import { startScreenShare } from './ScreenShareService';
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

export interface ToolExecutionResult<T = TextData> {
  success: boolean;
  data: T;
  error?: string;
}

/** One shape for every widget tool's arguments: the wire carries a bare JSON object, so nothing is
 * guaranteed present and each handler guards the fields it needs. */
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
  success?: boolean;
  text?: string;
  url?: string;
}

const ok = (text: string): ToolExecutionResult => ({ success: true, data: { text } });
const okData = <T>(data: T): ToolExecutionResult<T> => ({ success: true, data });
const fail = (error: string): ToolExecutionResult => ({ success: false, data: { text: '' }, error });
const failOptions = (error: string): ToolExecutionResult<DropdownOptionsData> => ({
  success: false,
  data: { options: [] },
  error,
});

const TAB_ORDER_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export class BrowserToolService {
  async executeTool(
    browserToolName: string,
    args: Record<string, unknown>,
    mode: string = 'do',
    explanation: string = '',
  ): Promise<ToolExecutionResult<unknown>> {
    const toolArgs = args as ToolArgs;
    try {
      console.log(`[BrowserToolService] Executing ${browserToolName} (mode: ${mode})`);

      if (mode === 'show' && WAIT_FOR_USER_TOOLS.has(browserToolName)) {
        const index = toolArgs.index;
        if (index !== undefined) {
          const { element, error } = domService.getValidatedElement(index);
          if (!element) return fail(error || `Element ${index} not found`);

          const confirmed = await showModeService.showToolAction({
            element,
            explanation: explanation || `Execute ${browserToolName}`,
            browserToolName,
            isClickAction: browserToolName === 'click_element',
          });

          if (!confirmed) {
            return fail('User cancelled action');
          }
        }
      }

      switch (browserToolName) {
        case 'navigate':
          return this.navigate(toolArgs);
        case 'search':
          return this.search(toolArgs);
        case 'click_element':
          return await this.clickElement(toolArgs);
        case 'type_text':
          return this.typeText(toolArgs);
        case 'scroll':
          return this.scroll(toolArgs);
        case 'scroll_to_text':
          return this.scrollToText(toolArgs);
        case 'extract':
          return this.extract(toolArgs);
        case 'go_back':
          return this.goBack();
        case 'wait':
          return await this.wait(toolArgs);
        case 'select_dropdown_option':
          return this.selectDropdownOption(toolArgs);
        case 'get_dropdown_options':
          return this.getDropdownOptions(toolArgs);
        case 'send_keys':
          return this.sendKeys(toolArgs);
        case 'upload_file':
          return this.uploadFile();
        case 'close_tab':
          return this.closeTab();
        case 'done':
          return this.done(toolArgs);
        case 'get_html':
          return this.getHtml();
        case 'get_screenshot':
          return await this.getScreenshot();
        default:
          return fail(`Unknown tool: ${browserToolName}`);
      }
    } catch (error) {
      showModeService.cleanup();
      return fail(error instanceof Error ? error.message : String(error));
    }
  }

  private navigate(args: ToolArgs): ToolExecutionResult {
    if (!args.url) return fail('URL is required');

    if (args.new_tab) {
      window.open(args.url, '_blank');
      return ok(`Opened ${args.url} in new tab`);
    }
    window.location.href = args.url;
    return ok(`Navigating to ${args.url}`);
  }

  private search(args: ToolArgs): ToolExecutionResult {
    if (!args.query) return fail('Query is required');

    const engine = args.engine || 'duckduckgo';
    const encoded = encodeURIComponent(args.query);
    let url = `https://duckduckgo.com/?q=${encoded}`;

    if (engine === 'google') url = `https://www.google.com/search?q=${encoded}`;
    if (engine === 'bing') url = `https://www.bing.com/search?q=${encoded}`;

    window.location.href = url;
    return ok(`Searching for "${args.query}" on ${engine}`);
  }

  private async clickElement(args: ToolArgs): Promise<ToolExecutionResult> {
    if (args.index === undefined) return fail('Index required');

    const { element, error } = domService.getValidatedElement(args.index);
    if (!element) return fail(error || `Element ${args.index} not found`);

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(resolve => setTimeout(resolve, 100));

    setTimeout(() => {
      try {
        element.click();
      } catch (e) {
        console.warn('[BrowserToolService] Click error:', e);
        try {
          element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        } catch (fallbackError) {
          console.warn('[BrowserToolService] Fallback click failed:', fallbackError);
        }
      }
    }, 50);

    return ok(`Clicked element ${args.index}`);
  }

  private typeText(args: ToolArgs): ToolExecutionResult {
    if (args.index === undefined || args.text === undefined) return fail('Index and text required');

    const clear = args.clear !== false;

    const { element, error } = domService.getValidatedElement(args.index);
    if (!element) return fail(error || `Element ${args.index} not found`);

    const isInputLike =
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      (element as HTMLElement).isContentEditable;

    if (isInputLike) {
      const inputElement = element as HTMLInputElement | HTMLTextAreaElement;

      try {
        inputElement.focus();
      } catch (e) {
        console.warn('[BrowserToolService] Focus failed:', e);
      }

      const finalValue = clear ? args.text : inputElement.value + args.text;

      let lastError: unknown = null;
      const attempt = (name: string, set: () => boolean): boolean => {
        try {
          return set();
        } catch (e) {
          lastError = e;
          console.warn(`[BrowserToolService] ${name} failed:`, e);
          return false;
        }
      };

      // Ordered by fidelity: React tracks the prototype setter and reverts a plain `.value =`; execCommand acts on
      // the editing host rather than the JS object, so it is the only path left once an assignment has thrown.
      const valueSet =
        attempt('Native setter', () => {
          const isTextArea = inputElement.tagName.toUpperCase() === 'TEXTAREA';
          const descriptor = Object.getOwnPropertyDescriptor(
            isTextArea ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
            'value',
          );
          if (!descriptor?.set) return false;
          descriptor.set.call(inputElement, finalValue);
          return true;
        }) ||
        attempt('Direct assignment', () => {
          inputElement.value = finalValue;
          return true;
        }) ||
        attempt('execCommand', () => {
          inputElement.focus();
          if (clear) inputElement.select();
          return document.execCommand('insertText', false, args.text);
        });

      if (!valueSet) {
        return fail(`Failed to set value: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
      }

      try {
        const inputEvent = new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: args.text,
        });
        inputElement.dispatchEvent(inputEvent);

        inputElement.dispatchEvent(new Event('change', { bubbles: true }));

        // Some frameworks need blur to trigger validation
        inputElement.dispatchEvent(new Event('blur', { bubbles: true }));
      } catch (e) {
        console.warn('[BrowserToolService] Event dispatch failed:', e);
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
    if (window.history.length > 1) {
      window.history.back();
      return ok('Navigated back');
    }
    return fail('No history');
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
    if (index === undefined) return failOptions('Index required');

    const { element, error } = domService.getValidatedElement(index);
    if (!element) return failOptions(error || `Select ${index} not found`);

    if (!(element instanceof HTMLSelectElement)) {
      return failOptions(`Element ${index} is not a select element`);
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

  /** Programmatic KeyboardEvents aren't "trusted", so manually reproduce each key's expected behavior. */
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
        // Dispatch to document too, for modal close handlers.
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

          let start: number = element.selectionStart ?? value.length;
          let end: number = element.selectionEnd ?? value.length;

          // Cursor at 0 with no known position → delete from the end instead.
          if (start === 0 && end === 0) {
            start = value.length;
            end = value.length;
          }

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
        // The caller already dispatched the generic key events.
        return null;
    }
  }

  /** Native value setter so React/Vue controlled inputs pick up the change. */
  private setValueAndCaret(el: HTMLInputElement | HTMLTextAreaElement, value: string, caret: number): void {
    const setter = Object.getOwnPropertyDescriptor(
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value',
    )?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.setSelectionRange(caret, caret);
  }

  private uploadFile(): ToolExecutionResult {
    return fail('File upload not supported via script');
  }

  private closeTab(): ToolExecutionResult {
    window.close();
    return ok('Attempted close');
  }

  private done(args: ToolArgs): ToolExecutionResult {
    if (args.success === undefined) {
      return fail('success parameter is required');
    }
    const resultMessage = args.message || (args.success ? 'Task completed' : 'Task failed');
    return ok(resultMessage);
  }

  private getHtml(): ToolExecutionResult {
    try {
      const html = domService.getSnapshotHtml();
      return ok(html);
    } catch (error) {
      return fail(String(error));
    }
  }

  private async getScreenshot(): Promise<ToolExecutionResult> {
    try {
      const stream = await startScreenShare();
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.style.display = 'none';
      document.body.appendChild(video);

      await new Promise<void>(resolve => {
        video.onloadeddata = () => resolve();
      });

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);

      const base64 = canvas.toDataURL('image/jpeg', 0.75);

      video.remove();
      // Keep the stream alive — the agent usually requests a screenshot then keeps going; startScreenShare handles reuse.

      return ok(base64);
    } catch (error) {
      return fail(String(error));
    }
  }
}

export const browserToolService = new BrowserToolService();
