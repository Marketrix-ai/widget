import { isInteractable } from '../utils/dom';

// The agent addresses elements by index, so an index must not survive the element changing underneath it: the node
// object stays the same across a re-render while its attributes are rewritten.
const IDENTITY_ATTRIBUTES = ['type', 'role', 'aria-label', 'name', 'href'] as const;

interface IndexedElement {
  element: HTMLElement;
  selector: string;
  id: string;
  identity: Array<string | null>;
}

export interface ValidatedElementResult {
  element: HTMLElement | null;
  error?: string;
}

export class DomService {
  private index: Map<number, IndexedElement> = new Map();
  private elementToSequence: WeakMap<Element, number> = new WeakMap();

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

  private staleReason(entry: IndexedElement): string | null {
    if (!document.contains(entry.element)) return 'no longer exists';
    if (entry.id && entry.element.id === entry.id) return null;
    const changed = IDENTITY_ATTRIBUTES.some(
      (attribute, i) => entry.identity[i] && entry.element.getAttribute(attribute) !== entry.identity[i],
    );
    return changed ? 'has changed' : null;
  }

  private indexInteractableElements(): void {
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

    while (node) {
      const element = node instanceof HTMLElement ? node : null;
      if (element) {
        const semantic = element.matches('a[href], button, input, textarea, select, [role="button"]');
        const visuallyClickable =
          element.classList.contains('cursor-pointer') || element.classList.contains('clickable');
        const hasClickHandler = typeof element.onclick === 'function';

        if (semantic || visuallyClickable || hasClickHandler || isInteractable(element)) {
          this.index.set(sequenceNumber, {
            element,
            selector: this.generateSelector(element),
            id: element.id,
            identity: IDENTITY_ATTRIBUTES.map(attribute => element.getAttribute(attribute)),
          });
          this.elementToSequence.set(element, sequenceNumber);
          sequenceNumber++;
        }
      }

      node = walker.nextNode();
    }

    console.log(`[DomService] Indexed ${sequenceNumber} elements`);
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
    const parentDisplay = element.parentElement ? window.getComputedStyle(element.parentElement).display : '';
    return (
      (['fixed', 'absolute', 'relative', 'sticky'].includes(style.position) && style.zIndex !== 'auto') ||
      (style.zIndex !== 'auto' && ['flex', 'inline-flex', 'grid', 'inline-grid'].includes(parentDisplay)) ||
      parseFloat(style.opacity) < 1 ||
      (!!style.transform && style.transform !== 'none') ||
      (!!style.filter && style.filter !== 'none') ||
      /transform|opacity/.test(style.willChange) ||
      style.isolation === 'isolate' ||
      /layout|style|paint/.test(style.contain)
    );
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
    for (const [index, { element, selector }] of this.index.entries()) {
      try {
        const cloneElement = (clone.querySelector('body') || clone).querySelector(selector);
        if (!cloneElement) continue;
        cloneElement.setAttribute('data-id', index.toString());

        const hidden = window.getComputedStyle(element).display === 'none';
        const coords = hidden ? { x: 0, y: 0, w: 0, h: 0, z: 0 } : this.getElementCoordinates(element);
        for (const [key, value] of Object.entries(coords)) {
          cloneElement.setAttribute(`data-${key}`, value.toString());
        }
      } catch (e) {
        console.warn(`[DomService] Failed to apply data attributes for index ${index}:`, e);
      }
    }

    return clone.outerHTML;
  }

  getSequenceForElement(element: Element): number | undefined {
    return this.elementToSequence.get(element);
  }

  private clearIndex(): void {
    this.index.clear();
    this.elementToSequence = new WeakMap();
  }

  checkElementInteractable(element: HTMLElement, index: number): string | null {
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

  getValidatedElement(index: number): ValidatedElementResult {
    const entry = this.index.get(index);
    if (!entry) {
      return { element: null, error: `Element ${index} not found` };
    }

    const stale = this.staleReason(entry);
    if (stale) {
      return {
        element: null,
        error: `DOM_CHANGED: Element at index ${index} ${stale}. Call get_html to get updated indices.`,
      };
    }

    const interactError = this.checkElementInteractable(entry.element, index);
    if (interactError) {
      return { element: null, error: interactError };
    }

    return { element: entry.element };
  }
}

export const domService = new DomService();
