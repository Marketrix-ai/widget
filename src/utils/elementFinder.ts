/**
 * Utility for finding DOM elements by index.
 * Used by browser tools to locate interactive elements on the page.
 */

import { getElementByDataId, isIndexed } from '../services/elementIndexService';

/**
 * Get all interactive elements on the page, ordered by DOM position.
 * Interactive elements include: buttons, inputs, links, select elements, etc.
 */
export function getAllInteractiveElements(): HTMLElement[] {
  const selectors = [
    'button',
    'input',
    'textarea',
    'select',
    'a[href]',
    '[role="button"]',
    '[role="link"]',
    '[role="textbox"]',
    '[contenteditable="true"]',
    '[onclick]',
    '[tabindex]:not([tabindex="-1"])',
  ];

  const elements: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  // Collect all interactive elements
  for (const selector of selectors) {
    const matches = document.querySelectorAll<HTMLElement>(selector);
    for (const el of matches) {
      // Skip hidden elements and elements that are not visible
      if (!seen.has(el) && isElementVisible(el) && isElementInteractive(el)) {
        elements.push(el);
        seen.add(el);
      }
    }
  }

  // Sort by DOM position (top to bottom, left to right)
  return elements.sort((a, b) => {
    const rectA = a.getBoundingClientRect();
    const rectB = b.getBoundingClientRect();

    // First compare by vertical position
    if (Math.abs(rectA.top - rectB.top) > 10) {
      return rectA.top - rectB.top;
    }
    // Then by horizontal position
    return rectA.left - rectB.left;
  });
}

/**
 * Get an interactive element by its index.
 * First tries to use data-id from get_html indexing, then falls back to current behavior.
 * @param index The zero-based index of the element
 * @returns The element at the given index, or null if not found
 */
export function getElementByIndex(index: number): HTMLElement | null {
  // Step 1: Check if indexing is active (get_html was called)
  if (isIndexed()) {
    // Step 2: Try to get element by data-id from indexing service
    const element = getElementByDataId(index);
    if (element && element instanceof HTMLElement) {
      return element;
    }
    // If not found or invalid, fall through to fallback
  }

  // Step 3: Fallback to current behavior (for backward compatibility)
  const elements = getAllInteractiveElements();
  if (index < 0 || index >= elements.length) {
    return null;
  }
  return elements[index];
}

/**
 * Check if an element is visible on the page.
 */
function isElementVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Check if an element is actually interactive (not disabled, etc.).
 */
function isElementInteractive(element: HTMLElement): boolean {
  // Skip disabled elements
  if ((element as HTMLInputElement | HTMLButtonElement | HTMLSelectElement).disabled) {
    return false;
  }

  // Skip elements that are not in the viewport (optional - you might want to include these)
  // const rect = element.getBoundingClientRect();
  // if (rect.bottom < 0 || rect.top > window.innerHeight) {
  //   return false;
  // }

  return true;
}

/**
 * Get all file input elements on the page, ordered by DOM position.
 */
export function getAllFileInputs(): HTMLInputElement[] {
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]'));
  return inputs.filter((input) => isElementVisible(input) && !input.disabled);
}

/**
 * Get a file input element by its index.
 */
export function getFileInputByIndex(index: number): HTMLInputElement | null {
  const inputs = getAllFileInputs();
  if (index < 0 || index >= inputs.length) {
    return null;
  }
  return inputs[index];
}

/**
 * Get all select/dropdown elements on the page, ordered by DOM position.
 */
export function getAllSelectElements(): HTMLSelectElement[] {
  const selects = Array.from(document.querySelectorAll<HTMLSelectElement>('select'));
  return selects.filter((select) => isElementVisible(select) && !select.disabled);
}

/**
 * Get a select element by its index.
 */
export function getSelectElementByIndex(index: number): HTMLSelectElement | null {
  const selects = getAllSelectElements();
  if (index < 0 || index >= selects.length) {
    return null;
  }
  return selects[index];
}
