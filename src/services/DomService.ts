/**
 * The numbered address space the agent drives the host page by. `reindexAndSnapshot` stamps `data-id` on
 * every indexable element of a document clone in one pass, pairing each live element with its clone by
 * document order; `getValidatedElement` resolves an index back to a live element or throws why it can't, `notInteractableReason`
 * explains why an element can't be acted on, and `domService` groups them for the tools. An element that changed
 * between turns is reported as changed rather than silently acted on.
 */

import { disabledReason, isIndexable, WIDGET_SHADOW_HOST_CLASS } from '../utils/dom';

const IDENTITY_ATTRIBUTES = ['id', 'type', 'role', 'aria-label', 'name', 'href'] as const;

interface IndexedElement {
  element: HTMLElement;
  identity: Array<string | null>;
}

const index = new Map<number, IndexedElement>();

function reindexAndSnapshot(): string {
  index.clear();
  const clone = document.documentElement.cloneNode(true);
  if (!(clone instanceof HTMLElement)) throw new Error('document.documentElement cloned to a non-element');
  const clonedElements = clone.querySelector(':scope > body')?.querySelectorAll('*');

  let sequenceNumber = 0;
  document.body.querySelectorAll<HTMLElement>('*').forEach((element, position) => {
    if (!isIndexable(element)) return;
    clonedElements?.[position]?.setAttribute('data-id', sequenceNumber.toString());
    index.set(sequenceNumber++, {
      element,
      identity: IDENTITY_ATTRIBUTES.map(attribute => element.getAttribute(attribute)),
    });
  });

  return clone.outerHTML;
}

function notInteractableReason(element: HTMLElement, elementIndex: number): string | null {
  const why = (reason: string) => `ELEMENT_NOT_INTERACTABLE: Element ${elementIndex} ${reason}`;
  if (!document.body.contains(element)) return why('is not in the DOM');

  const disabled = disabledReason(element);
  if (disabled) return why(disabled);

  const style = window.getComputedStyle(element);
  if (style.display === 'none') return why('has display:none');
  if (style.visibility === 'hidden') return why('has visibility:hidden');
  if (parseFloat(style.opacity) === 0) return why('has opacity:0');

  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return why('has zero dimensions');

  const topElement = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  if (
    topElement &&
    topElement !== element &&
    !element.contains(topElement) &&
    !topElement.closest(`#marketrix-show-highlight, #marketrix-show-popup, .${WIDGET_SHADOW_HOST_CLASS}`)
  ) {
    const tagName = topElement.tagName.toLowerCase();
    const firstClass = topElement.classList[0];
    const obscurerInfo = firstClass ? `${tagName}.${firstClass}` : tagName;
    return (
      `ELEMENT_OBSCURED: Element ${elementIndex} is covered by ${obscurerInfo}. ` +
      `The obscuring element may be a modal or overlay that needs to be dismissed first.`
    );
  }

  return null;
}

function getValidatedElement(elementIndex: number): HTMLElement {
  const entry = index.get(elementIndex);
  if (!entry) throw new Error(`Element ${elementIndex} not found`);

  const gone = !document.contains(entry.element);
  const changed = IDENTITY_ATTRIBUTES.some(
    (attribute, i) => entry.element.getAttribute(attribute) !== entry.identity[i],
  );
  if (gone || changed) {
    const stale = gone ? 'no longer exists' : 'has changed';
    throw new Error(`DOM_CHANGED: Element at index ${elementIndex} ${stale}. Call get_html to get updated indices.`);
  }

  const reason = notInteractableReason(entry.element, elementIndex);
  if (reason) throw new Error(reason);
  return entry.element;
}

export const domService = { reindexAndSnapshot, notInteractableReason, getValidatedElement };
