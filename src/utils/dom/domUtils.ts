/**
 * DOM Manipulation Utilities
 *
 * Centralized utilities for common DOM operations to reduce code duplication
 * and ensure consistent error handling.
 */

import { isHTMLElement } from '../validation/typeGuards';

interface TourElement extends HTMLElement {
  _tourClickHandler?: EventListener;
}

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
 * Safely remove an event listener from an element
 */
function removeEventListenerSafely(
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
  if (isHTMLElement(element)) {
    const tourElement = element as TourElement;
    if (tourElement._tourClickHandler) {
      removeEventListenerSafely(tourElement, 'click', tourElement._tourClickHandler, true);
      delete tourElement._tourClickHandler;
    }
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
