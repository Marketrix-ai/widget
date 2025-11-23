import { isInteractable } from '../utils/dom';

export class DOMService {
  private static instance: DOMService;
  private elementMap: Map<number, Element> = new Map();
  private elementToSequence: WeakMap<Element, number> = new WeakMap();
  private selectorMap: Map<number, string> = new Map();
  private isIndexed: boolean = false;
  private indexingInProgress: boolean = false;
  private indexVersion: number = 0;
  private readonly STORAGE_KEY = 'marketrix_dom_index';

  private constructor() {
    this.restoreState();
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
   * Save selector mapping to local storage
   */
  private saveState(): void {
    try {
      const serialized = JSON.stringify(Array.from(this.selectorMap.entries()));
      localStorage.setItem(this.STORAGE_KEY, serialized);
    } catch (e) {
      console.warn('[DOMService] Failed to save state:', e);
    }
  }

  /**
   * Restore selector mapping from local storage
   */
  private restoreState(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const entries = JSON.parse(stored);
        this.selectorMap = new Map(entries);
        if (this.selectorMap.size > 0) {
          this.isIndexed = true; // Treat as indexed if we have selectors
          console.log(`[DOMService] Restored ${this.selectorMap.size} element mappings`);
        }
      }
    } catch (e) {
      console.warn('[DOMService] Failed to restore state:', e);
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

            indexedElements.push([sequenceNumber, node]);
            sequenceNumber++;
          }
        }
        node = walker.nextNode();
      }

      this.isIndexed = true;
      this.indexVersion++;
      this.saveState(); // Persist the new mapping
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
}

export const domService = DOMService.getInstance();
