export function isHTMLElement(element: Element | null): element is HTMLElement {
  return element !== null && element instanceof HTMLElement;
}

export function isHTMLScriptElement(element: Element | null): element is HTMLScriptElement {
  return element !== null && element instanceof HTMLScriptElement;
}
