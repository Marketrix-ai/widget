import { isInteractable, WIDGET_SHADOW_HOST_CLASS } from '../utils/dom';

// The agent addresses elements by index, so an index must not survive the element changing underneath it: the node
// object stays the same across a re-render while its attributes are rewritten.
const IDENTITY_ATTRIBUTES = ['id', 'type', 'role', 'aria-label', 'name', 'href'] as const;

interface IndexedElement {
  element: HTMLElement;
  selector: string;
  identity: Array<string | null>;
}

export interface ValidatedElementResult {
  element: HTMLElement | null;
  error?: string;
}

export class DomService {
  private index: Map<number, IndexedElement> = new Map();
  private elementToSequence: WeakMap<Element, number> = new WeakMap();

  private generateAnchoredSelector(element: Element): string {
    const path: string[] = [];
    let current: Element = element;

    while (current !== document.body) {
      const idSelector = current.id ? `#${CSS.escape(current.id)}` : '';
      if (idSelector && document.querySelectorAll(idSelector).length === 1) {
        path.unshift(idSelector);
        return path.join(' > ');
      }

      const parent = current.parentElement;
      if (!parent) break;

      const tagName = current.tagName;
      const siblings = Array.from(parent.children).filter(child => child.tagName === tagName);
      const position = siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(current) + 1})` : '';

      path.unshift(tagName.toLowerCase() + position);
      current = parent;
    }

    return ['body', ...path].join(' > ');
  }

  private staleReason(entry: IndexedElement): string | null {
    if (!document.contains(entry.element)) return 'no longer exists';
    const changed = IDENTITY_ATTRIBUTES.some(
      (attribute, i) => entry.element.getAttribute(attribute) !== entry.identity[i],
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
            selector: this.generateAnchoredSelector(element),
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

  /** `data-id` is the whole contract: the agent parses the snapshot for `[data-id]` and reads nothing else off it. */
  reindexAndSnapshot(): string {
    this.indexInteractableElements();

    const clone = document.documentElement.cloneNode(true) as Element;

    // Match into the clone by selector — a synced two-tree walk breaks on modals and fixed elements.
    for (const [index, { selector }] of this.index.entries()) {
      try {
        clone.querySelector(selector)?.setAttribute('data-id', index.toString());
      } catch (e) {
        // A host tag name that is not a valid selector token makes querySelector throw; that element just goes unindexed.
        console.warn(`[DomService] Failed to tag index ${index}:`, e);
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

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const topElement = document.elementFromPoint(centerX, centerY);

    if (topElement && topElement !== element && !element.contains(topElement)) {
      const isMarketrixUI = topElement.closest(
        `#marketrix-show-highlight, #marketrix-show-popup, .${WIDGET_SHADOW_HOST_CLASS}`,
      );
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
