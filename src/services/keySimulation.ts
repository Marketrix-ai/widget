/**
 * The default action a real keypress would have taken, run by hand on a HOST-page element. A programmatic
 * `KeyboardEvent` is untrusted, so dispatching one moves no focus, submits no form and edits no text —
 * `BrowserToolService.sendKeys` dispatches the event for any listener watching, then calls
 * `simulateKeyAction` for the behaviour the browser withheld. An unhandled key returns null, which the
 * caller reports as a plain dispatch, and every handled key returns the sentence the agent reads.
 *
 * `isTextField` is the input-or-textarea guard the cases share, also used by `BrowserToolService.typeText`.
 * `setNativeValue` writes through the PROTOTYPE `value` setter rather than assigning the property, since
 * React and Vue install their own instance-level setter and an assignment through it is invisible to their
 * change tracking; `setValueAndCaret` adds the `input` and `change` a controlled input needs to observe the
 * edit, then restores the caret, which assigning `value` collapses to the end.
 *
 * Tab order comes from a document-wide `TABBABLE_SELECTOR` query filtered on `offsetParent`, so an element
 * not in the order at all reads as index -1 and refuses; without that guard -1 + 1 indexes the FIRST
 * element and silently wraps focus to the top of the page. Backspace reads `selectionStart` with `??` and
 * not `||`: caret position 0 is a position, and a falsy fallback to `value.length` would delete the LAST
 * character instead of refusing at the start.
 */
import { TABBABLE_SELECTOR } from '../utils/dom';

export const isTextField = (el: Element): el is HTMLInputElement | HTMLTextAreaElement =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

export function simulateKeyAction(element: HTMLElement, key: string): string | null {
  switch (key) {
    case 'Tab':
    case 'Shift+Tab': {
      const step = key === 'Tab' ? 1 : -1;
      const focusables = Array.from(document.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)).filter(
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
      if (isTextField(element)) {
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
      if (isTextField(element)) {
        element.setSelectionRange(0, 0);
        return 'Home: moved cursor to start';
      }
      return 'Home: dispatched event';
    }

    case 'End': {
      if (isTextField(element)) {
        const len = element.value.length;
        element.setSelectionRange(len, len);
        return 'End: moved cursor to end';
      }
      return 'End: dispatched event';
    }

    case 'Backspace': {
      if (isTextField(element)) {
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

        setValueAndCaret(element, newValue, newCursorPos);

        return `Backspace: deleted character, value is now "${newValue}"`;
      }
      return 'Backspace: dispatched event';
    }

    case 'Delete': {
      if (isTextField(element)) {
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

        setValueAndCaret(element, newValue, start);

        return `Delete: deleted character, value is now "${newValue}"`;
      }
      return 'Delete: dispatched event';
    }

    default:
      return null;
  }
}

export function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value',
  )?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
}

function setValueAndCaret(el: HTMLInputElement | HTMLTextAreaElement, value: string, caret: number): void {
  setNativeValue(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.setSelectionRange(caret, caret);
}
