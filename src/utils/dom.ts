/**
 * Predicates the agent's element index runs against the host page's DOM: what counts as a control, and
 * whether it is reachable.
 *
 * `ancestry` walks up through shadow boundaries so a control inside a host-page web component isn't
 * mistaken for top-level. `disabledReason` explains why an element can't be operated. `isIndexable` is
 * the geometry-aware check behind the agent's element index, tolerant of a host page that has patched
 * its own DOM in unexpected ways. `focusablesIn` and `isAriaHidden` find which elements are actually
 * reachable by keyboard, shared by the widget's own focus trap and its Tab-key simulation of the host
 * page so the two can't disagree about tab order.
 */

export const WIDGET_SHADOW_HOST_CLASS = 'marketrix-widget-container';

const TABBABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const INTERACTIVE_ROLES = new Set(['button', 'link', 'textbox', 'checkbox', 'radio', 'switch', 'tab', 'menuitem']);

function isAriaHidden(el: Element): boolean {
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (node.getAttribute('aria-hidden') === 'true') return true;
  }
  return false;
}

export function focusablesIn(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)).filter(
    el => el.offsetParent !== null && !isAriaHidden(el),
  );
}

function* ancestry(el: Element): Generator<Element> {
  let node: Element | null = el;
  while (node) {
    yield node;
    const root = node.getRootNode();
    node = node.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
  }
}

export function disabledReason(el: Element): string | null {
  if ('disabled' in el && el.disabled === true) return 'is a disabled control';
  if (el.getAttribute('aria-disabled') === 'true') return 'is aria-disabled';
  for (const node of ancestry(el)) {
    if (node.hasAttribute('inert')) return 'is inside an inert subtree';
  }
  return null;
}

export function isIndexable(el: Element | null): boolean {
  if (!(el instanceof Element)) return false;

  try {
    const tag = el.tagName.toLowerCase();
    const interactive =
      tag === 'button' ||
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select' ||
      (tag === 'a' && el.hasAttribute('href')) ||
      INTERACTIVE_ROLES.has(el.getAttribute('role') ?? '') ||
      el.getAttribute('contenteditable') === 'true' ||
      el.hasAttribute('onclick') ||
      parseInt(el.getAttribute('tabindex') ?? '-1', 10) >= 0;
    if (!interactive) return false;

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.pointerEvents === 'none') return false;

    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    for (const parent of ancestry(el)) {
      if (parent !== el) {
        const clip = window.getComputedStyle(parent).overflow;
        if (clip === 'hidden' || clip === 'clip') {
          const pr = parent.getBoundingClientRect();
          if (rect.right < pr.left || rect.left > pr.right || rect.bottom < pr.top || rect.top > pr.bottom)
            return false;
        }
        if (parent === document.body) break;
      }
    }

    for (let root = el.getRootNode(); root instanceof ShadowRoot; root = root.host.getRootNode()) {
      const hostRect = root.host.getBoundingClientRect();
      if (hostRect.width <= 0 || hostRect.height <= 0) return false;
    }

    return true;
  } catch (error) {
    console.error('[isIndexable] Unexpected error:', error);
    return false;
  }
}
