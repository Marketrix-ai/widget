/**
 * Predicates the agent's element index runs against the HOST page's DOM — what counts as a control and
 * whether it is reachable — plus `WIDGET_SHADOW_HOST_CLASS`, set by `bootstrap` on the shadow host so
 * `DomService` can recognise its own overlay chrome instead of reporting it as obscuring the host page, and
 * `TABBABLE_SELECTOR`, the one tab-order candidate query: `send_keys`' Tab simulation walks the host page
 * with it and `useFocusTrap` the widget's own tree, and they must agree on what the browser would focus next.
 *
 * `ancestry` walks element → `parentElement`, crossing each shadow boundary at its host; a bare
 * `parentElement` walk stops dead at a `ShadowRoot`, so a control inside a host-page web component
 * would read as top-level. `disabledReason` names why an element cannot be operated (disabled control,
 * `aria-disabled`, or an `inert` ancestor) as a sentence fragment completing `DomService`'s
 * `Element <n> …` message — reword both together; `disabled` is read duck-typed since it sits on
 * several unrelated control interfaces. `isIndexable`, checked against `INTERACTIVE_ROLES`, is
 * `DomService`'s geometry-aware fallback after its cheap selector/handler checks. Visibility there is more
 * than computed style: an element scrolled out of an `overflow: hidden|clip` ancestor is unreachable despite
 * a non-zero rect (that walk stops at `document.body`), and a zero-size shadow host hides its whole tree, so
 * both chains are climbed. Its one `try` is deliberate — the host page owns this DOM and may have patched
 * anything on it, so a poisoned element is logged with the real error and skipped rather than aborting the
 * whole indexing pass.
 */

export const WIDGET_SHADOW_HOST_CLASS = 'marketrix-widget-container';

export const TABBABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const INTERACTIVE_ROLES = new Set(['button', 'link', 'textbox', 'checkbox', 'radio', 'switch', 'tab', 'menuitem']);

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
