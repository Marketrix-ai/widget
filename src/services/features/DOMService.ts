import { isInteractable } from '../../utils/dom/htmlUtils';

export class DOMService {
  private static instance: DOMService;
  private elementMap: Map<number, Element> = new Map();
  private elementToSequence: WeakMap<Element, number> = new WeakMap();
  private isIndexed: boolean = false;
  private indexingInProgress: boolean = false;
  private indexVersion: number = 0;

  private constructor() {}

  static getInstance(): DOMService {
    if (!DOMService.instance) {
      DOMService.instance = new DOMService();
    }
    return DOMService.instance;
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
            indexedElements.push([sequenceNumber, node]);
            sequenceNumber++;
          }
        }
        node = walker.nextNode();
      }

      this.isIndexed = true;
      this.indexVersion++;
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
    if (this.isIndexed) {
      const element = this.elementMap.get(index);
      if (element && element instanceof HTMLElement) {
        return element;
      }
    }
    return null;
  }
}

export const domService = DOMService.getInstance();
