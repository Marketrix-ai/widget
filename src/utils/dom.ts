/**
 * Predicates the agent's element index runs against the HOST page's DOM — what counts as a control and
 * whether it is reachable. `TABBABLE_SELECTOR` is the one tab-order candidate query: `send_keys`'s Tab
 * simulation walks the host page with it and `useFocusTrap` the widget's own tree, and they must agree
 * on what the browser would focus next. `WIDGET_SHADOW_HOST_CLASS`, set by `bootstrap` on the shadow
 * host, lets `DomService` recognise its own overlay chrome instead of reporting it as obscuring the host
 * page.
 *
 * `ancestry` walks element → `parentElement`, crossing each shadow boundary at its host, since a bare
 * `parentElement` walk stops dead at a `ShadowRoot` and a control inside a host-page web component would
 * read as top-level. `disabledReason` names why an element cannot be operated (disabled control,
 * `aria-disabled`, or an `inert` ancestor) as a sentence fragment completing `DomService`'s `Element
 * <n> …` message — reword both together. `isIndexable` is `DomService`'s geometry-aware fallback after
 * its cheap selector/handler checks; visibility there climbs both the `overflow: hidden|clip` chain
 * (that walk stops at `document.body`) and the shadow-host size, since either can hide an element
 * despite a non-zero rect. Its one `try` is deliberate — the host page owns this DOM and may have
 * patched anything on it, so a poisoned element is logged with the real error and skipped rather than
 * aborting the whole indexing pass.
 *
 * `focusablesIn` is the one home for "which `TABBABLE_SELECTOR` matches are actually reachable" —
 * `useFocusTrap` and `keySimulation`'s Tab simulation both call it so they can't re-diverge.
 * `isAriaHidden` walks ancestors, not just the element itself, since a hidden container hides everything
 * under it (per WAI-ARIA, `aria-hidden="true"` removes an element and its whole subtree from the
 * accessibility tree) even though none of those descendants carry the attribute.
 */

export const WIDGET_SHADOW_HOST_CLASS = 'marketrix-widget-container';

export const TABBABLE_SELECTOR =
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
  if ((el as HTMLButtonElement).disabled === true) return 'is a disabled control';
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
