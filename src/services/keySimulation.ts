/**
 * Simulates the default action a real keypress would take on a host-page element.
 * `simulateKeyAction` carries out what the browser withholds from a programmatic, untrusted `KeyboardEvent`
 * (focus moves, form submits, text edits); `setFieldValue` writes through the native `value` setter and fires
 * `input`/`change` so framework-controlled inputs see the change.
 */
import { focusablesIn } from '../utils/dom';
import type { ToolArgs } from './browserTools';

type SendKey = ToolArgs<'send_keys'>['keys'];

export const isTextField = (el: Element): el is HTMLInputElement | HTMLTextAreaElement =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

const isButtonish = (el: Element): boolean => el instanceof HTMLButtonElement || el.getAttribute('role') === 'button';

export function simulateKeyAction(element: HTMLElement, key: SendKey): string {
  switch (key) {
    case 'Tab': {
      const focusables = focusablesIn(document);
      const currentIndex = focusables.indexOf(element);
      const next = currentIndex === -1 ? undefined : focusables[currentIndex + 1];
      if (!next) return 'Tab: no next focusable element';
      next.focus();
      return `Tab: moved focus to ${next.tagName.toLowerCase()}${next.id ? `#${next.id}` : ''}`;
    }

    case 'Enter': {
      if (isButtonish(element)) {
        element.click();
        return 'Enter: clicked button';
      }
      if (element instanceof HTMLTextAreaElement) {
        const start = element.selectionStart;
        const value = `${element.value.slice(0, start)}\n${element.value.slice(element.selectionEnd)}`;
        setFieldValue(element, value);
        element.setSelectionRange(start + 1, start + 1);
        return 'Enter: inserted a line break';
      }
      const form = element instanceof HTMLInputElement ? element.closest('form') : null;
      if (form) {
        const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"], input[type="submit"]');
        if (submitBtn) {
          submitBtn.click();
          return 'Enter: clicked form submit button';
        }
        form.requestSubmit();
        return 'Enter: submitted form';
      }
      if (element instanceof HTMLAnchorElement) {
        element.click();
        return 'Enter: clicked link';
      }
      return 'Enter: dispatched event';
    }

    case 'Escape': {
      element.blur();
      return 'Escape: blurred element';
    }

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

    case 'ArrowLeft':
    case 'ArrowRight': {
      if (!isTextField(element) || element.selectionStart === null) return `${key}: dispatched event`;
      const caret = Math.max(
        0,
        Math.min(element.value.length, element.selectionStart + (key === 'ArrowLeft' ? -1 : 1)),
      );
      element.setSelectionRange(caret, caret);
      return `${key}: moved cursor to ${caret}`;
    }

    case 'PageUp':
    case 'PageDown': {
      window.scrollBy({ top: (key === 'PageUp' ? -1 : 1) * window.innerHeight });
      return `${key}: scrolled the page`;
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
  return `${key}: selected "${element.options[next]?.text ?? ''}"`;
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

  setFieldValue(element, newValue);
  element.setSelectionRange(newCursorPos, newCursorPos);
  return `${direction}: deleted character, value is now "${newValue}"`;
}

export function setFieldValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value',
  )?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
