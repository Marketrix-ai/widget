/**
 * The numbered address space the agent drives the host page by. `reindexAndSnapshot` stamps `data-id` on
 * every indexable element of a document clone in one pass, pairing each live element with its clone by
 * document order; `getValidatedElement` resolves an index back to a live element, `notInteractableReason`
 * explains why an element can't be acted on, and `domService` is the singleton. An element that changed
 * between turns is reported as changed rather than silently acted on.
 */

import { disabledReason, isIndexable, WIDGET_SHADOW_HOST_CLASS } from '../utils/dom';

const IDENTITY_ATTRIBUTES = ['id', 'type', 'role', 'aria-label', 'name', 'href'] as const;

interface IndexedElement {
  element: HTMLElement;
  identity: Array<string | null>;
}

type ValidatedElementResult = { element: HTMLElement; error?: undefined } | { element: null; error: string };

class DomService {
  private index: Map<number, IndexedElement> = new Map();

  reindexAndSnapshot(): string {
    this.index.clear();
    const clone = document.documentElement.cloneNode(true) as HTMLElement;
    const clonedElements = clone.querySelector(':scope > body')?.querySelectorAll('*');

    let sequenceNumber = 0;
    document.body.querySelectorAll<HTMLElement>('*').forEach((element, position) => {
      if (!isIndexable(element)) return;
      clonedElements?.[position]?.setAttribute('data-id', sequenceNumber.toString());
      this.index.set(sequenceNumber++, {
        element,
        identity: IDENTITY_ATTRIBUTES.map(attribute => element.getAttribute(attribute)),
      });
    });

    return clone.outerHTML;
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
        const firstClass = topElement.classList[0];
        const obscurerInfo = firstClass ? `${tagName}.${firstClass}` : tagName;
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
