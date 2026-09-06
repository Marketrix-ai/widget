import type { ZodError } from 'zod';

export function isHTMLElement(element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement;
}

export function isHTMLScriptElement(element: Element | null): element is HTMLScriptElement {
  return element instanceof HTMLScriptElement;
}

export const invalidSettingsMessage = (error: ZodError): string => {
  const fields = [...new Set(error.issues.map(issue => issue.path.join('.') || 'settings'))];
  return `Widget settings are invalid: ${fields.join(', ')}`;
};
