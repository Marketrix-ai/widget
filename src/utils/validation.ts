/**
 * Type Guard Utilities
 *
 * Generic type guard functions for data validation and type checking.
 * These are shared utilities used across the codebase.
 */

import type { WidgetSettingsData } from '../sdk';

/**
 * Check if an object has a specific property
 */
function hasProperty<K extends string>(obj: unknown, key: K): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj;
}

/**
 * Check if a value is a non-null object
 */
function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Type guard for WidgetSettingsData
 */
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

/**
 * Type guard for HTMLElement
 */
export function isHTMLElement(element: Element | null): element is HTMLElement {
  return element !== null && element instanceof HTMLElement;
}

/**
 * Type guard for HTMLScriptElement
 */
export function isHTMLScriptElement(element: Element | null): element is HTMLScriptElement {
  return element !== null && element instanceof HTMLScriptElement;
}
