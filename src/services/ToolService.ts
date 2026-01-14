import { domService } from './DomService';
import { startScreenShare } from './ScreenShareService';
import { showModeService } from './ShowModeService';

export interface ToolExecutionResult {
  success: boolean;
  result: string;
  error?: string;
  recoveryInfo?: {
    originalIndex: number;
    recoveredIndex?: number;
    domReindexed: boolean;
  };
}

// TypeScript interfaces for tool parameters
export interface NavigateParams {
  url: string;
  new_tab?: boolean;
}

export interface SearchParams {
  query: string;
  engine?: 'duckduckgo' | 'google' | 'bing';
}

export interface ClickElementParams {
  index: number;
}

export interface TypeTextParams {
  index: number;
  text: string;
}

export interface ScrollParams {
  direction: 'up' | 'down' | 'left' | 'right';
}

export interface ScrollToTextParams {
  text: string;
}

export interface SendKeysParams {
  index: number;
  keys: string;
}

export interface SelectDropdownOptionParams {
  index: number;
  option: string;
}

export interface GetDropdownOptionsParams {
  index: number;
}

export interface UploadFileParams {
  index: number;
  path: string;
}

export interface SwitchTabParams {
  tab_index: number;
}

export interface DoneParams {
  success: boolean;
  message?: string;
}

export interface WaitParams {
  seconds: number;
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
    explanation: string = '',
  ): Promise<ToolExecutionResult> {
    try {
      console.log(`[ToolExecutionService] Executing ${toolName} (mode: ${mode})`);

      if (mode === 'show' && this.requiresHighlight(toolName)) {
        const index = args.index as number | undefined;
        if (index !== undefined) {
          const element = domService.getElementByIndex(index);
          if (element) {
            const confirmed = await showModeService.showToolAction({
              element,
              explanation: explanation || `Execute ${toolName}`,
              toolName,
              isClickAction: toolName === 'click_element',
            });

            if (!confirmed) {
              return { success: false, result: '', error: 'User cancelled action' };
            }

            if (toolName === 'click_element') {
              // Execute the click after confirmation
              // We proceed to the switch case below to actually execute the click
            } else if (toolName === 'type_text' || toolName === 'select_dropdown_option' || toolName === 'send_keys') {
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
          return this.navigate(args as unknown as NavigateParams);
        case 'search':
          return this.search(args as unknown as SearchParams);
        case 'click_element':
          return await this.clickElement(args as unknown as ClickElementParams);
        case 'type_text':
          return this.typeText(args as unknown as TypeTextParams);
        case 'scroll':
          return this.scroll(args as unknown as ScrollParams);
        case 'scroll_to_text':
          return this.scrollToText(args as unknown as ScrollToTextParams);
        case 'extract':
          return this.extract(args);
        case 'go_back':
          return this.goBack();
        case 'wait':
          return await this.wait(args as unknown as WaitParams);
        case 'select_dropdown_option':
          return this.selectDropdownOption(args as unknown as SelectDropdownOptionParams);
        case 'get_dropdown_options':
          return this.getDropdownOptions(args as unknown as GetDropdownOptionsParams);
        case 'send_keys':
          return this.sendKeys(args as unknown as SendKeysParams);
        case 'upload_file':
          return this.uploadFile(args as unknown as UploadFileParams);
        case 'close_tab':
          return this.closeTab();
        case 'switch_tab':
          return this.switchTab(args as unknown as SwitchTabParams);
        case 'done':
          return this.done(args as unknown as DoneParams);
        case 'get_html':
          return this.getHtml();
        case 'get_interactable_elements':
          return this.getInteractableElements();
        case 'get_screenshot':
          return await this.getScreenshot();
        default:
          return { success: false, result: '', error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      showModeService.cleanup();
      return {
        success: false,
        result: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private requiresHighlight(toolName: string): boolean {
    return ['click_element', 'type_text', 'select_dropdown_option', 'send_keys', 'upload_file'].includes(toolName);
  }

  private navigate(args: NavigateParams): ToolExecutionResult {
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

  private search(args: SearchParams): ToolExecutionResult {
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

  private async clickElement(args: ClickElementParams): Promise<ToolExecutionResult> {
    const index = args.index as number;
    if (index === undefined) return { success: false, result: '', error: 'Index required' };

    // Use validated element lookup
    const { element, validation } = domService.getValidatedElement(index);

    if (!element) {
      if (validation.requiresReindex) {
        // Trigger re-indexing and return special error for agent to retry
        domService.indexInteractableElements();
        return {
          success: false,
          result: '',
          error: `DOM_CHANGED: Element at index ${index} no longer exists. DOM has been re-indexed. Please call get_html to get updated element indices.`,
          recoveryInfo: {
            originalIndex: index,
            domReindexed: true,
          },
        };
      }
      return { success: false, result: '', error: `Element ${index} not found` };
    }

    // Log if element was recovered at a different index
    if (validation.mismatchReason === 'index_shifted' && validation.recoveredIndex !== undefined) {
      console.log(
        `[ToolExecutionService] Element shifted from index ${index} to ${validation.recoveredIndex}, executing on recovered element`,
      );
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(resolve => setTimeout(resolve, 100));
    // Defer the click to allow the tool response to be sent first
    setTimeout(() => {
      try {
        // element is HTMLElement which has click() method
        element.click();
      } catch (e) {
        console.warn('[ToolExecutionService] Click triggered an error on the page:', e);
        // Fallback: try dispatchEvent if click() fails
        try {
          const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
          });
          element.dispatchEvent(clickEvent);
        } catch (fallbackError) {
          console.warn('[ToolExecutionService] Fallback click also failed:', fallbackError);
        }
      }
    }, 50);

    const result: ToolExecutionResult = { success: true, result: `Clicked element ${index}` };
    if (validation.recoveredIndex !== undefined && validation.recoveredIndex !== index) {
      result.recoveryInfo = {
        originalIndex: index,
        recoveredIndex: validation.recoveredIndex,
        domReindexed: false,
      };
    }
    return result;
  }

  private typeText(args: TypeTextParams): ToolExecutionResult {
    const index = args.index as number;
    const text = args.text as string;
    if (index === undefined || text === undefined)
      return { success: false, result: '', error: 'Index and text required' };

    // Use validated element lookup
    const { element, validation } = domService.getValidatedElement(index);

    if (!element) {
      if (validation.requiresReindex) {
        domService.indexInteractableElements();
        return {
          success: false,
          result: '',
          error: `DOM_CHANGED: Element at index ${index} no longer exists. DOM has been re-indexed. Please call get_html to get updated element indices.`,
          recoveryInfo: { originalIndex: index, domReindexed: true },
        };
      }
      return { success: false, result: '', error: `Element ${index} not found` };
    }

    // Check if element is an input-like element
    const isInputLike =
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      (element as HTMLElement).isContentEditable;

    if (isInputLike) {
      const inputElement = element as HTMLInputElement | HTMLTextAreaElement;

      // Focus the element first (important for some frameworks)
      try {
        inputElement.focus();
      } catch (e) {
        console.warn('[ToolService] Focus failed:', e);
      }

      // Try multiple methods to set the value
      let valueSet = false;
      let lastError: unknown = null;

      // Method 1: Native value setter (works with React controlled components)
      if (!valueSet) {
        try {
          const isTextArea = inputElement.tagName.toUpperCase() === 'TEXTAREA';
          const prototype = isTextArea ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

          if (descriptor?.set) {
            descriptor.set.call(inputElement, text);
            valueSet = true;
            console.log('[ToolService] Native setter succeeded');
          }
        } catch (e) {
          lastError = e;
          console.warn('[ToolService] Native setter failed:', e);
        }
      }

      // Method 2: Direct value assignment
      if (!valueSet) {
        try {
          inputElement.value = text;
          valueSet = true;
          console.log('[ToolService] Direct assignment succeeded');
        } catch (e) {
          lastError = e;
          console.warn('[ToolService] Direct assignment failed:', e);
        }
      }

      // Method 3: Select all and use execCommand insertText
      if (!valueSet) {
        try {
          inputElement.focus();
          inputElement.select();
          const success = document.execCommand('insertText', false, text);
          if (success) {
            valueSet = true;
            console.log('[ToolService] execCommand succeeded');
          }
        } catch (e) {
          lastError = e;
          console.warn('[ToolService] execCommand failed:', e);
        }
      }

      // Method 4: Simulate keyboard input character by character (last resort)
      if (!valueSet) {
        try {
          inputElement.focus();
          // Clear existing value first
          inputElement.value = '';
          for (const char of text) {
            inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true, cancelable: true }));
            inputElement.value += char;
            inputElement.dispatchEvent(
              new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertText',
                data: char,
              }),
            );
            inputElement.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true, cancelable: true }));
          }
          valueSet = true;
          console.log('[ToolService] Simulated typing succeeded');
        } catch (e) {
          lastError = e;
          console.warn('[ToolService] Simulated typing failed:', e);
        }
      }

      if (!valueSet) {
        return {
          success: false,
          result: '',
          error: `Failed to set value: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
        };
      }

      // Dispatch events for React/Vue/Angular frameworks
      try {
        // InputEvent is more specific and carries data
        const inputEvent = new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text,
        });
        inputElement.dispatchEvent(inputEvent);

        // Change event for form validation
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));

        // Some frameworks need blur to trigger validation
        inputElement.dispatchEvent(new Event('blur', { bubbles: true }));
      } catch (e) {
        console.warn('[ToolService] Event dispatch failed:', e);
      }
    } else if ('value' in element) {
      // Generic element with value property (e.g., select, custom elements)
      try {
        (element as HTMLInputElement).value = text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {
        return {
          success: false,
          result: '',
          error: `Failed to set value on element: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    } else {
      // For contenteditable or text-based elements
      try {
        element.textContent = text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (e) {
        return {
          success: false,
          result: '',
          error: `Failed to set textContent: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    }

    const result: ToolExecutionResult = {
      success: true,
      result: `Typed text into element ${index}`,
    };
    if (validation.recoveredIndex !== undefined && validation.recoveredIndex !== index) {
      result.recoveryInfo = {
        originalIndex: index,
        recoveredIndex: validation.recoveredIndex,
        domReindexed: false,
      };
    }
    return result;
  }

  private scroll(args: ScrollParams): ToolExecutionResult {
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

  private scrollToText(args: ScrollToTextParams): ToolExecutionResult {
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
      text: document.body.innerText.slice(0, 10000),
      links: Array.from(document.querySelectorAll('a[href]'))
        .slice(0, 100)
        .map(a => ({
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

  private async wait(args: WaitParams): Promise<ToolExecutionResult> {
    const seconds = args.seconds as number;
    if (seconds === undefined) return { success: false, result: '', error: 'Seconds required' };
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    return { success: true, result: `Waited ${seconds}s` };
  }

  private selectDropdownOption(args: SelectDropdownOptionParams): ToolExecutionResult {
    const index = args.index as number;
    const option = args.option as string;
    if (index === undefined || !option) return { success: false, result: '', error: 'Index/Option required' };

    // Use validated element lookup
    const { element, validation } = domService.getValidatedElement(index);

    if (!element) {
      if (validation.requiresReindex) {
        domService.indexInteractableElements();
        return {
          success: false,
          result: '',
          error: `DOM_CHANGED: Element at index ${index} no longer exists. DOM has been re-indexed. Please call get_html to get updated element indices.`,
          recoveryInfo: { originalIndex: index, domReindexed: true },
        };
      }
      return { success: false, result: '', error: `Select ${index} not found` };
    }

    if (!(element instanceof HTMLSelectElement)) {
      return { success: false, result: '', error: `Element ${index} is not a select element` };
    }

    const opt = Array.from(element.options).find(o => o.value === option || o.text === option);
    if (!opt) return { success: false, result: '', error: `Option ${option} not found` };

    element.value = opt.value;
    element.dispatchEvent(new Event('change', { bubbles: true }));

    const result: ToolExecutionResult = { success: true, result: `Selected ${option}` };
    if (validation.recoveredIndex !== undefined && validation.recoveredIndex !== index) {
      result.recoveryInfo = {
        originalIndex: index,
        recoveredIndex: validation.recoveredIndex,
        domReindexed: false,
      };
    }
    return result;
  }

  private getDropdownOptions(args: GetDropdownOptionsParams): ToolExecutionResult {
    const index = args.index as number;

    // Use validated element lookup
    const { element, validation } = domService.getValidatedElement(index);

    if (!element) {
      if (validation.requiresReindex) {
        domService.indexInteractableElements();
        return {
          success: false,
          result: '',
          error: `DOM_CHANGED: Element at index ${index} no longer exists. DOM has been re-indexed. Please call get_html to get updated element indices.`,
          recoveryInfo: { originalIndex: index, domReindexed: true },
        };
      }
      return { success: false, result: '', error: `Select ${index} not found` };
    }

    if (!(element instanceof HTMLSelectElement)) {
      return { success: false, result: '', error: `Element ${index} is not a select element` };
    }

    const options = Array.from(element.options).map(o => ({ value: o.value, text: o.text }));
    return { success: true, result: JSON.stringify(options) };
  }

  private sendKeys(args: SendKeysParams): ToolExecutionResult {
    const index = args.index as number;
    const keys = args.keys as string;
    if (index === undefined || !keys) return { success: false, result: '', error: 'Index/Keys required' };

    // Use validated element lookup
    const { element, validation } = domService.getValidatedElement(index);

    if (!element) {
      if (validation.requiresReindex) {
        domService.indexInteractableElements();
        return {
          success: false,
          result: '',
          error: `DOM_CHANGED: Element at index ${index} no longer exists. DOM has been re-indexed. Please call get_html to get updated element indices.`,
          recoveryInfo: { originalIndex: index, domReindexed: true },
        };
      }
      return { success: false, result: '', error: `Element ${index} not found` };
    }

    // Focus the element first
    element.focus();

    // Dispatch keyboard events (for custom event handlers)
    element.dispatchEvent(new KeyboardEvent('keydown', { key: keys, bubbles: true, cancelable: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { key: keys, bubbles: true, cancelable: true }));

    // Simulate actual browser behavior for common keys
    const actionResult = this.simulateKeyAction(element, keys);

    const result: ToolExecutionResult = {
      success: true,
      result: actionResult || `Sent keys ${keys}`,
    };
    if (validation.recoveredIndex !== undefined && validation.recoveredIndex !== index) {
      result.recoveryInfo = {
        originalIndex: index,
        recoveredIndex: validation.recoveredIndex,
        domReindexed: false,
      };
    }
    return result;
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
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(el => el.offsetParent !== null); // Only visible elements

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
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(el => el.offsetParent !== null);

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
        // Blur current element (common behavior)
        element.blur();
        // Also dispatch to document for modal close handlers
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        return 'Escape: blurred element and dispatched to document';
      }

      case ' ':
      case 'Space': {
        // Click checkboxes, radio buttons, or buttons
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
            element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
            'value',
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
            element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
            'value',
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

  private uploadFile(_args: UploadFileParams): ToolExecutionResult {
    return { success: false, result: '', error: 'File upload not supported via script' };
  }

  private closeTab(): ToolExecutionResult {
    window.close();
    return { success: true, result: 'Attempted close' };
  }

  private switchTab(args: SwitchTabParams): ToolExecutionResult {
    const tab_index = args.tab_index as number;
    if (tab_index === undefined) {
      return { success: false, result: '', error: 'tab_index is required' };
    }
    // Tab switching not supported in browser context
    return { success: false, result: '', error: 'Tab switching not supported' };
  }

  private done(args: DoneParams): ToolExecutionResult {
    const success = args.success as boolean;
    if (success === undefined) {
      return { success: false, result: '', error: 'success parameter is required' };
    }
    const message = args.message as string | undefined;
    const resultMessage = message || (success ? 'Task completed' : 'Task failed');
    return { success: true, result: resultMessage };
  }

  private getHtml(): ToolExecutionResult {
    try {
      const html = domService.getSnapshotHtml();
      return { success: true, result: html };
    } catch (error) {
      return { success: false, result: '', error: String(error) };
    }
  }

  private getInteractableElements(): ToolExecutionResult {
    try {
      const elements = domService.getInteractableElements();
      return { success: true, result: JSON.stringify(elements) };
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
