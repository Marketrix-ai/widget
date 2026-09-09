/**
 * The numbered address space the agent drives the host page by: `reindexAndSnapshot` walks the live document and
 * returns a clone stamped with `data-id="<n>"` on every interactive element; `getSequenceForElement` is the reverse
 * lookup; `getValidatedElement` resolves an index back to a live element or a `ValidatedElementResult` error;
 * `notInteractableReason` phrases why an element cannot be acted on; `generateAnchoredSelector` and `indexElements`
 * build the walk and its body-anchored selectors. `domService` is the process-wide singleton.
 *
 * `data-id` is the whole contract with the agent, so the clone is tagged by re-querying each stored selector rather
 * than walking the two trees in step — a synced walk breaks on modals and fixed elements. Indices are addresses the
 * agent holds across turns: each entry snapshots IDENTITY_ATTRIBUTES so a changed element reads as DOM_CHANGED
 * rather than silently acting on a control the agent no longer means.
 *
 * The tree walker keeps an element with a null `offsetParent` when it or an ancestor is fixed/sticky, since the
 * browser reports no offsetParent for those even when visible. The obscured test ignores Marketrix's own chrome
 * (Show-mode highlight/popup, the widget's shadow host) since those legitimately sit over the element they point
 * at. `notInteractableReason`'s `document.body.contains` check must stay first: ShowModeService uses it as its
 * removal watchdog and keeps no identity snapshot of its own.
 */

import { disabledReason, isIndexable, WIDGET_SHADOW_HOST_CLASS } from '../utils/dom';

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

  private indexElements(): void {
    this.index.clear();
    this.elementToSequence = new WeakMap();

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

        if (semantic || visuallyClickable || hasClickHandler || isIndexable(element)) {
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

  reindexAndSnapshot(): string {
    this.indexElements();

    const clone = document.documentElement.cloneNode(true) as Element;

    for (const [index, { selector }] of this.index.entries()) {
      try {
        clone.querySelector(selector)?.setAttribute('data-id', index.toString());
      } catch (e) {
        console.warn(`[DomService] Failed to tag index ${index}:`, e);
      }
    }

    return clone.outerHTML;
  }

  getSequenceForElement(element: Element): number | undefined {
    return this.elementToSequence.get(element);
  }

  notInteractableReason(element: HTMLElement, index: number): string | null {
    if (!document.body.contains(element)) {
      return `ELEMENT_NOT_INTERACTABLE: Element ${index} is not in the DOM`;
    }

    const disabled = disabledReason(element);
    if (disabled) {
      return `ELEMENT_NOT_INTERACTABLE: Element ${index} ${disabled}`;
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

    const gone = !document.contains(entry.element);
    const changed = IDENTITY_ATTRIBUTES.some(
      (attribute, i) => entry.element.getAttribute(attribute) !== entry.identity[i],
    );
    if (gone || changed) {
      const stale = gone ? 'no longer exists' : 'has changed';
      return {
        element: null,
        error: `DOM_CHANGED: Element at index ${index} ${stale}. Call get_html to get updated indices.`,
      };
    }

    const reason = this.notInteractableReason(entry.element, index);
    if (reason) {
      return { element: null, error: reason };
    }

    return { element: entry.element };
  }
}

export const domService = new DomService();
