/**
 * Tests for `parseWidgetSettings`/`invalidSettingsMessage`: valid settings pass, unknown keys and render
 * constants are dropped, and each invalid rendered field is rejected and named.
 */
import { describe, expect, it } from 'bun:test';

import { WidgetSettingsDataSchema, WidgetSettingsWriteSchema } from '../../sdk/contracts/widgetSettings';
import { validSettings } from '../../test/fixtures';
import { invalidSettingsMessage, parseWidgetSettings } from '../WidgetService';

const valid = validSettings();
const FIELDS = Object.keys(WidgetSettingsWriteSchema.shape) as (keyof typeof WidgetSettingsWriteSchema.shape)[];
const RENDER_CONSTANTS = Object.keys(WidgetSettingsDataSchema.shape).filter(
  field => !(field in WidgetSettingsWriteSchema.shape),
);

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
    const rendered = WidgetSettingsWriteSchema.strip().parse(valid);
    expect(WidgetSettingsDataSchema.safeParse(withExtras).success).toBe(false);
    expect(result.settings).toEqual(rendered);
    expect(result.settings).not.toHaveProperty('widget_render_constant');
  });

  it('also drops the render constants the widget renders from its own hard-coded values', () => {
    const result = parseWidgetSettings(valid);
    expect(RENDER_CONSTANTS).not.toHaveLength(0);
    for (const field of RENDER_CONSTANTS) {
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
