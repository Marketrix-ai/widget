import { isInteractable } from '../utils/dom';

export interface ElementFingerprint {
  tagName: string;
  id: string | null;
  textContent: string | null; // truncated to 100 chars
  type: string | null;
  role: string | null;
  ariaLabel: string | null;
  name: string | null;
  href: string | null;
  selector: string;
  indexVersion: number;
}

export interface ValidationResult {
  isValid: boolean;
  mismatchReason?: 'element_removed' | 'element_changed';
}

export interface ElementLookupResult {
  element: HTMLElement | null;
  error?: string;
}

export interface ValidatedElementResult extends ElementLookupResult {
  validation: ValidationResult;
}

export class DomService {
  private static instance: DomService;
  private elementMap: Map<number, Element> = new Map();
  private elementToSequence: WeakMap<Element, number> = new WeakMap();
  private selectorMap: Map<number, string> = new Map();
  private fingerprintMap: Map<number, ElementFingerprint> = new Map();
  private indexingInProgress: boolean = false;
  private indexVersion: number = 0;

  private constructor() {}

  static getInstance(): DomService {
    if (!DomService.instance) {
      DomService.instance = new DomService();
    }
    return DomService.instance;
  }

  private generateSelector(element: Element): string {
    if (element.id) {
      if (document.querySelectorAll(`#${CSS.escape(element.id)}`).length === 1) {
        return `#${CSS.escape(element.id)}`;
      }
    }

    const path: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.body && current.parentElement) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector += `#${CSS.escape(current.id)}`;
        path.unshift(selector);
        break; // an id anchors the path
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

  private matchesFingerprint(element: Element, fingerprint: ElementFingerprint): boolean {
    if (element.tagName !== fingerprint.tagName) {
      return false;
    }

    if (fingerprint.id && element.id === fingerprint.id) {
      return true;
    }

    if (fingerprint.type && element.getAttribute('type') !== fingerprint.type) {
      return false;
    }

    if (fingerprint.ariaLabel && element.getAttribute('aria-label') !== fingerprint.ariaLabel) {
      return false;
    }

    if (fingerprint.role && element.getAttribute('role') !== fingerprint.role) {
      return false;
    }

    if (fingerprint.href && fingerprint.tagName === 'A') {
      const currentHref = element.getAttribute('href');
      if (currentHref !== fingerprint.href) {
        return false;
      }
    }

    if (fingerprint.name && element.getAttribute('name') !== fingerprint.name) {
      return false;
    }

    return true;
  }

  private validateElementAtIndex(index: number): ValidationResult {
    const fingerprint = this.fingerprintMap.get(index);
    if (!fingerprint) {
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

  indexInteractableElements(): Array<[number, Element]> {
    if (this.indexingInProgress) {
      console.warn('[DomService] Indexing already in progress, skipping concurrent call');
      return [];
    }

    try {
      this.indexingInProgress = true;
      this.clearIndex();

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
          const semantic = node.matches('a[href], button, input, textarea, select, [role="button"]');

          const visuallyClickable = node.classList.contains('cursor-pointer') || node.classList.contains('clickable');

          const hasClickHandler = 'onclick' in node && typeof (node as HTMLElement).onclick === 'function';

          const isNowInteractable = semantic || visuallyClickable || hasClickHandler || isInteractable(node);

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

      this.indexVersion++;

      console.log(`[DomService] Indexed ${sequenceNumber} elements (version ${this.indexVersion})`);

      return indexedElements;
    } finally {
      this.indexingInProgress = false;
    }
  }

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

  private isStackingContext(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);

    const position = style.position;
    if (
      (position === 'fixed' || position === 'absolute' || position === 'relative' || position === 'sticky') &&
      style.zIndex !== 'auto'
    ) {
      return true;
    }

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

    const opacity = parseFloat(style.opacity);
    if (!isNaN(opacity) && opacity < 1) {
      return true;
    }

    if (style.transform && style.transform !== 'none') {
      return true;
    }

    if (style.filter && style.filter !== 'none') {
      return true;
    }

    const willChange = style.willChange;
    if (willChange && (willChange.includes('transform') || willChange.includes('opacity'))) {
      return true;
    }

    if (style.isolation === 'isolate') {
      return true;
    }

    const contain = style.contain;
    if (contain && (contain.includes('layout') || contain.includes('style') || contain.includes('paint'))) {
      return true;
    }

    return false;
  }

  private calculateGlobalZOrder(element: HTMLElement): number {
    let current: HTMLElement | null = element;
    const stackingContexts: Array<{ element: HTMLElement; zIndex: number; domOrder: number }> = [];

    while (current && current !== document.body && current.parentElement) {
      const style = window.getComputedStyle(current);

      if (this.isStackingContext(current)) {
        let zIndex = 0;
        if (style.zIndex !== 'auto') {
          const parsedZIndex = parseInt(style.zIndex, 10);
          if (!isNaN(parsedZIndex)) {
            zIndex = parsedZIndex;
          }
        }

        let domOrder = 0;
        if (current.parentElement) {
          const siblings = Array.from(current.parentElement.children);
          domOrder = siblings.indexOf(current);
        }

        stackingContexts.push({ element: current, zIndex, domOrder });
      }

      current = current.parentElement as HTMLElement;
    }

    let baseZOrder = 1000000; // base offset keeps the result positive

    for (let i = stackingContexts.length - 1; i >= 0; i--) {
      const ctx = stackingContexts[i];
      // zIndex * 10000 weights z-index above DOM order.
      baseZOrder += ctx.zIndex * 10000 + ctx.domOrder;
    }

    if (element.parentElement) {
      const siblings = Array.from(element.parentElement.children);
      const finalDomOrder = siblings.indexOf(element);
      baseZOrder += finalDomOrder;
    }

    return baseZOrder;
  }

  getSnapshotHtml(): string {
    this.indexInteractableElements();

    const clone = document.documentElement.cloneNode(true) as Element;

    // Match into the clone by selector — a synced two-tree walk breaks on modals and fixed elements.
    for (const [index, element] of this.elementMap.entries()) {
      if (element instanceof HTMLElement) {
        const selector = this.selectorMap.get(index);
        if (selector) {
          try {
            const cloneBody = clone.querySelector('body') || clone;
            const cloneElement = cloneBody.querySelector(selector);
            if (cloneElement) {
              cloneElement.setAttribute('data-id', index.toString());

              const style = window.getComputedStyle(element);
              const isDisplayNone = style.display === 'none';

              if (isDisplayNone) {
                cloneElement.setAttribute('data-x', '0');
                cloneElement.setAttribute('data-y', '0');
                cloneElement.setAttribute('data-w', '0');
                cloneElement.setAttribute('data-h', '0');
                cloneElement.setAttribute('data-z', '0');
              } else {
                const coords = this.getElementCoordinates(element);
                cloneElement.setAttribute('data-x', coords.x.toString());
                cloneElement.setAttribute('data-y', coords.y.toString());
                cloneElement.setAttribute('data-w', coords.w.toString());
                cloneElement.setAttribute('data-h', coords.h.toString());
                cloneElement.setAttribute('data-z', coords.z.toString());
              }
            }
          } catch (e) {
            console.warn(`[DomService] Failed to apply data attributes for index ${index}:`, e);
          }
        }
      }
    }

    return clone.outerHTML;
  }

  getInteractableElements(): Array<{
    index: number;
    fingerprint: ElementFingerprint;
    coords: { x: number; y: number; w: number; h: number; z: number };
    cssClasses: string[];
  }> {
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

  getSequenceForElement(element: Element): number | undefined {
    return this.elementToSequence.get(element);
  }

  clearIndex(): void {
    this.elementMap.clear();
    this.elementToSequence = new WeakMap();
    this.fingerprintMap.clear();
  }

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

    return null;
  }

  checkElementInteractable(element: HTMLElement, index: number): string | null {
    return this.checkInteractability(element, index);
  }

  getElementByIndex(index: number): ElementLookupResult {
    let element: HTMLElement | null = null;

    if (this.elementMap.has(index)) {
      const mapElement = this.elementMap.get(index);
      if (mapElement && mapElement instanceof HTMLElement) {
        element = mapElement;
      }
    }

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

    const interactError = this.checkInteractability(element, index);
    if (interactError) {
      return { element: null, error: interactError };
    }

    return { element };
  }

  /** Prefer this over the looser getElementByIndex — it also fingerprint-checks the index. */
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

    const interactError = this.checkInteractability(element, index);
    if (interactError) {
      return { element: null, validation, error: interactError };
    }

    return { element, validation };
  }
}

export const domService = DomService.getInstance();
