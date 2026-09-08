/**
 * The numbered address space the agent drives the host page by: an index of its interactive elements, the document
 * snapshot that publishes those numbers, and the resolution of a number back to a live, actionable element.
 *
 * Contents. `reindexAndSnapshot` rewalks the live document and returns a clone of it with `data-id="<n>"` stamped on
 * every indexed element. `getSequenceForElement` is the reverse lookup, element → index. `notInteractableReason`
 * phrases why an element cannot be acted on right now, or null. `getValidatedElement` resolves an index to a live
 * element or to the `ValidatedElementResult` error saying why it cannot — unknown index, stale entry, or not
 * interactable. `generateAnchoredSelector` builds the body-anchored `>` path each entry is relocated by inside the
 * snapshot clone, short-circuiting the moment it reaches a document-unique `#id`. `indexElements` is the walk itself.
 * `domService` is the process-wide singleton; the class is exported for tests.
 *
 * `data-id` is the whole contract with the agent: it parses the snapshot for `[data-id]` and reads nothing else off
 * it. The clone is tagged by re-querying each stored selector rather than walking the two trees in step — a synced
 * two-tree walk breaks on modals and fixed elements. A host tag name that is not a valid selector token makes
 * `querySelector` throw; that one element goes untagged and the rest of the snapshot still ships.
 *
 * Indices are addresses the agent holds across turns, so an index must not survive the element changing underneath
 * it: the node object stays the same across a re-render while its attributes are rewritten. Each entry therefore
 * snapshots IDENTITY_ATTRIBUTES, and a mismatch reads as DOM_CHANGED rather than silently acting on a control that
 * is no longer the one the agent chose.
 *
 * The tree walker rejects a `display:none` subtree outright, but keeps an element with a null `offsetParent` when it
 * or an ancestor is `position: fixed|sticky` — the browser reports no offsetParent for those even when they are
 * plainly visible, so the cheap offsetParent test alone would drop every sticky header and modal. Membership is the
 * union of a semantic match, the `cursor-pointer`/`clickable` affordance classes, an `onclick` property and
 * `isIndexable` (the strict geometry/clipping test), because host pages express clickability all four ways.
 *
 * The error strings are read by the agent loop, not by a human: the `DOM_CHANGED` / `ELEMENT_NOT_INTERACTABLE` /
 * `ELEMENT_OBSCURED` prefixes and the "call get_html" instruction are what steer its next move. The obscured test
 * ignores Marketrix's own chrome — the Show-mode highlight and popup and the widget's shadow host sit over the very
 * element they point at. `notInteractableReason`'s first test must stay the `document.body.contains` check:
 * ShowModeService leans on it as its removal watchdog and carries no identity snapshot of its own to detect that.
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
