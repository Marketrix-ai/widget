export function isHTMLElement(element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement;
}

export function isHTMLScriptElement(element: Element | null): element is HTMLScriptElement {
  return element instanceof HTMLScriptElement;
}
