/**
 * Simulates the default action a real keypress would take on a host-page element.
 * `simulateKeyAction` carries out what the browser withholds from a programmatic, untrusted `KeyboardEvent`
 * (focus moves, form submits, text edits); `setFieldValue` writes an input, textarea or select through its
 * native `value` setter and fires `input`/`change` so framework-controlled fields see the change. Email and
 * number inputs expose no caret, so an edit there lands at the end of the value, where a user who just typed
 * would have it; Backspace and Delete edit only text-like fields, because a date, checkbox or color value is not
 * a string a keypress shortens.
 */
import { focusablesIn } from '../utils/dom';
import type { ToolArgs } from './browserTools';

type SendKey = ToolArgs<'send_keys'>['keys'];

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);

export const isValueField = (el: Element): el is HTMLInputElement | HTMLTextAreaElement =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

const isTextField = (el: Element): el is HTMLInputElement | HTMLTextAreaElement =>
  el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(el.type));

const hasCaret = (el: Element): el is (HTMLInputElement | HTMLTextAreaElement) & { selectionStart: number } =>
  isTextField(el) && el.selectionStart !== null;

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
      const form: Pick<HTMLFormElement, 'querySelector' | 'requestSubmit'> | null =
        element instanceof HTMLInputElement ? element.closest('form') : null;
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
      break;
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
      break;
    }

    case 'ArrowDown':
    case 'ArrowUp':
      if (element instanceof HTMLSelectElement) return stepSelect(element, key);
      break;

    case 'ArrowLeft':
    case 'ArrowRight': {
      if (!hasCaret(element)) break;
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

    case 'Home':
    case 'End': {
      if (!hasCaret(element)) break;
      const caret = key === 'Home' ? 0 : element.value.length;
      element.setSelectionRange(caret, caret);
      return `${key}: moved cursor to ${key === 'Home' ? 'start' : 'end'}`;
    }

    case 'Backspace':
    case 'Delete':
      if (isTextField(element)) return deleteAt(element, key);
      break;
  }
  return `${key}: dispatched event`;
}

function stepSelect(element: HTMLSelectElement, key: 'ArrowDown' | 'ArrowUp'): string {
  const option = element.options[element.selectedIndex + (key === 'ArrowDown' ? 1 : -1)];
  if (!option) return `${key}: already at ${key === 'ArrowDown' ? 'last' : 'first'} option`;
  setFieldValue(element, option.value);
  return `${key}: selected "${option.text}"`;
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
  if (hasCaret(element)) element.setSelectionRange(newCursorPos, newCursorPos);
  return `${direction}: deleted character, value is now "${element.value}"`;
}

export function setFieldValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  const prototype =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
