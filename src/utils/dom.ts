/**
 * Predicates the agent's element index runs against the host page's DOM: what counts as a control, and
 * whether it is reachable.
 *
 * `disabledReason` explains why an element can't be operated. `isIndexable` is the one geometry-aware
 * predicate deciding what enters the agent's element index. `focusablesIn` finds which elements are
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

export function disabledReason(el: Element): string | null {
  if ('disabled' in el && el.disabled === true) return 'is a disabled control';
  if (el.getAttribute('aria-disabled') === 'true') return 'is aria-disabled';
  return el.closest('[inert]') ? 'is inside an inert subtree' : null;
}

export function isIndexable(el: Element): boolean {
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

  for (let parent = el.parentElement; parent && parent !== document.documentElement; parent = parent.parentElement) {
    const clip = window.getComputedStyle(parent).overflow;
    if (clip === 'hidden' || clip === 'clip') {
      const pr = parent.getBoundingClientRect();
      if (rect.right < pr.left || rect.left > pr.right || rect.bottom < pr.top || rect.top > pr.bottom) return false;
    }
  }

  return true;
}
