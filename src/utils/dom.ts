const INTERACTIVE_ROLES = new Set(['button', 'link', 'textbox', 'checkbox', 'radio', 'switch', 'tab', 'menuitem']);

function isInteractiveKind(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  return (
    tag === 'button' ||
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    (tag === 'a' && el.hasAttribute('href')) ||
    INTERACTIVE_ROLES.has(el.getAttribute('role') ?? '') ||
    el.getAttribute('contenteditable') === 'true' ||
    el.hasAttribute('onclick') ||
    parseInt(el.getAttribute('tabindex') ?? '-1', 10) >= 0
  );
}

/** Walks element → parentElement, crossing each shadow boundary at its host. */
function* ancestry(el: Element): Generator<Element> {
  let node: Element | null = el;
  while (node) {
    yield node;
    const root = node.getRootNode();
    node = node.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
  }
}

export function isInteractable(el: Element | null): boolean {
  if (!(el instanceof Element)) return false;

  // One net, because the host page owns this DOM and may have patched anything on it; an indexing pass must not throw.
  try {
    if (!isInteractiveKind(el)) return false;
    if ((el as HTMLButtonElement).disabled === true) return false;
    if (el.getAttribute('aria-disabled') === 'true') return false;

    for (const node of ancestry(el)) {
      if (node instanceof HTMLElement && node.inert) return false;
    }

    const style = window.getComputedStyle(el);
    // Only display:none and pointer-events:none disqualify — not opacity/visibility, which user interaction can reveal (expanding sections, modals).
    if (style.display === 'none' || style.pointerEvents === 'none') return false;

    const rect = el.getBoundingClientRect();
    // No off-screen and no occlusion check: both can be scrolled to or dismissed, so the element stays indexable.
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

    // A zero-size shadow host hides everything inside it.
    for (let root = el.getRootNode(); root instanceof ShadowRoot; root = root.host.getRootNode()) {
      const hostRect = root.host.getBoundingClientRect();
      if (hostRect.width <= 0 || hostRect.height <= 0) return false;
    }

    return true;
  } catch (error) {
    console.error('[isInteractable] Unexpected error:', error);
    return false;
  }
}
