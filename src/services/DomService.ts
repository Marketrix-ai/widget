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
  mismatchReason?: 'element_removed' | 'element_changed' | 'index_shifted';
  recoveredElement?: HTMLElement;
  recoveredIndex?: number;
  requiresReindex?: boolean;
}

export class DOMService {
  private static instance: DOMService;
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

  static getInstance(): DOMService {
    if (!DOMService.instance) {
      DOMService.instance = new DOMService();
    }
    return DOMService.instance;
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
        const siblings = Array.from(parent.children).filter((c) => c.tagName === current!.tagName);
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
      return normalized.length > maxLen ? normalized.substring(0, maxLen) : normalized;
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
   * Calculate similarity between two strings using word-based Jaccard similarity
   * Returns a value between 0 and 1
   */
  private calculateSimilarity(str1: string | null, str2: string | null): number {
    if (str1 === str2) return 1;
    if (!str1 || !str2) return 0;

    // Simple word-based Jaccard similarity
    const words1 = new Set(
      str1
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 0)
    );
    const words2 = new Set(
      str2
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 0)
    );

    if (words1.size === 0 && words2.size === 0) return 1;
    if (words1.size === 0 || words2.size === 0) return 0;

    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Check if an element matches a stored fingerprint
   * Uses various heuristics to determine identity
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

    // Check text content similarity (allow some tolerance for dynamic content)
    const currentText = element.textContent?.trim().replace(/\s+/g, ' ').substring(0, 100) || null;
    if (fingerprint.textContent && currentText) {
      const similarity = this.calculateSimilarity(fingerprint.textContent, currentText);
      if (similarity < 0.7) {
        return false;
      }
    }

    return true;
  }

  /**
   * Search the entire DOM for an element matching the fingerprint
   * This is a last-resort recovery method
   */
  private searchDomForMatch(fingerprint: ElementFingerprint): HTMLElement | null {
    // Build a query based on tag and key attributes
    let query = fingerprint.tagName.toLowerCase();

    if (fingerprint.id) {
      query = `#${CSS.escape(fingerprint.id)}`;
    } else if (fingerprint.type) {
      query = `${fingerprint.tagName.toLowerCase()}[type="${fingerprint.type}"]`;
    }

    try {
      const candidates = document.querySelectorAll(query);

      // Limit search to prevent performance issues
      const maxCandidates = Math.min(candidates.length, 1000);

      for (let i = 0; i < maxCandidates; i++) {
        const elem = candidates[i];
        if (elem instanceof HTMLElement && this.matchesFingerprint(elem, fingerprint)) {
          return elem;
        }
      }
    } catch (e) {
      console.warn('[DOMService] DOM search failed:', e);
    }

    return null;
  }

  /**
   * Attempt to recover an element that doesn't match at its expected index
   */
  private attemptRecovery(index: number, fingerprint: ElementFingerprint): ValidationResult {
    console.log(`[DOMService] Attempting recovery for index ${index}`);

    // Get the original element reference if it exists
    const originalElement = this.elementMap.get(index);
    const originalElementStillExists = originalElement && document.contains(originalElement);

    // Strategy 1: Try CSS selector
    const selector = fingerprint.selector;
    if (selector) {
      try {
        const element = document.querySelector(selector);
        if (element && element instanceof HTMLElement) {
          // If selector returns the SAME element reference (just content changed),
          // it's safe to use even if text doesn't match
          if (originalElement === element && originalElementStillExists) {
            console.log(
              `[DOMService] Same element via selector, content may have changed: ${selector}`
            );
            return {
              isValid: false,
              mismatchReason: 'element_changed',
              recoveredElement: element,
              recoveredIndex: index,
              requiresReindex: false,
            };
          }

          if (this.matchesFingerprint(element, fingerprint)) {
            console.log(`[DOMService] Recovered element via selector: ${selector}`);

            // Check if element is at a different index now
            const currentIndex = this.elementToSequence.get(element);
            if (currentIndex !== undefined && currentIndex !== index) {
              return {
                isValid: false,
                mismatchReason: 'index_shifted',
                recoveredElement: element,
                recoveredIndex: currentIndex,
                requiresReindex: false,
              };
            }

            // Element found via selector, update mapping and return
            this.elementMap.set(index, element);
            return {
              isValid: true,
              recoveredElement: element,
            };
          }

          // IMPORTANT: Only do relaxed recovery if the ORIGINAL element still exists
          // This handles content changes. If original was REMOVED, don't accept a different element.
          if (originalElementStillExists && element.tagName === fingerprint.tagName) {
            console.log(`[DOMService] Relaxed recovery via selector (tag matches): ${selector}`);
            return {
              isValid: false,
              mismatchReason: 'element_changed',
              recoveredElement: element,
              recoveredIndex: index,
              requiresReindex: false,
            };
          }
        }
      } catch (e) {
        console.warn('[DOMService] Selector recovery failed:', e);
      }
    }

    // Strategy 2: Search all currently indexed elements for a match
    // Only consider elements that are still in the document
    for (const [idx, elem] of this.elementMap.entries()) {
      if (
        elem instanceof HTMLElement &&
        document.contains(elem) &&
        this.matchesFingerprint(elem, fingerprint)
      ) {
        console.log(`[DOMService] Found matching element at different index: ${idx}`);
        return {
          isValid: false,
          mismatchReason: 'index_shifted',
          recoveredElement: elem,
          recoveredIndex: idx,
          requiresReindex: false,
        };
      }
    }

    // Strategy 3: Search entire DOM for matching element (expensive, last resort)
    const matchingElement = this.searchDomForMatch(fingerprint);
    if (matchingElement) {
      console.log('[DOMService] Found matching element in DOM, requires re-index');
      return {
        isValid: false,
        mismatchReason: 'index_shifted',
        recoveredElement: matchingElement,
        requiresReindex: true, // Element exists but needs re-indexing
      };
    }

    // Element truly removed or changed beyond recognition
    console.log(`[DOMService] Element at index ${index} could not be recovered`);
    return {
      isValid: false,
      mismatchReason: 'element_removed',
      requiresReindex: true,
    };
  }

  /**
   * Get the current DOM position of an element by re-traversing interactable elements
   * Uses the same TreeWalker approach as indexInteractableElements for consistency
   * Returns -1 if element is not found in current interactable elements
   */
  private getCurrentDomPosition(targetElement: HTMLElement): number {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node: Node) => {
        if (node instanceof HTMLElement) {
          if (node.offsetParent === null && node.tagName !== 'BODY') {
            return NodeFilter.FILTER_REJECT;
          }
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let node: Node | null = walker.nextNode();
    let position = 0;

    while (node) {
      if (node instanceof Element && isInteractable(node)) {
        if (node === targetElement) {
          return position;
        }
        position++;
      }
      node = walker.nextNode();
    }

    return -1; // Element not found in current interactable elements
  }

  /**
   * Validate that the element at a given index still matches its fingerprint
   */
  private validateElementAtIndex(index: number): ValidationResult {
    const fingerprint = this.fingerprintMap.get(index);
    if (!fingerprint) {
      // No fingerprint stored - cannot validate, proceed with caution
      console.warn(`[DOMService] No fingerprint for index ${index}, skipping validation`);
      return { isValid: true };
    }

    // Check if index version is stale (informational)
    if (fingerprint.indexVersion !== this.indexVersion) {
      console.warn(
        `[DOMService] Fingerprint version (${fingerprint.indexVersion}) differs from current index version (${this.indexVersion})`
      );
    }

    // Step 1: Check element in live map
    const currentElement = this.elementMap.get(index);
    if (currentElement && currentElement instanceof HTMLElement) {
      // CRITICAL: Check if element is still in the document (not removed)
      if (!document.contains(currentElement)) {
        console.log(`[DOMService] Element at index ${index} was removed from DOM`);
        return this.attemptRecovery(index, fingerprint);
      }

      // CRITICAL: Check if element is still at the expected DOM position
      // Elements may have shifted due to insertions/removals
      const currentDomPosition = this.getCurrentDomPosition(currentElement);
      if (currentDomPosition !== -1 && currentDomPosition !== index) {
        console.log(
          `[DOMService] Element shifted from index ${index} to DOM position ${currentDomPosition}`
        );
        return {
          isValid: false,
          mismatchReason: 'index_shifted',
          recoveredElement: currentElement,
          recoveredIndex: currentDomPosition,
          requiresReindex: false,
        };
      }

      if (this.matchesFingerprint(currentElement, fingerprint)) {
        return { isValid: true };
      }
      // Element at index doesn't match - it changed
      console.log(`[DOMService] Element at index ${index} doesn't match fingerprint`);
    }

    // Step 2: Element not in map or doesn't match - attempt recovery
    return this.attemptRecovery(index, fingerprint);
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
  importState(
    state:
      | {
          selectors?: Array<[number, string]>;
          fingerprints?: Array<[number, ElementFingerprint]>;
        }
      | Array<[number, string]>
  ): void {
    if (!state) return;

    try {
      // Handle legacy format (just selectors array)
      if (Array.isArray(state)) {
        this.selectorMap = new Map(state);
        if (this.selectorMap.size > 0) {
          this.isIndexed = true;
          console.log(
            `[DOMService] Restored ${this.selectorMap.size} element mappings (legacy format)`
          );
        }
        return;
      }

      // Handle new format with selectors and fingerprints
      if (state.selectors) {
        this.selectorMap = new Map(state.selectors);
      }
      if (state.fingerprints) {
        this.fingerprintMap = new Map(state.fingerprints);
      }

      if (this.selectorMap.size > 0 || this.fingerprintMap.size > 0) {
        this.isIndexed = true;
        console.log(
          `[DOMService] Restored ${this.selectorMap.size} selectors and ${this.fingerprintMap.size} fingerprints`
        );
      }
    } catch (e) {
      console.warn('[DOMService] Failed to import state:', e);
    }
  }

  /**
   * Index all interactable elements in the live DOM.
   * Always clears previous index first.
   */
  indexInteractableElements(): Array<[number, Element]> {
    if (this.indexingInProgress) {
      console.warn('[DOMService] Indexing already in progress, skipping concurrent call');
      return [];
    }

    try {
      this.indexingInProgress = true;
      this.clearIndex(); // Clear existing index

      // Walk the DOM tree in document order
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
        acceptNode: (node: Node) => {
          // Skip invisible elements immediately to improve performance
          if (node instanceof HTMLElement) {
            if (node.offsetParent === null && node.tagName !== 'BODY') {
              return NodeFilter.FILTER_REJECT; // Skip this node and its children
            }
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      });

      let node: Node | null = walker.nextNode();
      let sequenceNumber = 0;
      const indexedElements: Array<[number, Element]> = [];

      while (node) {
        if (node instanceof Element) {
          if (isInteractable(node)) {
            // Add to index
            this.elementMap.set(sequenceNumber, node);
            this.elementToSequence.set(node, sequenceNumber);

            // Generate and store selector
            const selector = this.generateSelector(node);
            this.selectorMap.set(sequenceNumber, selector);

            // Generate and store fingerprint for validation
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
      // State persistence is now handled by ChatService/WidgetContext via exportState()
      console.log(`[DOMService] Indexed ${sequenceNumber} elements (version ${this.indexVersion})`);

      return indexedElements;
    } finally {
      this.indexingInProgress = false;
    }
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

    // We need to match live elements to clone elements to inject attributes.
    // Since we just indexed, we can try to walk both trees in sync.
    // This assumes the clone operation creates an identical tree structure (which it should).

    const liveWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    // Find body in clone to start walking from same point
    const cloneBody = clone.querySelector('body') || clone;
    const cloneWalker = document.createTreeWalker(cloneBody, NodeFilter.SHOW_ELEMENT);

    let liveNode: Node | null = liveWalker.nextNode();
    let cloneNode: Node | null = cloneWalker.nextNode();

    while (liveNode && cloneNode) {
      // Synchronize walkers?
      // `cloneNode(true)` copies everything including non-element nodes (if we used cloning on node),
      // but `createTreeWalker` only shows elements.
      // This lock-step should work for identical trees.

      if (liveNode instanceof Element && cloneNode instanceof Element) {
        const seq = this.elementToSequence.get(liveNode);
        if (seq !== undefined) {
          cloneNode.setAttribute('data-id', seq.toString());
        }
      }

      liveNode = liveWalker.nextNode();
      cloneNode = cloneWalker.nextNode();
    }

    return clone.outerHTML;
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
   * Get an interactive element by its index.
   * Preferentially uses the current index.
   */
  getElementByIndex(index: number): HTMLElement | null {
    // Try live map first
    if (this.elementMap.has(index)) {
      const element = this.elementMap.get(index);
      if (element && element instanceof HTMLElement) {
        return element;
      }
    }

    // Fallback to selector map (persistence)
    if (this.selectorMap.has(index)) {
      const selector = this.selectorMap.get(index);
      if (selector) {
        try {
          const element = document.querySelector(selector);
          if (element && element instanceof HTMLElement) {
            // Optimization: Cache it back to live map?
            // Maybe not, as it might change again. But fine for now.
            return element;
          }
        } catch (e) {
          console.warn(`[DOMService] Failed to find element by selector for index ${index}:`, e);
        }
      }
    }

    return null;
  }

  /**
   * Get an element by index with validation.
   * This is the main entry point for ToolService to use.
   * It validates the element matches its fingerprint and attempts recovery if not.
   */
  getValidatedElement(index: number): {
    element: HTMLElement | null;
    validation: ValidationResult;
  } {
    const validation = this.validateElementAtIndex(index);

    if (validation.isValid) {
      const element = this.getElementByIndex(index);
      return { element, validation };
    }

    if (validation.recoveredElement) {
      return { element: validation.recoveredElement, validation };
    }

    return { element: null, validation };
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

export const domService = DOMService.getInstance();
