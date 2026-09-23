/**
 * Tests for `parseWidgetSettings`/`invalidSettingsMessage`: valid settings pass, unknown keys and render
 * constants are dropped, and each invalid rendered field is rejected and named.
 */
import { describe, expect, it } from 'bun:test';

import { WidgetSettingsDataSchema } from '../../sdk';
import { WIDGET_RENDER_CONSTANTS } from '../../sdk/contracts/widget';
import { validSettings } from '../../test/fixtures';
import { invalidSettingsMessage, parseWidgetSettings } from '../WidgetService';

const valid = validSettings();
const RENDER_CONSTANTS: readonly string[] = WIDGET_RENDER_CONSTANTS;
const FIELDS = (Object.keys(valid) as (keyof typeof valid)[]).filter(field => !RENDER_CONSTANTS.includes(field));

const expectRejectedAndNamed = (broken: unknown, invalidFields: string[]) => {
  expect(WidgetSettingsDataSchema.safeParse(broken).success).toBe(false);
  expect(parseWidgetSettings(broken).invalidFields).toEqual(invalidFields);
};

describe('parseWidgetSettings', () => {
  it('accepts a valid settings object', () => {
    const result = parseWidgetSettings(valid);
    expect(result.invalidFields).toBeUndefined();
    expect(WidgetSettingsDataSchema.safeParse(valid).success).toBe(true);
  });

  it('projects settings from a wider internal config while the wire schema rejects unknown keys', () => {
    const withExtras = { ...valid, widget_render_constant: 'x', another: 1 };
    const result = parseWidgetSettings(withExtras);
    const {
      widget_border_radius: _radius,
      widget_font_size: _fontSize,
      widget_animation_duration: _animation,
      widget_fade_duration: _fade,
      ...rendered
    } = valid;
    expect(WidgetSettingsDataSchema.safeParse(withExtras).success).toBe(false);
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
    expectRejectedAndNamed({ ...valid, [field]: 12345 }, [field]);
  });

  it.each(FIELDS)('rejects a missing %s', field => {
    const broken = { ...valid };
    delete broken[field];
    expectRejectedAndNamed(broken, [field]);
  });

  it.each([
    ['widget_appearance', 'compact'],
    ['widget_position', 'middle'],
  ] as const)('rejects %s outside its enum', (field, value) => {
    expectRejectedAndNamed({ ...valid, [field]: value }, [field]);
  });

  it('rejects a malformed chip', () => {
    expectRejectedAndNamed({ ...valid, widget_chips: [{ chip_mode: 'nope', chip_text: 'hi' }] }, ['widget_chips']);
  });

  it.each([[null], [undefined], ['settings'], [42]])(
    'rejects a non-object input (%s), naming only "settings"',
    input => {
      expectRejectedAndNamed(input, ['settings']);
    },
  );

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
