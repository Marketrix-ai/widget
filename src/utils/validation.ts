import type { WidgetSettingsData } from '../sdk';

function hasProperty<K extends string>(obj: unknown, key: K): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj;
}

function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isWidgetSettingsData(data: unknown): data is WidgetSettingsData {
  if (!isNonNullObject(data)) {
    return false;
  }

  return (
    hasProperty(data, 'widget_enabled') &&
    typeof data.widget_enabled === 'boolean' &&
    hasProperty(data, 'widget_appearance') &&
    typeof data.widget_appearance === 'string' &&
    hasProperty(data, 'widget_position') &&
    typeof data.widget_position === 'string'
  );
}

export function isHTMLElement(element: Element | null): element is HTMLElement {
  return element !== null && element instanceof HTMLElement;
}

export function isHTMLScriptElement(element: Element | null): element is HTMLScriptElement {
  return element !== null && element instanceof HTMLScriptElement;
}
