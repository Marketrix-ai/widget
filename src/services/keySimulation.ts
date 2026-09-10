/**
 * The default action a real keypress would have taken, run by hand on a HOST-page element. A programmatic
 * `KeyboardEvent` is untrusted, so dispatching one moves no focus, submits no form and edits no text —
 * `BrowserToolService.sendKeys` dispatches the event for any listener watching, then calls
 * `simulateKeyAction` for the behaviour the browser withheld. An unhandled key returns null, which the
 * caller reports as a plain dispatch, and every handled key returns the sentence the agent reads.
 *
 * `isTextField` is the input-or-textarea guard the cases share, also used by `BrowserToolService.typeText`;
 * `isButtonish` is the button-or-`role="button"` guard Enter and Space share. `setNativeValue` writes
 * through the PROTOTYPE `value` setter rather than assigning the property, since React and Vue install
 * their own instance-level setter and an assignment through it is invisible to their change tracking;
 * `setValueAndCaret` adds the `input` and `change` a controlled input needs to observe the edit, then
 * restores the caret, which assigning `value` collapses to the end.
 *
 * Tab order comes from `utils/dom`'s shared `focusablesIn(document)` — the same tabbable-plus-visible-
 * plus-not-`aria-hidden` filter `useFocusTrap` runs over its own container, so the host page's tab order
 * and the widget's own agree on what the browser would actually focus next. An element not in that order
 * at all reads as index -1 and refuses; without that guard -1 + 1 indexes the FIRST element and silently
 * wraps focus to the top of the page.
 *
 * `stepSelect` is the ArrowDown/ArrowUp shape on an `HTMLSelectElement`, `step` being +1/-1. `deleteAt` is
 * the Backspace/Delete shape on a text field: both read `selectionStart`/`selectionEnd` with `??`, not
 * `||`, and fall back to `value.length` (not 0) — caret position 0 is a position, so a falsy fallback
 * would misread it as absent, and defaulting an unknown caret to the END of the value (rather than the
 * start) matches what a real caret does when a field doesn't expose a selection range. A ranged selection
 * always deletes the range regardless of direction; direction only decides which single character goes
 * when start === end.
 */
import { focusablesIn } from '../utils/dom';

export const isTextField = (el: Element): el is HTMLInputElement | HTMLTextAreaElement =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

const isButtonish = (el: Element): boolean => el instanceof HTMLButtonElement || el.getAttribute('role') === 'button';

export function simulateKeyAction(element: HTMLElement, key: string): string | null {
  switch (key) {
    case 'Tab':
    case 'Shift+Tab': {
      const step = key === 'Tab' ? 1 : -1;
      const focusables = focusablesIn(document);
      const currentIndex = focusables.indexOf(element);
      const next = currentIndex === -1 ? undefined : focusables[currentIndex + step];
      if (!next) return `${key}: no ${step > 0 ? 'next' : 'previous'} focusable element`;
      next.focus();
      return `${key}: moved focus to ${next.tagName.toLowerCase()}${next.id ? `#${next.id}` : ''}`;
    }

    case 'Enter': {
      if (isButtonish(element)) {
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
      if (isButtonish(element)) {
        element.click();
        return 'Space: clicked button';
      }
      return 'Space: dispatched event';
    }

    case 'ArrowDown': {
      return element instanceof HTMLSelectElement ? stepSelect(element, 1) : 'ArrowDown: dispatched event';
    }

    case 'ArrowUp': {
      return element instanceof HTMLSelectElement ? stepSelect(element, -1) : 'ArrowUp: dispatched event';
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

    case 'Backspace':
      return isTextField(element) ? deleteAt(element, 'Backspace') : 'Backspace: dispatched event';

    case 'Delete':
      return isTextField(element) ? deleteAt(element, 'Delete') : 'Delete: dispatched event';

    default:
      return null;
  }
}

function stepSelect(element: HTMLSelectElement, step: 1 | -1): string {
  const key = step === 1 ? 'ArrowDown' : 'ArrowUp';
  const next = element.selectedIndex + step;
  if (next < 0 || next >= element.options.length) {
    return `${key}: already at ${step === 1 ? 'last' : 'first'} option`;
  }
  element.selectedIndex = next;
  element.dispatchEvent(new Event('change', { bubbles: true }));
  return `${key}: selected "${element.options[next].text}"`;
}

function deleteAt(element: HTMLInputElement | HTMLTextAreaElement, direction: 'Backspace' | 'Delete'): string {
  const value = element.value;
  const start = element.selectionStart ?? value.length;
  const end = element.selectionEnd ?? value.length;

  let newValue: string;
  let newCursorPos: number;

  if (start !== end) {
    newValue = value.slice(0, start) + value.slice(end);
    newCursorPos = start;
  } else if (direction === 'Backspace' && start > 0) {
    newValue = value.slice(0, start - 1) + value.slice(end);
    newCursorPos = start - 1;
  } else if (direction === 'Delete' && start < value.length) {
    newValue = value.slice(0, start) + value.slice(start + 1);
    newCursorPos = start;
  } else {
    return `${direction}: ${direction === 'Backspace' ? 'cursor at start' : 'cursor at end'}, nothing to delete`;
  }

  setValueAndCaret(element, newValue, newCursorPos);
  return `${direction}: deleted character, value is now "${newValue}"`;
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
