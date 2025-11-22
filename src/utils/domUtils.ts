/**
 * DOM Manipulation Utilities
 *
 * Centralized utilities for common DOM operations to reduce code duplication
 * and ensure consistent error handling.
 */

import { isHTMLElement } from './typeGuards';

/**
 * Safely remove an element by ID
 */
export function removeElementById(id: string): void {
  try {
    const element = document.getElementById(id);
    if (element) {
      element.remove();
    }
  } catch (error) {
    console.warn(`[DOM Utils] Failed to remove element with id "${id}":`, error);
  }
}

/**
 * Remove all elements matching a selector
 */
export function removeElementsBySelector(selector: string): void {
  try {
    const elements = document.querySelectorAll(selector);
    elements.forEach((element) => {
      try {
        element.remove();
      } catch (error) {
        console.warn(`[DOM Utils] Failed to remove element:`, error);
      }
    });
  } catch (error) {
    console.warn(`[DOM Utils] Failed to query elements with selector "${selector}":`, error);
  }
}

/**
 * Remove a class from all elements matching a selector
 */
export function removeClassFromElements(selector: string, className: string): void {
  try {
    const elements = document.querySelectorAll(selector);
    elements.forEach((element) => {
      if (isHTMLElement(element)) {
        element.classList.remove(className);
      }
    });
  } catch (error) {
    console.warn(
      `[DOM Utils] Failed to remove class "${className}" from elements with selector "${selector}":`,
      error
    );
  }
}

/**
 * Safely remove an event listener from an element
 */
export function removeEventListenerSafely(
  element: EventTarget,
  event: string,
  handler: EventListener,
  options?: boolean | AddEventListenerOptions
): void {
  try {
    element.removeEventListener(event, handler, options);
  } catch (error) {
    console.warn(`[DOM Utils] Failed to remove event listener "${event}" from element:`, error);
  }
}

/**
 * Remove tour click handlers from an element
 */
export function removeTourClickHandler(element: HTMLElement): void {
  if (isHTMLElement(element) && (element as any)._tourClickHandler) {
    removeEventListenerSafely(element, 'click', (element as any)._tourClickHandler, true);
    delete (element as any)._tourClickHandler;
  }
}

/**
 * Remove all step highlight classes and their associated handlers
 */
export function removeStepHighlights(): void {
  try {
    const allHighlightedElements = document.querySelectorAll('.step-highlight');
    allHighlightedElements.forEach((element) => {
      if (isHTMLElement(element)) {
        element.classList.remove('step-highlight');
        removeTourClickHandler(element);
      }
    });
  } catch (error) {
    console.warn('[DOM Utils] Failed to remove step highlights:', error);
  }
}
