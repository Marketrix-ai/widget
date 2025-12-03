import { domService } from './DomService';
import { startScreenShare } from './ScreenShareService';
import { showModeService } from './ShowModeService';

export interface ToolExecutionResult {
  success: boolean;
  result: string;
  error?: string;
}

export class ToolExecutionService {
  private static instance: ToolExecutionService;

  private constructor() {}

  static getInstance(): ToolExecutionService {
    if (!ToolExecutionService.instance) {
      ToolExecutionService.instance = new ToolExecutionService();
    }
    return ToolExecutionService.instance;
  }

  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    mode: string = 'do',
    explanation: string = ''
  ): Promise<ToolExecutionResult> {
    try {
      console.log(`[ToolExecutionService] Executing ${toolName} (mode: ${mode})`);

      if (mode === 'show' && this.requiresHighlight(toolName)) {
        const index = args.index as number | undefined;
        if (index !== undefined) {
          const element = domService.getElementByIndex(index);
          if (element) {
            const confirmed = await (showModeService as any).showToolAction({
              element,
              explanation: explanation || `Execute ${toolName}`,
              toolName,
              toolParams: args,
              isClickAction: toolName === 'click_element',
            });

            if (!confirmed) {
              return { success: false, result: '', error: 'User cancelled action' };
            }

            if (toolName === 'click_element') {
              // Execute the click after confirmation
              // We proceed to the switch case below to actually execute the click
            } else if (
              toolName === 'type_text' ||
              toolName === 'select_dropdown_option' ||
              toolName === 'send_keys'
            ) {
              // Execute the action after confirmation
              // We proceed to the switch case below to actually execute the action
            } else {
              // For other tools, proceed to execute as well if they were highlighted
            }
          }
        }
      }

      switch (toolName) {
        case 'navigate':
          return this.navigate(args);
        case 'search':
          return this.search(args);
        case 'click_element':
          return await this.clickElement(args);
        case 'type_text':
          return this.typeText(args);
        case 'scroll':
          return this.scroll(args);
        case 'scroll_to_text':
          return this.scrollToText(args);
        case 'extract':
          return this.extract(args);
        case 'go_back':
          return this.goBack();
        case 'wait':
          return await this.wait(args);
        case 'select_dropdown_option':
          return this.selectDropdownOption(args);
        case 'get_dropdown_options':
          return this.getDropdownOptions(args);
        case 'send_keys':
          return this.sendKeys(args);
        case 'upload_file':
          return this.uploadFile(args);
        case 'close_tab':
          return this.closeTab();
        case 'switch_tab':
          return this.switchTab(args);
        case 'done':
          return this.done(args);
        case 'get_html':
          return this.getHtml();
        case 'get_screenshot':
          return await this.getScreenshot();
        default:
          return { success: false, result: '', error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      // @ts-ignore - showModeService might have typing issues in some envs, but it's valid
      (showModeService as any).cleanup();
      return {
        success: false,
        result: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private requiresHighlight(toolName: string): boolean {
    return [
      'click_element',
      'type_text',
      'select_dropdown_option',
      'send_keys',
      'upload_file',
    ].includes(toolName);
  }

  private navigate(args: Record<string, unknown>): ToolExecutionResult {
    const url = args.url as string;
    if (!url) return { success: false, result: '', error: 'URL is required' };

    if (args.new_tab) {
      window.open(url, '_blank');
      return { success: true, result: `Opened ${url} in new tab` };
    } else {
      window.location.href = url;
      return { success: true, result: `Navigating to ${url}` };
    }
  }

  private search(args: Record<string, unknown>): ToolExecutionResult {
    const query = args.query as string;
    if (!query) return { success: false, result: '', error: 'Query is required' };

    const engine = (args.engine as string) || 'duckduckgo';
    const encoded = encodeURIComponent(query);
    let url = `https://duckduckgo.com/?q=${encoded}`;

    if (engine === 'google') url = `https://www.google.com/search?q=${encoded}`;
    if (engine === 'bing') url = `https://www.bing.com/search?q=${encoded}`;

    window.location.href = url;
    return { success: true, result: `Searching for "${query}" on ${engine}` };
  }

  private async clickElement(args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const index = args.index as number;
    if (index === undefined) return { success: false, result: '', error: 'Index required' };

    const element = domService.getElementByIndex(index);
    if (!element) return { success: false, result: '', error: `Element ${index} not found` };

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise((resolve) => setTimeout(resolve, 100));
    // Defer the click to allow the tool response to be sent first
    setTimeout(() => {
      try {
        if (element instanceof HTMLElement) {
          element.click();
        } else {
          // Fallback for SVG/other elements
          const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
          });
          (element as any).dispatchEvent(clickEvent);
        }
      } catch (e) {
        console.warn('[ToolExecutionService] Click triggered an error on the page:', e);
      }
    }, 50);

    return { success: true, result: `Clicked element ${index}` };
  }

  private typeText(args: Record<string, unknown>): ToolExecutionResult {
    const index = args.index as number;
    const text = args.text as string;
    if (index === undefined || text === undefined)
      return { success: false, result: '', error: 'Index and text required' };

    const element = domService.getElementByIndex(index);
    if (!element) return { success: false, result: '', error: `Element ${index} not found` };

    if ('value' in element) {
      (element as HTMLInputElement).value = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      element.textContent = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    return { success: true, result: `Typed text into element ${index}` };
  }

  private scroll(args: Record<string, unknown>): ToolExecutionResult {
    const direction = ((args.direction as string) || '').toLowerCase();
    const amount = window.innerHeight * 0.8;

    switch (direction) {
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
        return { success: false, result: '', error: 'Invalid direction' };
    }
    return { success: true, result: `Scrolled ${direction}` };
  }

  private scrollToText(args: Record<string, unknown>): ToolExecutionResult {
    const text = args.text as string;
    if (!text) return { success: false, result: '', error: 'Text required' };

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.textContent?.includes(text) && node.parentElement) {
        node.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return { success: true, result: `Scrolled to "${text}"` };
      }
    }
    return { success: false, result: '', error: `Text "${text}" not found` };
  }

  private extract(_args: Record<string, unknown>): ToolExecutionResult {
    const result = {
      title: document.title,
      url: window.location.href,
      text: document.body.innerText.substring(0, 10000),
      links: Array.from(document.querySelectorAll('a[href]'))
        .slice(0, 100)
        .map((a) => ({
          text: a.textContent?.trim() || '',
          href: a.getAttribute('href'),
        })),
    };
    return { success: true, result: JSON.stringify(result) };
  }

  private goBack(): ToolExecutionResult {
    if (window.history.length > 1) {
      window.history.back();
      return { success: true, result: 'Navigated back' };
    }
    return { success: false, result: '', error: 'No history' };
  }

  private async wait(args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const seconds = args.seconds as number;
    if (seconds === undefined) return { success: false, result: '', error: 'Seconds required' };
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    return { success: true, result: `Waited ${seconds}s` };
  }

  private selectDropdownOption(args: Record<string, unknown>): ToolExecutionResult {
    const index = args.index as number;
    const option = args.option as string;
    if (index === undefined || !option)
      return { success: false, result: '', error: 'Index/Option required' };

    const element = domService.getElementByIndex(index);
    if (!element || !(element instanceof HTMLSelectElement)) {
      return { success: false, result: '', error: `Select ${index} not found` };
    }

    const opt = Array.from(element.options).find((o) => o.value === option || o.text === option);
    if (!opt) return { success: false, result: '', error: `Option ${option} not found` };

    element.value = opt.value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return { success: true, result: `Selected ${option}` };
  }

  private getDropdownOptions(args: Record<string, unknown>): ToolExecutionResult {
    const index = args.index as number;
    const element = domService.getElementByIndex(index);
    if (!element || !(element instanceof HTMLSelectElement)) {
      return { success: false, result: '', error: `Select ${index} not found` };
    }
    const options = Array.from(element.options).map((o) => ({ value: o.value, text: o.text }));
    return { success: true, result: JSON.stringify(options) };
  }

  private sendKeys(args: Record<string, unknown>): ToolExecutionResult {
    const index = args.index as number;
    const keys = args.keys as string;
    if (index === undefined || !keys)
      return { success: false, result: '', error: 'Index/Keys required' };

    const element = domService.getElementByIndex(index);
    if (!element) return { success: false, result: '', error: `Element ${index} not found` };

    // Focus the element first
    element.focus();

    // Dispatch keyboard events (for custom event handlers)
    element.dispatchEvent(
      new KeyboardEvent('keydown', { key: keys, bubbles: true, cancelable: true })
    );
    element.dispatchEvent(
      new KeyboardEvent('keyup', { key: keys, bubbles: true, cancelable: true })
    );

    // Simulate actual browser behavior for common keys
    const actionResult = this.simulateKeyAction(element, keys);

    return { success: true, result: actionResult || `Sent keys ${keys}` };
  }

  /**
   * Simulate actual browser behavior for special keys
   * Since programmatic KeyboardEvents are not "trusted", we need to
   * manually trigger the expected behavior
   */
  private simulateKeyAction(element: HTMLElement, key: string): string | null {
    switch (key) {
      case 'Tab': {
        // Move focus to next focusable element
        const focusables = Array.from(
          document.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null); // Only visible elements

        const currentIndex = focusables.indexOf(element);
        if (currentIndex !== -1 && currentIndex < focusables.length - 1) {
          const nextElement = focusables[currentIndex + 1];
          nextElement.focus();
          return `Tab: moved focus to ${nextElement.tagName.toLowerCase()}${nextElement.id ? `#${nextElement.id}` : ''}`;
        }
        return 'Tab: no next focusable element';
      }

      case 'Shift+Tab': {
        // Move focus to previous focusable element
        const focusables = Array.from(
          document.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);

        const currentIndex = focusables.indexOf(element);
        if (currentIndex > 0) {
          const prevElement = focusables[currentIndex - 1];
          prevElement.focus();
          return `Shift+Tab: moved focus to ${prevElement.tagName.toLowerCase()}${prevElement.id ? `#${prevElement.id}` : ''}`;
        }
        return 'Shift+Tab: no previous focusable element';
      }

      case 'Enter': {
        // Submit form or click button
        if (element instanceof HTMLButtonElement || element.getAttribute('role') === 'button') {
          element.click();
          return 'Enter: clicked button';
        }
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          const form = element.closest('form');
          if (form) {
            // Find submit button and click it, or submit form
            const submitBtn = form.querySelector<HTMLButtonElement>(
              'button[type="submit"], input[type="submit"]'
            );
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
        // Blur current element (common behavior)
        element.blur();
        // Also dispatch to document for modal close handlers
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
        );
        return 'Escape: blurred element and dispatched to document';
      }

      case ' ':
      case 'Space': {
        // Click checkboxes, radio buttons, or buttons
        if (
          element instanceof HTMLInputElement &&
          (element.type === 'checkbox' || element.type === 'radio')
        ) {
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
        // For select elements, move to next option
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
        // For select elements, move to previous option
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
        // For inputs, move cursor to start
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          element.setSelectionRange(0, 0);
          return 'Home: moved cursor to start';
        }
        return 'Home: dispatched event';
      }

      case 'End': {
        // For inputs, move cursor to end
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          const len = element.value.length;
          element.setSelectionRange(len, len);
          return 'End: moved cursor to end';
        }
        return 'End: dispatched event';
      }

      case 'Backspace': {
        // Delete character before cursor (or last character if cursor position unknown)
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          const value = element.value;

          if (!value || value.length === 0) {
            return 'Backspace: input is empty, nothing to delete';
          }

          // Get cursor position, default to end of input if not set
          let start: number = element.selectionStart ?? value.length;
          let end: number = element.selectionEnd ?? value.length;

          // If cursor position is at 0, assume we want to delete from end
          if (start === 0 && end === 0) {
            start = value.length;
            end = value.length;
          }

          let newValue = value;
          let newCursorPos = start;

          if (start === end && start > 0) {
            // No selection, delete char before cursor
            newValue = value.slice(0, start - 1) + value.slice(end);
            newCursorPos = start - 1;
          } else if (start !== end) {
            // Delete selection
            newValue = value.slice(0, start) + value.slice(end);
            newCursorPos = start;
          } else {
            return 'Backspace: cursor at start, nothing to delete';
          }

          // Use native input value setter to work with React/Vue controlled inputs
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            element instanceof HTMLTextAreaElement
              ? HTMLTextAreaElement.prototype
              : HTMLInputElement.prototype,
            'value'
          )?.set;

          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(element, newValue);
          } else {
            element.value = newValue;
          }

          // Dispatch input event for React/Vue to pick up the change
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));

          // Set cursor position after value change
          element.setSelectionRange(newCursorPos, newCursorPos);

          return `Backspace: deleted character, value is now "${newValue}"`;
        }
        return 'Backspace: dispatched event';
      }

      case 'Delete': {
        // Delete character after cursor
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          const start = element.selectionStart || 0;
          const end = element.selectionEnd || 0;
          const value = element.value;

          let newValue = value;

          if (start === end && start < value.length) {
            // No selection, delete char after cursor
            newValue = value.slice(0, start) + value.slice(end + 1);
          } else if (start !== end) {
            // Delete selection
            newValue = value.slice(0, start) + value.slice(end);
          } else {
            return 'Delete: cursor at end, nothing to delete';
          }

          // Use native input value setter to work with React/Vue controlled inputs
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            element instanceof HTMLTextAreaElement
              ? HTMLTextAreaElement.prototype
              : HTMLInputElement.prototype,
            'value'
          )?.set;

          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(element, newValue);
          } else {
            element.value = newValue;
          }

          // Dispatch input event for React/Vue to pick up the change
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));

          // Maintain cursor position
          element.setSelectionRange(start, start);

          return `Delete: deleted character, value is now "${newValue}"`;
        }
        return 'Delete: dispatched event';
      }

      default:
        // For other keys, just dispatch events (already done above)
        return null;
    }
  }

  private uploadFile(_args: Record<string, unknown>): ToolExecutionResult {
    return { success: false, result: '', error: 'File upload not supported via script' };
  }

  private closeTab(): ToolExecutionResult {
    window.close();
    return { success: true, result: 'Attempted close' };
  }

  private switchTab(_args: Record<string, unknown>): ToolExecutionResult {
    return { success: false, result: '', error: 'Tab switching not supported' };
  }

  private done(args: Record<string, unknown>): ToolExecutionResult {
    return { success: true, result: args.success ? 'Task completed' : 'Task failed' };
  }

  private getHtml(): ToolExecutionResult {
    try {
      const html = domService.getSnapshotHtml();
      return { success: true, result: html };
    } catch (error) {
      return { success: false, result: '', error: String(error) };
    }
  }

  private async getScreenshot(): Promise<ToolExecutionResult> {
    try {
      const stream = await startScreenShare();
      if (!stream) return { success: false, result: '', error: 'Failed to get stream' };

      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.style.display = 'none';
      document.body.appendChild(video);

      await new Promise<void>((resolve) => {
        video.onloadeddata = () => resolve();
      });

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);

      const base64 = canvas.toDataURL('image/jpeg', 0.75);

      video.remove();
      // Don't stop stream as user might want to keep sharing,
      // or we should stop if it was just for screenshot?
      // The agent usually requests screenshot then keeps going.
      // But if we just requested permissions for this, maybe we should stop?
      // Original implementation reused active stream. `startScreenShare` handles reuse.

      return { success: true, result: base64 };
    } catch (error) {
      return { success: false, result: '', error: String(error) };
    }
  }
}

export const toolExecutionService = ToolExecutionService.getInstance();
