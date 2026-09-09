/**
 * The shared widget-settings fixture the config-driven tests build from: `getMockWidgetConfig(overrides)`
 * returns a complete, schema-valid tenant config — every rendered setting plus the `mtxId`/`mtxKey` credential,
 * api host and preview flag a mounted widget needs — shallow-merged with `overrides`.
 *
 * `MockWidgetConfig` widens `ValidWidgetConfig` with the four render constants (`widget_border_radius`,
 * `widget_font_size`, `widget_animation_duration`, `widget_fade_duration`). `ValidWidgetConfig` is built on
 * `WidgetRenderedSettings`, which omits them, but callers hand this fixture straight to
 * `WidgetSettingsDataSchema.parse()`, which demands the whole wire shape. It is `Valid`, not partial, so
 * `renderWidget` can hand it to `WidgetRoot` without a cast — the fixture really does set every field.
 */
import type { ValidWidgetConfig, WidgetSettingsData } from '../types';

type MockWidgetConfig = ValidWidgetConfig &
  Pick<
    WidgetSettingsData,
    'widget_border_radius' | 'widget_font_size' | 'widget_animation_duration' | 'widget_fade_duration'
  >;

export function getMockWidgetConfig(overrides: Partial<MockWidgetConfig> = {}): MockWidgetConfig {
  return {
    widget_enabled: true,
    widget_appearance: 'default',
    widget_position: 'bottom_right',
    widget_header: 'Support',
    widget_body: 'How can we help?',
    widget_greeting: 'Hi! Need help?',
    widget_greeting_toast: true,
    widget_recording: false,
    widget_feature_tell: true,
    widget_feature_show: true,
    widget_feature_do: true,
    widget_background_color: '#111827',
    widget_text_color: '#f9fafb',
    widget_border_color: '#374151',
    widget_accent_color: '#3b82f6',
    widget_secondary_color: '#6b7280',
    widget_border_radius: '12px',
    widget_font_size: '14px',
    widget_width: '400px',
    widget_height: '600px',
    widget_animation_duration: '300ms',
    widget_fade_duration: '200ms',
    widget_chips: [],
    widget_position_z_index: 1230,
    mtxId: 'test-id',
    mtxKey: 'test-key',
    mtxApiHost: 'https://api.test',
    isPreviewMode: true,
    ...overrides,
  };
}
