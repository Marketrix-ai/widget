/**
 * Vitest suite for `utils/validation.ts` — `parseWidgetSettings` and `invalidSettingsMessage`.
 *
 * `parseWidgetSettings` replaced `WidgetSettingsDataSchema.safeParse` to keep zod's 91 kB runtime out
 * of every host page. zod is still a dependency of the generated mirror, so it is importable HERE,
 * making the schema the oracle these tests assert agreement against. `valid` is the mock config run
 * through the schema, `FIELDS` its key list driving the per-field cases.
 *
 * A valid object is accepted by both. Unknown keys are stripped exactly as zod did — load-bearing,
 * since `widgetDefaultGet` returns render constants too and the result spreads into the widget config,
 * so a passed-through key would leak; the expectation is the schema's parse minus those constants. The
 * four render constants (`widget_border_radius`, `widget_font_size`, `widget_animation_duration`,
 * `widget_fade_duration`) are separately asserted absent — still guarded so a legacy stored value keeps
 * passing but is never picked, since the widget renders them from its own hard-coded values. Per field,
 * a wrong-typed and a missing value are both rejected and named, since `12345` is wrong for every field
 * — booleans, strings, enums, the chip array. Off-enum values (`widget_appearance: 'compact'`, retired
 * in db-V246, and `widget_position: 'middle'`) and a malformed chip name their own field; a non-object
 * input only asserts rejected, since an array returns the whole table rather than one name — the last
 * case pins every invalid field reported, in guard-table order.
 */
import { describe, expect, it } from 'vitest';

import { WidgetSettingsDataSchema } from '../../sdk';
import { getMockWidgetConfig } from '../../test/fixtures';
import { invalidSettingsMessage, parseWidgetSettings } from '../validation';

const valid = WidgetSettingsDataSchema.parse(getMockWidgetConfig());
const FIELDS = Object.keys(valid) as (keyof typeof valid)[];

describe('parseWidgetSettings agrees with the zod schema it replaced', () => {
  it('accepts a valid settings object', () => {
    const result = parseWidgetSettings(valid);
    expect(result.invalidFields).toBeUndefined();
    expect(WidgetSettingsDataSchema.safeParse(valid).success).toBe(true);
  });

  it('strips unknown keys exactly as zod did — widgetDefaultGet returns render constants too', () => {
    const withExtras = { ...valid, widget_render_constant: 'x', another: 1 };
    const result = parseWidgetSettings(withExtras);
    const {
      widget_border_radius: _radius,
      widget_font_size: _fontSize,
      widget_animation_duration: _animation,
      widget_fade_duration: _fade,
      ...rendered
    } = WidgetSettingsDataSchema.parse(withExtras);
    expect(result.settings).toEqual(rendered);
    expect(result.settings).not.toHaveProperty('widget_render_constant');
  });

  it('also drops the render constants the widget renders from its own hard-coded values', () => {
    const result = parseWidgetSettings(valid);
    for (const field of [
      'widget_border_radius',
      'widget_font_size',
      'widget_animation_duration',
      'widget_fade_duration',
    ]) {
      expect(result.settings).not.toHaveProperty(field);
    }
  });

  it.each(FIELDS)('rejects a wrong-typed %s, and names it', field => {
    const broken = { ...valid, [field]: 12345 };

    expect(WidgetSettingsDataSchema.safeParse(broken).success).toBe(false);
    expect(parseWidgetSettings(broken).invalidFields).toEqual([field]);
  });

  it.each(FIELDS)('rejects a missing %s', field => {
    const broken = { ...valid };
    delete broken[field];

    expect(WidgetSettingsDataSchema.safeParse(broken).success).toBe(false);
    expect(parseWidgetSettings(broken).invalidFields).toEqual([field]);
  });

  it.each([
    ['widget_appearance', 'compact'],
    ['widget_position', 'middle'],
  ] as const)('rejects %s outside its enum', (field, value) => {
    const broken = { ...valid, [field]: value };
    expect(WidgetSettingsDataSchema.safeParse(broken).success).toBe(false);
    expect(parseWidgetSettings(broken).invalidFields).toEqual([field]);
  });

  it('rejects a malformed chip', () => {
    const broken = { ...valid, widget_chips: [{ chip_mode: 'nope', chip_text: 'hi' }] };
    expect(WidgetSettingsDataSchema.safeParse(broken).success).toBe(false);
    expect(parseWidgetSettings(broken).invalidFields).toEqual(['widget_chips']);
  });

  it.each([null, undefined, 'settings', 42, []])('rejects a non-object input (%s)', input => {
    expect(parseWidgetSettings(input).invalidFields).toBeDefined();
  });

  it('reports every invalid field, not just the first', () => {
    const broken = { ...valid, widget_header: 1, widget_enabled: 'yes' };
    expect(parseWidgetSettings(broken).invalidFields).toEqual(['widget_enabled', 'widget_header']);
  });
});

describe('invalidSettingsMessage', () => {
  it('lists the offending fields', () => {
    expect(invalidSettingsMessage(['widget_header', 'widget_enabled'])).toBe(
      'Widget settings are invalid: widget_header, widget_enabled',
    );
  });
});
