import { isInteractable } from '../utils/dom';

/**
 * Fingerprint of an indexed element for validation
 */
export interface ElementFingerprint {
  tagName: string;
  id: string | null;
  textContent: string | null; // Truncated to 100 chars
  type: string | null; // For inputs
  role: string | null; // ARIA role
  ariaLabel: string | null;
  name: string | null;
  href: string | null; // For anchors
  selector: string; // CSS selector
  indexVersion: number;
}

/**
 * Result of validating an element at a given index
 */
export interface ValidationResult {
  isValid: boolean;
  mismatchReason?: 'element_removed' | 'element_changed';
}

/**
 * Result of looking up an element by index
 */
export interface ElementLookupResult {
  element: HTMLElement | null;
  error?: string;
}

/**
 * Result of validated element lookup (includes validation info)
 */
export interface ValidatedElementResult extends ElementLookupResult {
  validation: ValidationResult;
}

export class DomService {
  private static instance: DomService;
  private elementMap: Map<number, Element> = new Map();
  private elementToSequence: WeakMap<Element, number> = new WeakMap();
  private selectorMap: Map<number, string> = new Map();
  private fingerprintMap: Map<number, ElementFingerprint> = new Map();
  private isIndexed: boolean = false;
  private indexingInProgress: boolean = false;
  private indexVersion: number = 0;
  // Removed STORAGE_KEY as we now persist state via ChatService

  private constructor() {
    // No longer restoring state internally
  }

  static getInstance(): DomService {
    if (!DomService.instance) {
      DomService.instance = new DomService();
    }
    return DomService.instance;
  }

  /**
   * Generate a unique CSS selector for an element
   */
  private generateSelector(element: Element): string {
    // Use ID if available and unique-ish (simple check)
    if (element.id) {
      // Escape CSS special characters in ID if needed, but simple #id is usually fine
      // Check if it's unique in document
      if (document.querySelectorAll(`#${CSS.escape(element.id)}`).length === 1) {
        return `#${CSS.escape(element.id)}`;
      }
    }

    // Fallback to path
    const path: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.body && current.parentElement) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector += `#${CSS.escape(current.id)}`;
        path.unshift(selector);
        break; // ID is usually enough anchor
      } else {
        const parent = current.parentElement;
        if (!parent) break;
        const currentTagName = current.tagName;
        const siblings = Array.from(parent.children).filter(c => c.tagName === currentTagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }

  /**
   * Generate a fingerprint for an element to enable validation later
   */
  private generateFingerprint(element: Element, selector: string): ElementFingerprint {
    const truncate = (str: string | null, maxLen: number = 100): string | null => {
      if (!str) return null;
      const normalized = str.trim().replace(/\s+/g, ' ');
      return normalized.length > maxLen ? normalized.slice(0, maxLen) : normalized;
    };

    return {
      tagName: element.tagName,
      id: element.id || null,
      textContent: truncate(element.textContent),
      type: element.getAttribute('type'),
      role: element.getAttribute('role'),
      ariaLabel: element.getAttribute('aria-label'),
      name: element.getAttribute('name'),
      href: element.getAttribute('href'),
      selector,
      indexVersion: this.indexVersion,
    };
  }

  /**
   * Check if an element matches a stored fingerprint.
   * Uses strict matching - fails if any key attribute differs.
   */
  private matchesFingerprint(element: Element, fingerprint: ElementFingerprint): boolean {
    // Primary check: tagName must match
    if (element.tagName !== fingerprint.tagName) {
      return false;
    }

    // Strong identifier: if ID exists and matches, high confidence
    if (fingerprint.id && element.id === fingerprint.id) {
      return true;
    }

    // For inputs, type must match
    if (fingerprint.type && element.getAttribute('type') !== fingerprint.type) {
      return false;
    }

    // Check ARIA attributes if present in fingerprint
    if (fingerprint.ariaLabel && element.getAttribute('aria-label') !== fingerprint.ariaLabel) {
      return false;
    }

    if (fingerprint.role && element.getAttribute('role') !== fingerprint.role) {
      return false;
    }

    // For anchors, href is important
    if (fingerprint.href && fingerprint.tagName === 'A') {
      const currentHref = element.getAttribute('href');
      if (currentHref !== fingerprint.href) {
        return false;
      }
    }

    // For form elements, name attribute is important
    if (fingerprint.name && element.getAttribute('name') !== fingerprint.name) {
      return false;
    }

    return true;
  }

  /**
   * Validate that the element at a given index still matches its fingerprint.
   * No recovery - just check if element exists and matches.
   */
  private validateElementAtIndex(index: number): ValidationResult {
    const fingerprint = this.fingerprintMap.get(index);
    if (!fingerprint) {
      // No fingerprint stored - assume OK
      return { isValid: true };
    }

    const element = this.elementMap.get(index);
    if (!element || !document.contains(element)) {
      return { isValid: false, mismatchReason: 'element_removed' };
    }

    if (element instanceof HTMLElement && !this.matchesFingerprint(element, fingerprint)) {
      return { isValid: false, mismatchReason: 'element_changed' };
    }

    return { isValid: true };
  }

  /**
   * Export state for external persistence (selectors and fingerprints)
   */
  exportState(): {
    selectors: Array<[number, string]>;
    fingerprints: Array<[number, ElementFingerprint]>;
  } {
    return {
      selectors: Array.from(this.selectorMap.entries()),
      fingerprints: Array.from(this.fingerprintMap.entries()),
    };
  }

  /**
   * Import state from external persistence (selectors and fingerprints)
   */
  importState(state: {
    selectors?: Array<[number, string]>;
    fingerprints?: Array<[number, ElementFingerprint]>;
  }): void {
    if (!state) return;

    try {
      if (state.selectors) {
        this.selectorMap = new Map(state.selectors);
      }
      if (state.fingerprints) {
        this.fingerprintMap = new Map(state.fingerprints);
      }

      if (this.selectorMap.size > 0 || this.fingerprintMap.size > 0) {
        this.isIndexed = true;
        console.log(
          `[DomService] Restored ${this.selectorMap.size} selectors and ${this.fingerprintMap.size} fingerprints`,
        );
      }
    } catch (e) {
      console.warn('[DomService] Failed to import state:', e);
    }
  }

  /**
   * Index all interactable elements in the live DOM.
   * Always clears previous index first.
   */
  indexInteractableElements(): Array<[number, Element]> {
    if (this.indexingInProgress) {
      console.warn('[DomService] Indexing already in progress, skipping concurrent call');
      return [];
    }

    try {
      this.indexingInProgress = true;
      this.clearIndex(); // Clear existing index

      // Walk the DOM with your visibility logic preserved
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
        acceptNode: (node: Node) => {
          if (node instanceof HTMLElement) {
            if (node.offsetParent === null && node.tagName !== 'BODY') {
              const style = window.getComputedStyle(node);
              const isFixedOrSticky = style.position === 'fixed' || style.position === 'sticky';
              const isDisplayNone = style.display === 'none';

              if (isDisplayNone) return NodeFilter.FILTER_REJECT;

              if (!isFixedOrSticky) {
                let parent = node.parentElement;
                let insideFixedParent = false;

                while (parent && parent !== document.body) {
                  const parentStyle = window.getComputedStyle(parent);
                  if (parentStyle.position === 'fixed' || parentStyle.position === 'sticky') {
                    insideFixedParent = true;
                    break;
                  }
                  parent = parent.parentElement;
                }

                if (!insideFixedParent) return NodeFilter.FILTER_REJECT;
              }
            }
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      });

      let node: Node | null = walker.nextNode();
      let sequenceNumber = 0;
      const indexedElements: Array<[number, Element]> = [];

      while (node) {
        if (node instanceof HTMLElement) {
          // ---- 🔥 ENHANCED INTERACTABLE DETECTION LOGIC HERE ----
          const semantic = node.matches('a[href], button, input, textarea, select, [role="button"]');

          const visuallyClickable = node.classList.contains('cursor-pointer') || node.classList.contains('clickable');

          const hasClickHandler = 'onclick' in node && typeof (node as HTMLElement).onclick === 'function';

          const isNowInteractable = semantic || visuallyClickable || hasClickHandler || isInteractable(node);
          // --------------------------------------------------------

          if (isNowInteractable) {
            this.elementMap.set(sequenceNumber, node);
            this.elementToSequence.set(node, sequenceNumber);

            const selector = this.generateSelector(node);
            this.selectorMap.set(sequenceNumber, selector);

            const fingerprint = this.generateFingerprint(node, selector);
            this.fingerprintMap.set(sequenceNumber, fingerprint);

            indexedElements.push([sequenceNumber, node]);
            sequenceNumber++;
          }
        }

        node = walker.nextNode();
      }

      this.isIndexed = true;
      this.indexVersion++;

      console.log(`[DomService] Indexed ${sequenceNumber} elements (version ${this.indexVersion})`);

      return indexedElements;
    } finally {
      this.indexingInProgress = false;
    }
  }

  /**
   * Get element coordinates using getBoundingClientRect()
   * Returns viewport-relative coordinates
   */
  private getElementCoordinates(element: HTMLElement): {
    x: number;
    y: number;
    w: number;
    h: number;
    z: number;
  } {
    const rect = element.getBoundingClientRect();
    const zIndex = this.calculateGlobalZOrder(element);
    return {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
      z: zIndex,
    };
  }

  /**
   * Check if an element creates a stacking context
   * Based on CSS stacking context rules
   */
  private isStackingContext(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);

    // Positioned elements with z-index (not auto)
    const position = style.position;
    if (
      (position === 'fixed' || position === 'absolute' || position === 'relative' || position === 'sticky') &&
      style.zIndex !== 'auto'
    ) {
      return true;
    }

    // Flex or Grid child with z-index (not auto)
    if (style.zIndex !== 'auto' && element.parentElement) {
      const parentStyle = window.getComputedStyle(element.parentElement);
      const parentDisplay = parentStyle.display;
      if (
        parentDisplay === 'flex' ||
        parentDisplay === 'inline-flex' ||
        parentDisplay === 'grid' ||
        parentDisplay === 'inline-grid'
      ) {
        return true;
      }
    }

    // Opacity less than 1
    const opacity = parseFloat(style.opacity);
    if (!isNaN(opacity) && opacity < 1) {
      return true;
    }

    // Transform (any value other than none)
    if (style.transform && style.transform !== 'none') {
      return true;
    }

    // Filter (any value other than none)
    if (style.filter && style.filter !== 'none') {
      return true;
    }

    // Will-change with transform or opacity
    const willChange = style.willChange;
    if (willChange && (willChange.includes('transform') || willChange.includes('opacity'))) {
      return true;
    }

    // Isolation: isolate
    if (style.isolation === 'isolate') {
      return true;
    }

    // Contain: layout, style, or paint
    const contain = style.contain;
    if (contain && (contain.includes('layout') || contain.includes('style') || contain.includes('paint'))) {
      return true;
    }

    return false;
  }

  /**
   * Calculate global z-order for an element
   * Traverses up the DOM tree to identify stacking contexts and calculate z-order
   */
  private calculateGlobalZOrder(element: HTMLElement): number {
    let current: HTMLElement | null = element;
    const stackingContexts: Array<{ element: HTMLElement; zIndex: number; domOrder: number }> = [];

    // Walk up the DOM tree to document root
    while (current && current !== document.body && current.parentElement) {
      const style = window.getComputedStyle(current);

      // Check if current element creates a stacking context
      if (this.isStackingContext(current)) {
        // Get z-index value (0 if auto)
        let zIndex = 0;
        if (style.zIndex !== 'auto') {
          const parsedZIndex = parseInt(style.zIndex, 10);
          if (!isNaN(parsedZIndex)) {
            zIndex = parsedZIndex;
          }
        }

        // Calculate DOM order among siblings in the same stacking context
        let domOrder = 0;
        if (current.parentElement) {
          const siblings = Array.from(current.parentElement.children);
          domOrder = siblings.indexOf(current);
        }

        stackingContexts.push({ element: current, zIndex, domOrder });
      }

      current = current.parentElement as HTMLElement;
    }

    // Calculate final z-order from stacking contexts
    // Start with a base value and add contributions from each stacking context
    let baseZOrder = 1000000; // Base value to ensure positive numbers

    for (let i = stackingContexts.length - 1; i >= 0; i--) {
      const ctx = stackingContexts[i];
      // Each stacking context level contributes: zIndex * 10000 + domOrder
      // This ensures z-index has more weight than DOM order
      baseZOrder += ctx.zIndex * 10000 + ctx.domOrder;
    }

    // Add final DOM order for the element itself among its siblings
    if (element.parentElement) {
      const siblings = Array.from(element.parentElement.children);
      const finalDomOrder = siblings.indexOf(element);
      baseZOrder += finalDomOrder;
    }

    return baseZOrder;
  }

  /**
   * Get HTML snapshot with data-id attributes injected.
   * This re-indexes the live DOM and then produces a corresponding HTML string.
   */
  getSnapshotHtml(): string {
    // Re-index first to ensure we have latest state
    this.indexInteractableElements();

    // Clone document for output
    const clone = document.documentElement.cloneNode(true) as Element;

    // Instead of walking both trees in sync (which can fail with modals/fixed elements),
    // we directly inject data-id attributes based on our element map
    // by finding matching elements in the clone via selectors

    for (const [index, element] of this.elementMap.entries()) {
      if (element instanceof HTMLElement) {
        // Generate a selector for this element
        const selector = this.selectorMap.get(index);
        if (selector) {
          try {
            // Find the same element in the clone
            const cloneBody = clone.querySelector('body') || clone;
            const cloneElement = cloneBody.querySelector(selector);
            if (cloneElement) {
              // Add data-id attribute
              cloneElement.setAttribute('data-id', index.toString());

              // Get coordinates and z-order from the live element
              const style = window.getComputedStyle(element);
              const isDisplayNone = style.display === 'none';

              // Handle edge cases: skip hidden elements or set coordinates to 0
              if (isDisplayNone) {
                cloneElement.setAttribute('data-x', '0');
                cloneElement.setAttribute('data-y', '0');
                cloneElement.setAttribute('data-w', '0');
                cloneElement.setAttribute('data-h', '0');
                cloneElement.setAttribute('data-z', '0');
              } else {
                // Extract coordinates
                const coords = this.getElementCoordinates(element);
                cloneElement.setAttribute('data-x', coords.x.toString());
                cloneElement.setAttribute('data-y', coords.y.toString());
                cloneElement.setAttribute('data-w', coords.w.toString());
                cloneElement.setAttribute('data-h', coords.h.toString());
                cloneElement.setAttribute('data-z', coords.z.toString());
              }
            }
          } catch (e) {
            // Selector might be invalid, skip this element
            console.warn(`[DomService] Failed to apply data attributes for index ${index}:`, e);
          }
        }
      }
    }

    return clone.outerHTML;
  }

  /**
   * Get actionable elements metadata
   */
  getInteractableElements(): Array<{
    index: number;
    fingerprint: ElementFingerprint;
    coords: { x: number; y: number; w: number; h: number; z: number };
    cssClasses: string[];
  }> {
    // Re-index first to ensure we have latest state
    this.indexInteractableElements();

    const elements: Array<{
      index: number;
      fingerprint: ElementFingerprint;
      coords: { x: number; y: number; w: number; h: number; z: number };
      cssClasses: string[];
    }> = [];

    for (const [index, element] of this.elementMap.entries()) {
      if (element instanceof HTMLElement) {
        const fingerprint = this.fingerprintMap.get(index);

        if (fingerprint) {
          elements.push({
            index,
            fingerprint,
            coords: this.getElementCoordinates(element),
            cssClasses: Array.from(element.classList),
          });
        }
      }
    }

    return elements;
  }

  getElementByDataId(id: number): Element | undefined {
    // Validate index freshness? (Optional)
    return this.elementMap.get(id);
  }

  getSequenceForElement(element: Element): number | undefined {
    return this.elementToSequence.get(element);
  }

  isIndexActive(): boolean {
    return this.isIndexed;
  }

  clearIndex(): void {
    this.elementMap.clear();
    this.elementToSequence = new WeakMap(); // Reset WeakMap
    this.fingerprintMap.clear();
    this.isIndexed = false;
  }

  /**
   * Check if an element is interactable (visible, not hidden, not obscured).
   * Returns error string if not interactable, null if OK.
   */
  private checkInteractability(element: HTMLElement, index: number): string | null {
    if (!document.body.contains(element)) {
      return `ELEMENT_NOT_INTERACTABLE: Element ${index} is not in the DOM`;
    }

    const style = window.getComputedStyle(element);
    if (style.display === 'none') {
      return `ELEMENT_NOT_INTERACTABLE: Element ${index} has display:none`;
    }
    if (style.visibility === 'hidden') {
      return `ELEMENT_NOT_INTERACTABLE: Element ${index} has visibility:hidden`;
    }
    if (parseFloat(style.opacity) === 0) {
      return `ELEMENT_NOT_INTERACTABLE: Element ${index} has opacity:0`;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return `ELEMENT_NOT_INTERACTABLE: Element ${index} has zero dimensions`;
    }

    if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
      return `ELEMENT_NOT_INTERACTABLE: Element ${index} is off-screen`;
    }

    // Occlusion check
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const topElement = document.elementFromPoint(centerX, centerY);

    if (topElement && topElement !== element && !element.contains(topElement)) {
      const isMarketrixUI =
        topElement.closest('#marketrix-show-highlight') ||
        topElement.closest('#marketrix-show-popup') ||
        topElement.closest('[data-marketrix-widget]');
      if (!isMarketrixUI) {
        const tagName = topElement.tagName.toLowerCase();
        const obscurerInfo = topElement.className ? `${tagName}.${topElement.className.split(' ')[0]}` : tagName;
        return (
          `ELEMENT_OBSCURED: Element ${index} is covered by ${obscurerInfo}. ` +
          `The obscuring element may be a modal or overlay that needs to be dismissed first.`
        );
      }
    }

    return null; // Element is interactable
  }

  /**
   * Public method to check element interactability (for use by ShowModeService).
   */
  checkElementInteractable(element: HTMLElement, index: number): string | null {
    return this.checkInteractability(element, index);
  }

  /**
   * Get an interactive element by its index.
   * Returns element only if it's interactable, otherwise returns null with error.
   */
  getElementByIndex(index: number): ElementLookupResult {
    let element: HTMLElement | null = null;

    // Try live map first
    if (this.elementMap.has(index)) {
      const mapElement = this.elementMap.get(index);
      if (mapElement && mapElement instanceof HTMLElement) {
        element = mapElement;
      }
    }

    // Fallback to selector map (persistence)
    if (!element && this.selectorMap.has(index)) {
      const selector = this.selectorMap.get(index);
      if (selector) {
        try {
          const queriedElement = document.querySelector(selector);
          if (queriedElement && queriedElement instanceof HTMLElement) {
            element = queriedElement;
          }
        } catch (e) {
          console.warn(`[DomService] Failed to find element by selector for index ${index}:`, e);
        }
      }
    }

    if (!element) {
      return { element: null, error: `Element ${index} not found` };
    }

    // Check interactability
    const interactError = this.checkInteractability(element, index);
    if (interactError) {
      return { element: null, error: interactError };
    }

    return { element };
  }

  /**
   * Get an element by index with validation.
   * This is the main entry point for ToolService to use.
   * It validates the element matches its fingerprint and attempts recovery if not.
   * Returns element only if it's interactable.
   */
  getValidatedElement(index: number): ValidatedElementResult {
    const validation = this.validateElementAtIndex(index);

    if (!validation.isValid) {
      const reason = validation.mismatchReason === 'element_removed' ? 'no longer exists' : 'has changed';
      return {
        element: null,
        validation,
        error: `DOM_CHANGED: Element at index ${index} ${reason}. Call get_html to get updated indices.`,
      };
    }

    const element = this.elementMap.get(index) as HTMLElement | undefined;
    if (!element) {
      return {
        element: null,
        validation,
        error: `Element ${index} not found`,
      };
    }

    // Check interactability
    const interactError = this.checkInteractability(element, index);
    if (interactError) {
      return { element: null, validation, error: interactError };
    }

    return { element, validation };
  }

  /**
   * Get fingerprint for a given index (for debugging/testing)
   */
  getFingerprint(index: number): ElementFingerprint | undefined {
    return this.fingerprintMap.get(index);
  }

  /**
   * Get all fingerprints (for debugging/testing)
   */
  getAllFingerprints(): Array<[number, ElementFingerprint]> {
    return Array.from(this.fingerprintMap.entries());
  }

  /**
   * Get current index version
   */
  getIndexVersion(): number {
    return this.indexVersion;
  }
}

export const domService = DomService.getInstance();
