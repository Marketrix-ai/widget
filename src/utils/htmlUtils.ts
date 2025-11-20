export function isInteractable(el: Element | null): boolean {
  if (!el || !(el instanceof Element)) return false;

  // ---- 1. Disabled or inert state ----
  // Covers <button disabled>, <input disabled>, aria-disabled, and inert subtree.
  if ((el as HTMLButtonElement).disabled === true) return false;
  if (el.getAttribute('aria-disabled') === 'true') return false;

  // Check inert on ancestors, including shadow hosts
  {
    let p: Element | null | ShadowRoot = el;
    while (p) {
      if (p instanceof HTMLElement && p.inert) return false;
      const root: Node | null = p instanceof Element ? p.getRootNode() : null;
      p =
        p instanceof Element
          ? p.parentElement || (root instanceof ShadowRoot ? root.host : null)
          : null;
    }
  }

  const style = window.getComputedStyle(el);

  // ---- 2. Visibility and pointer checks ----
  if (style.display === 'none') return false;
  if (style.visibility !== 'visible') return false;
  if (style.opacity === '0') return false;
  if (style.pointerEvents === 'none') return false;

  // ---- 3. Layout presence ----
  const rect = el.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) return false;

  // off-screen due to transforms or position
  if (
    rect.bottom < 0 ||
    rect.top > window.innerHeight ||
    rect.right < 0 ||
    rect.left > window.innerWidth
  ) {
    return false;
  }

  // ---- 4. Overflow clipping by ancestors ----
  {
    let node: Element | null = el;
    while (node && node !== document.body) {
      const rootNode = node.getRootNode();
      const parent: Element | null =
        node.parentElement ||
        (rootNode instanceof ShadowRoot ? (rootNode as ShadowRoot).host : null);

      if (!parent) break;

      const parentStyle = window.getComputedStyle(parent);
      const pr: DOMRect = parent.getBoundingClientRect();

      if (
        (parentStyle.overflow === 'hidden' || parentStyle.overflow === 'clip') &&
        (rect.right < pr.left ||
          rect.left > pr.right ||
          rect.bottom < pr.top ||
          rect.top > pr.bottom)
      ) {
        return false; // clipped out
      }

      node = parent;
    }
  }

  // ---- 5. Occlusion (covered element) ----
  // Probe center + 4 edges.
  const probePoints: Array<[number, number]> = [
    [rect.left + rect.width / 2, rect.top + rect.height / 2], // center
    [rect.left + 1, rect.top + rect.height / 2], // left edge
    [rect.right - 1, rect.top + rect.height / 2], // right edge
    [rect.left + rect.width / 2, rect.top + 1], // top edge
    [rect.left + rect.width / 2, rect.bottom - 1], // bottom edge
  ];

  const isCovered = probePoints.every(([x, y]) => {
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return true;
    const top = document.elementFromPoint(x, y);
    if (!top) return true; // off-screen or overlay root
    if (top !== el && !el.contains(top)) return true;
    return false;
  });

  if (isCovered) return false;

  // ---- 6. Shadow DOM host visibility ----
  {
    let root: Node | null = el.getRootNode();
    while (root instanceof ShadowRoot) {
      const host: Element = root.host;
      const hostRect: DOMRect = host.getBoundingClientRect();
      if (hostRect.width <= 0 || hostRect.height <= 0) return false;
      root = host.getRootNode();
    }
  }

  return true;
}
