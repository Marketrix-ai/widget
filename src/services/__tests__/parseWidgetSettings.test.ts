/**
 * Tests for `parseWidgetSettingsOrThrow`: valid settings pass, unknown keys and render constants are dropped,
 * and each invalid rendered field is rejected and named.
 */
import { describe, expect, it } from 'bun:test';

import { WidgetSettingsDataSchema, WidgetSettingsWriteSchema } from '../../sdk/contracts/widgetSettings';
import { validSettings } from '../../test/fixtures';
import { parseWidgetSettingsOrThrow } from '../WidgetService';

const valid = validSettings();
const FIELDS = Object.keys(WidgetSettingsWriteSchema.shape) as (keyof typeof WidgetSettingsWriteSchema.shape)[];
const RENDER_CONSTANTS = Object.keys(WidgetSettingsDataSchema.shape).filter(
  field => !(field in WidgetSettingsWriteSchema.shape),
);

const expectRejectedAndNamed = (broken: unknown, invalidFields: string[]) => {
  expect(WidgetSettingsDataSchema.safeParse(broken).success).toBe(false);
  expect(() => parseWidgetSettingsOrThrow(broken)).toThrow(
    new Error(`Widget settings are invalid: ${invalidFields.join(', ')}`),
  );
};

describe('parseWidgetSettingsOrThrow', () => {
  it('accepts a valid settings object', () => {
    expect(() => parseWidgetSettingsOrThrow(valid)).not.toThrow();
    expect(WidgetSettingsDataSchema.safeParse(valid).success).toBe(true);
  });

  it('projects settings from a wider internal config while the wire schema rejects unknown keys', () => {
    const withExtras = { ...valid, widget_render_constant: 'x', another: 1 };
    const result = parseWidgetSettingsOrThrow(withExtras);
    const rendered = WidgetSettingsWriteSchema.strip().parse(valid);
    expect(WidgetSettingsDataSchema.safeParse(withExtras).success).toBe(false);
    expect(result).toEqual(rendered);
    expect(result).not.toHaveProperty('widget_render_constant');
  });

  it('also drops the render constants the widget renders from its own hard-coded values', () => {
    const result = parseWidgetSettingsOrThrow(valid);
    expect(RENDER_CONSTANTS).not.toHaveLength(0);
    for (const field of RENDER_CONSTANTS) {
      expect(result).not.toHaveProperty(field);
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
    expectRejectedAndNamed(broken, ['widget_enabled', 'widget_header']);
  });
});
