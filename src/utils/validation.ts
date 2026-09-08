/**
 * Runtime validation of the widget's untrusted inputs: two DOM type guards, and the one home for
 * settings validation — `parseWidgetSettings`, which checks an arbitrary value against the widget
 * audience's `WidgetSettingsData` and returns either the picked settings or the offending field names.
 *
 * `isHTMLElement` / `isHTMLScriptElement` narrow a possibly-null `Element` off a host-page lookup.
 * `isString`, `isBoolean`, `isOneOf(...allowed)` and `isChipArray` (an array of `{chip_mode, chip_text}`
 * objects) are the per-field predicates; `FIELD_GUARDS` pairs one with every settings field and
 * `FIELD_NAMES` is its key list. `RENDER_CONSTANT_NAMES` / `RENDER_CONSTANT_SET` name the fields the
 * widget renders from its own constants — the set is annotated `ReadonlySet<string>` because `.has()` on
 * the literal tuple's own element type rejects the wider `keyof WidgetSettingsData` the loop passes it.
 * `WidgetRenderedSettings` is the wire shape minus those, and `WidgetSettingsResult` the
 * settings-or-invalidFields union `parseWidgetSettings` returns; `invalidSettingsMessage` folds those
 * field names into the one message the widget logs or throws.
 *
 * Hand-written rather than a zod `safeParse` because importing a schema as a VALUE anywhere reachable
 * from `src/index.tsx` pulls zod's whole runtime into every host page: rolldown cannot prove
 * `z.object(...)` pure, so one value import retains the entire mirror's schema graph.
 * `satisfies Record<keyof WidgetSettingsData, …>` is what keeps the table honest — a field added to the
 * api-side schema fails to compile here until it is guarded, and a field removed there fails as an
 * unknown key. `RENDER_CONSTANT_NAMES` likewise mirrors api's `WIDGET_RENDER_CONSTANTS` by hand, under
 * the same `satisfies` check and for the same bundle reason.
 *
 * `parseWidgetSettings` PICKS as well as validates, and the stripping is load-bearing: `widgetDefaultGet`
 * returns the render constants too and the result is spread into the widget config, so passing unknown
 * keys through would leak them where zod used to drop them. The render constants are still guarded — a
 * legacy bundle's stored value must keep passing — but dropped from the picked result, since nothing
 * renders them.
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
      isOneOf('tell', 'show', 'do')((chip as Record<string, unknown>).chip_mode) &&
      isString((chip as Record<string, unknown>).chip_text),
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

export type WidgetSettingsResult =
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
