/**
 * Runtime validation of the widget's untrusted inputs: two DOM type guards (`isHTMLElement`,
 * `isHTMLScriptElement`) and `parseWidgetSettings`, the one home for validating a host's settings
 * against the widget audience's `WidgetSettingsData`. It returns either the picked settings or the
 * offending field names; `invalidSettingsMessage` turns those into one message.
 *
 * Written by hand rather than with a zod schema, since importing a zod schema as a value anywhere
 * reachable from `src/index.tsx` would pull zod's whole runtime into every host bundle. The per-field
 * guard table is `satisfies`-checked against the real settings type so a contract change fails to
 * compile here until the guard is updated.
 */

import type { WidgetSettingsData } from '../sdk';
import type { WIDGET_RENDER_CONSTANTS } from '../sdk/contracts/entities';

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
      isOneOf('tell', 'show', 'do')((chip as Record<string, unknown>)['chip_mode']) &&
      isString((chip as Record<string, unknown>)['chip_text']),
  );

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

const RENDER_CONSTANT_NAMES = [
  'widget_border_radius',
  'widget_font_size',
  'widget_animation_duration',
  'widget_fade_duration',
] as const satisfies readonly (typeof WIDGET_RENDER_CONSTANTS)[number][];
const RENDER_CONSTANT_SET: ReadonlySet<string> = new Set(RENDER_CONSTANT_NAMES);

export type WidgetRenderedSettings = Omit<WidgetSettingsData, (typeof RENDER_CONSTANT_NAMES)[number]>;

type WidgetSettingsResult =
  { settings: WidgetRenderedSettings; invalidFields?: undefined } | { settings?: undefined; invalidFields: string[] };

export function parseWidgetSettings(value: unknown): WidgetSettingsResult {
  if (typeof value !== 'object' || value === null) return { invalidFields: ['settings'] };

  const record = value as Record<string, unknown>;
  const invalidFields = FIELD_NAMES.filter(name => !FIELD_GUARDS[name](record[name]));
  if (invalidFields.length > 0) return { invalidFields };

  const settings = {} as Record<string, unknown>;
  for (const name of FIELD_NAMES) {
    if (!RENDER_CONSTANT_SET.has(name)) settings[name] = record[name];
  }
  return { settings: settings as WidgetRenderedSettings };
}

export const invalidSettingsMessage = (invalidFields: string[]): string =>
  `Widget settings are invalid: ${invalidFields.join(', ')}`;
