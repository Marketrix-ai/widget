export function isInteractable(el: Element | null): boolean {
  if (!el || !(el instanceof Element)) return false;

  try {
    // Cheap type check before the expensive layout/style checks below.
    const tagName = el.tagName.toLowerCase();
    const isButton = tagName === 'button';
    const isInteractiveType =
      isButton ||
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      (tagName === 'a' && el.hasAttribute('href')) ||
      el.getAttribute('role') === 'button' ||
      el.getAttribute('role') === 'link' ||
      el.getAttribute('role') === 'textbox' ||
      el.getAttribute('role') === 'checkbox' ||
      el.getAttribute('role') === 'radio' ||
      el.getAttribute('role') === 'switch' ||
      el.getAttribute('role') === 'tab' ||
      el.getAttribute('role') === 'menuitem' ||
      el.getAttribute('contenteditable') === 'true' ||
      el.hasAttribute('onclick') ||
      (el.hasAttribute('tabindex') && parseInt(el.getAttribute('tabindex') || '-1', 10) >= 0);

    if (!isInteractiveType) {
      return false;
    }

    // Diagnostic logging, buttons only to avoid noise.
    const logButtonFailure = (checkName: string, reason?: string): void => {
      if (isButton) {
        const buttonInfo = {
          tag: el.tagName,
          id: el.id || '(no id)',
          class: el.className || '(no class)',
          check: checkName,
          reason: reason || '',
        };
        console.debug('[isInteractable] Button failed check:', buttonInfo);
      }
    };

    if ((el as HTMLButtonElement).disabled === true) {
      logButtonFailure('disabled', 'button is disabled');
      return false;
    }
    if (el.getAttribute('aria-disabled') === 'true') {
      logButtonFailure('aria-disabled', 'aria-disabled is true');
      return false;
    }

    // Walk ancestors (crossing shadow hosts) for an inert subtree.
    try {
      let p: Element | null | ShadowRoot = el;
      while (p) {
        if (p instanceof HTMLElement && p.inert) {
          logButtonFailure('inert', 'ancestor is inert');
          return false;
        }
        const root: Node | null = p instanceof Element ? p.getRootNode() : null;
        p = p instanceof Element ? p.parentElement || (root instanceof ShadowRoot ? root.host : null) : null;
      }
    } catch (error) {
      // Inert check is best-effort; don't block on it.
      console.warn('[isInteractable] Error checking inert:', error);
    }

    // Buttons with onclick are definitely interactive — skip visibility/occlusion checks.
    const hasOnclick = el.hasAttribute('onclick');
    if (isButton && hasOnclick) {
      return true;
    }

    let style: CSSStyleDeclaration;
    try {
      style = window.getComputedStyle(el);
    } catch (error) {
      logButtonFailure('computed-style', 'failed to get computed style');
      console.warn('[isInteractable] Error getting computed style:', error);
      return false;
    }

    // Only display:none and pointer-events:none disqualify — not opacity/visibility, which user interaction can reveal (expanding sections, modals).
    if (style.display === 'none') {
      logButtonFailure('display', 'display is none');
      return false;
    }
    if (style.pointerEvents === 'none') {
      logButtonFailure('pointer-events', 'pointer-events is none');
      return false;
    }

    let rect: DOMRect;
    try {
      rect = el.getBoundingClientRect();
    } catch (error) {
      logButtonFailure('bounding-rect', 'failed to get bounding rect');
      console.warn('[isInteractable] Error getting bounding rect:', error);
      return false;
    }

    if (rect.width <= 0 || rect.height <= 0) {
      logButtonFailure('dimensions', `width=${rect.width}, height=${rect.height}`);
      return false;
    }

    // No off-screen check: elements outside the viewport can be scrolled to, so still interactable.

    // Overflow clipping by ancestors. Buttons: only fail if completely outside parent bounds.
    try {
      let node: Element | null = el;
      while (node && node !== document.body) {
        const rootNode = node.getRootNode();
        const parent: Element | null =
          node.parentElement || (rootNode instanceof ShadowRoot ? (rootNode as ShadowRoot).host : null);

        if (!parent) break;

        let parentStyle: CSSStyleDeclaration;
        let pr: DOMRect;
        try {
          parentStyle = window.getComputedStyle(parent);
          pr = parent.getBoundingClientRect();
        } catch {
          node = parent;
          continue;
        }

        if (parentStyle.overflow === 'hidden' || parentStyle.overflow === 'clip') {
          const isCompletelyOutside =
            rect.right < pr.left || rect.left > pr.right || rect.bottom < pr.top || rect.top > pr.bottom;

          if (isButton) {
            if (isCompletelyOutside) {
              logButtonFailure('overflow-clipping', 'completely outside parent bounds');
              return false;
            }
          } else {
            if (isCompletelyOutside) {
              return false;
            }
          }
        }

        node = parent;
      }
    } catch (error) {
      // Overflow check is best-effort; don't block on it.
      console.warn('[isInteractable] Error checking overflow:', error);
    }

    // No occlusion check: occluded elements can be scrolled to and interacted with, so still indexed.

    // Shadow DOM host visibility — a zero-size host hides everything inside it.
    try {
      let root: Node | null = el.getRootNode();
      while (root instanceof ShadowRoot) {
        const host: Element = root.host;
        let hostRect: DOMRect;
        try {
          hostRect = host.getBoundingClientRect();
        } catch {
          break;
        }
        if (hostRect.width <= 0 || hostRect.height <= 0) return false;
        root = host.getRootNode();
      }
    } catch (error) {
      // Shadow-DOM check is best-effort; don't block on it.
      console.warn('[isInteractable] Error checking shadow DOM:', error);
    }

    return true;
  } catch (error) {
    console.error('[isInteractable] Unexpected error:', error);
    return false;
  }
}
