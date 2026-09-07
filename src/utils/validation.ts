import type { WidgetSettingsData } from '../sdk';

export function isHTMLElement(element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement;
}

export function isHTMLScriptElement(element: Element | null): element is HTMLScriptElement {
  return element instanceof HTMLScriptElement;
}

const isString = (value: unknown): boolean => typeof value === 'string';
const isBoolean = (value: unknown): boolean => typeof value === 'boolean';
const isOneOf =
  (...allowed: string[]) =>
  (value: unknown): boolean =>
    typeof value === 'string' && allowed.includes(value);

const isChipArray = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.every(
    chip =>
      typeof chip === 'object' &&
      chip !== null &&
      isOneOf('tell', 'show', 'do')((chip as Record<string, unknown>).chip_mode) &&
      isString((chip as Record<string, unknown>).chip_text),
  );

/**
 * One guard per field of the generated contract. `satisfies` over `keyof WidgetSettingsData` is what
 * keeps this honest: a field added to the api-side schema fails to compile here until it is guarded,
 * and a field removed there fails as an unknown key. Hand-written because the alternative is shipping
 * zod's whole runtime to every host page for this one check.
 */
const FIELD_GUARDS = {
  widget_enabled: isBoolean,
  widget_appearance: isOneOf('default', 'hidden'),
  widget_position: isOneOf('bottom_left', 'bottom_right', 'top_left', 'top_right'),
  widget_header: isString,
  widget_body: isString,
  widget_greeting: isString,
  widget_greeting_toast: isBoolean,
  widget_recording: isBoolean,
  widget_feature_tell: isBoolean,
  widget_feature_show: isBoolean,
  widget_feature_do: isBoolean,
  widget_background_color: isString,
  widget_text_color: isString,
  widget_border_color: isString,
  widget_accent_color: isString,
  widget_secondary_color: isString,
  widget_border_radius: isString,
  widget_font_size: isString,
  widget_width: isString,
  widget_height: isString,
  widget_animation_duration: isString,
  widget_fade_duration: isString,
  widget_chips: isChipArray,
} satisfies Record<keyof WidgetSettingsData, (value: unknown) => boolean>;

const FIELD_NAMES = Object.keys(FIELD_GUARDS) as (keyof WidgetSettingsData)[];

export type WidgetSettingsResult =
  { settings: WidgetSettingsData; invalidFields?: undefined } | { settings?: undefined; invalidFields: string[] };

/**
 * Validates and PICKS, because stripping is load-bearing: `widgetDefaultGet` returns the render
 * constants too, and the settings object is spread into the widget config — passing unknown keys
 * through would leak them where zod used to drop them.
 */
export function parseWidgetSettings(value: unknown): WidgetSettingsResult {
  if (typeof value !== 'object' || value === null) return { invalidFields: ['settings'] };

  const record = value as Record<string, unknown>;
  const invalidFields = FIELD_NAMES.filter(name => !FIELD_GUARDS[name](record[name]));
  if (invalidFields.length > 0) return { invalidFields };

  const settings = {} as Record<string, unknown>;
  for (const name of FIELD_NAMES) settings[name] = record[name];
  return { settings: settings as WidgetSettingsData };
}

export const invalidSettingsMessage = (invalidFields: string[]): string =>
  `Widget settings are invalid: ${invalidFields.join(', ')}`;
