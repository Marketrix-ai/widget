/**
 * DOM Manipulation Utilities
 *
 * Centralized utilities for common DOM operations to reduce code duplication
 * and ensure consistent error handling.
 */

import { isHTMLElement } from './validation';

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
  options?: boolean | AddEventListenerOptions,
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
    allHighlightedElements.forEach(element => {
      if (isHTMLElement(element)) {
        element.classList.remove('step-highlight');
        removeTourClickHandler(element);
      }
    });
  } catch (error) {
    console.warn('[DOM Utils] Failed to remove step highlights:', error);
  }
}
/**
 * Utility for finding DOM elements by index.
 * Used by browser tools to locate interactive elements on the page.
 */

import { domService } from '../services/DomService';

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
  if (domService.isIndexActive()) {
    // Step 2: Try to get element by data-id from indexing service
    const element = domService.getElementByDataId(index);
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
  return inputs.filter(input => isElementVisible(input) && !input.disabled);
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
  return selects.filter(select => isElementVisible(select) && !select.disabled);
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
export function isInteractable(el: Element | null): boolean {
  if (!el || !(el instanceof Element)) return false;

  try {
    // ---- 0. Interactive element type check ----
    // First verify this is actually an interactive element type before doing expensive checks
    const tagName = el.tagName.toLowerCase();
    const isButton = tagName === 'button';
    const isInteractiveType =
      // Standard interactive elements
      isButton ||
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      // Anchor tags with href (including href="#")
      (tagName === 'a' && el.hasAttribute('href')) ||
      // Elements with interactive ARIA roles
      el.getAttribute('role') === 'button' ||
      el.getAttribute('role') === 'link' ||
      el.getAttribute('role') === 'textbox' ||
      el.getAttribute('role') === 'checkbox' ||
      el.getAttribute('role') === 'radio' ||
      el.getAttribute('role') === 'switch' ||
      el.getAttribute('role') === 'tab' ||
      el.getAttribute('role') === 'menuitem' ||
      // Contenteditable elements
      el.getAttribute('contenteditable') === 'true' ||
      // Elements with onclick handlers (may be interactive)
      el.hasAttribute('onclick') ||
      // Elements with positive tabindex (focusable)
      (el.hasAttribute('tabindex') && parseInt(el.getAttribute('tabindex') || '-1', 10) >= 0);

    if (!isInteractiveType) {
      return false;
    }

    // Helper function for diagnostic logging (only for buttons to avoid noise)
    const logButtonFailure = (checkName: string, reason?: string): void => {
      if (isButton) {
        const buttonInfo = {
          tag: el.tagName,
          id: el.id || '(no id)',
          class: el.className || '(no class)',
          check: checkName,
          reason: reason || '',
        };
        console.debug('[isInteractable] Button failed check:', buttonInfo);
      }
    };

    // ---- 1. Disabled or inert state ----
    // Covers <button disabled>, <input disabled>, aria-disabled, and inert subtree.
    if ((el as HTMLButtonElement).disabled === true) {
      logButtonFailure('disabled', 'button is disabled');
      return false;
    }
    if (el.getAttribute('aria-disabled') === 'true') {
      logButtonFailure('aria-disabled', 'aria-disabled is true');
      return false;
    }

    // Check inert on ancestors, including shadow hosts
    try {
      let p: Element | null | ShadowRoot = el;
      while (p) {
        if (p instanceof HTMLElement && p.inert) {
          logButtonFailure('inert', 'ancestor is inert');
          return false;
        }
        const root: Node | null = p instanceof Element ? p.getRootNode() : null;
        p = p instanceof Element ? p.parentElement || (root instanceof ShadowRoot ? root.host : null) : null;
      }
    } catch (error) {
      // If inert check fails, continue (don't block on this)
      console.warn('[isInteractable] Error checking inert:', error);
    }

    // ---- SPECIAL CASE: Buttons with onclick handlers ----
    // Skip ALL visibility/occlusion checks for buttons with onclick (they're definitely interactive)
    // Only check disabled/inert state (already done above)
    const hasOnclick = el.hasAttribute('onclick');
    if (isButton && hasOnclick) {
      return true; // Early return - skip all other checks
    }

    let style: CSSStyleDeclaration;
    try {
      style = window.getComputedStyle(el);
    } catch (error) {
      // If computed style fails, assume element is not interactable
      logButtonFailure('computed-style', 'failed to get computed style');
      console.warn('[isInteractable] Error getting computed style:', error);
      return false;
    }

    // ---- 2. Visibility and pointer checks ----
    // Only check display: none (element removed from layout) and pointer-events: none (explicitly non-interactable)
    // We don't check opacity or visibility because elements with opacity: 0 or visibility: hidden
    // can still be made visible through user interaction (expanding sections, opening modals, etc.)
    if (style.display === 'none') {
      logButtonFailure('display', 'display is none');
      return false;
    }
    if (style.pointerEvents === 'none') {
      logButtonFailure('pointer-events', 'pointer-events is none');
      return false;
    }

    // ---- 3. Layout presence ----
    let rect: DOMRect;
    try {
      rect = el.getBoundingClientRect();
    } catch (error) {
      logButtonFailure('bounding-rect', 'failed to get bounding rect');
      console.warn('[isInteractable] Error getting bounding rect:', error);
      return false;
    }

    if (rect.width <= 0 || rect.height <= 0) {
      logButtonFailure('dimensions', `width=${rect.width}, height=${rect.height}`);
      return false;
    }

    // Off-screen check removed: elements outside viewport are still interactable
    // if they can be scrolled to, so we index them regardless of viewport position

    // ---- 4. Overflow clipping by ancestors ----
    // For buttons: only fail if completely outside parent bounds (more lenient)
    // For other elements: use original stricter check
    try {
      let node: Element | null = el;
      while (node && node !== document.body) {
        const rootNode = node.getRootNode();
        const parent: Element | null =
          node.parentElement || (rootNode instanceof ShadowRoot ? (rootNode as ShadowRoot).host : null);

        if (!parent) break;

        let parentStyle: CSSStyleDeclaration;
        let pr: DOMRect;
        try {
          parentStyle = window.getComputedStyle(parent);
          pr = parent.getBoundingClientRect();
        } catch {
          // If we can't get parent style/rect, continue (don't block)
          node = parent;
          continue;
        }

        if (parentStyle.overflow === 'hidden' || parentStyle.overflow === 'clip') {
          // For buttons: only fail if completely outside (all edges outside)
          // For other elements: fail if any edge is outside (stricter)
          const isCompletelyOutside =
            rect.right < pr.left || rect.left > pr.right || rect.bottom < pr.top || rect.top > pr.bottom;

          if (isButton) {
            // Button: only fail if completely outside parent bounds
            if (isCompletelyOutside) {
              logButtonFailure('overflow-clipping', 'completely outside parent bounds');
              return false;
            }
          } else {
            // Other elements: use original stricter check
            if (isCompletelyOutside) {
              return false; // clipped out
            }
          }
        }

        node = parent;
      }
    } catch (error) {
      // If overflow check fails, continue (don't block on this)
      console.warn('[isInteractable] Error checking overflow:', error);
    }

    // ---- 5. Occlusion check removed ----
    // We don't check occlusion because the goal is to find ALL interactable elements,
    // even if they're occluded or off-screen. If they can be scrolled to and interacted with,
    // they should be indexed.

    // ---- 6. Shadow DOM host visibility ----
    try {
      let root: Node | null = el.getRootNode();
      while (root instanceof ShadowRoot) {
        const host: Element = root.host;
        let hostRect: DOMRect;
        try {
          hostRect = host.getBoundingClientRect();
        } catch {
          // If we can't get host rect, continue (don't block)
          break;
        }
        if (hostRect.width <= 0 || hostRect.height <= 0) return false;
        root = host.getRootNode();
      }
    } catch (error) {
      // If shadow DOM check fails, continue (don't block on this)
      console.warn('[isInteractable] Error checking shadow DOM:', error);
    }

    return true;
  } catch (error) {
    // If any critical error occurs, log and return false
    console.error('[isInteractable] Unexpected error:', error);
    return false;
  }
}
/**
 * Attribute Parsing Utilities
 *
 * Pure utility functions for parsing script tag data attributes.
 * These functions validate and normalize attribute values.
 */

/**
 * Parse position attribute from script tag
 */
export function parsePositionAttribute(value: string | null): 'bottom_right' | 'bottom_left' {
  if (value === 'bottom_left' || value === 'bottom_right') {
    return value;
  }
  return 'bottom_right';
}

/**
 * Parse theme attribute from script tag
 */
export function parseThemeAttribute(value: string | null): 'light' | 'dark' {
  if (value === 'light' || value === 'dark') {
    return value;
  }
  return 'light';
}

/**
 * Parse enabled modes attribute from script tag
 */
export function parseEnabledModesAttribute(value: string | null): ('show' | 'tell' | 'do')[] {
  if (!value) {
    return ['show', 'tell', 'do'];
  }

  const modes = value.split(',').map(m => m.trim());
  const validModes: ('show' | 'tell' | 'do')[] = [];

  for (const mode of modes) {
    if (mode === 'show' || mode === 'tell' || mode === 'do') {
      validModes.push(mode);
    }
  }

  return validModes.length > 0 ? validModes : ['show', 'tell', 'do'];
}
