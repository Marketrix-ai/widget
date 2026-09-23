/**
 * The Support Widget's settings and entity schemas, zod only, so the widget bundle and the dashboard read them
 * without pulling in the widget procedures: widget and instruction types, chips, positions, the settings
 * document with its render constants, writable subset and `DEFAULT_WIDGET_SETTINGS`, and the stored and public
 * widget entities. A stored settings value is merged over the defaults, so a setting added later reads its
 * default rather than `undefined` in the bundle.
 * Public Widget projections never expose stored credentials.
 */
import { z } from 'zod';

export const WidgetTypeSchema = z.enum(['widget']);

export const InstructionTypeSchema = z.enum(['tell', 'show', 'do']);

export type InstructionType = z.infer<typeof InstructionTypeSchema>;

const WidgetChipSchema = z.strictObject({
  chip_mode: InstructionTypeSchema,
  chip_text: z.string(),
});

export type WidgetChip = z.infer<typeof WidgetChipSchema>;

const WidgetPositionSchema = z.enum(['bottom_left', 'bottom_right', 'top_left', 'top_right']);

export const WidgetSettingsDataSchema = z.strictObject({
  widget_enabled: z.boolean(),
  widget_appearance: z.enum(['default', 'hidden']),
  widget_position: WidgetPositionSchema,
  widget_header: z.string(),
  widget_body: z.string(),
  widget_greeting: z.string(),
  widget_greeting_toast: z.boolean(),
  widget_recording: z.boolean(),
  widget_feature_tell: z.boolean(),
  widget_feature_show: z.boolean(),
  widget_feature_do: z.boolean(),
  widget_background_color: z.string(),
  widget_text_color: z.string(),
  widget_border_color: z.string(),
  widget_accent_color: z.string(),
  widget_secondary_color: z.string(),
  widget_border_radius: z.string(),
  widget_font_size: z.string(),
  widget_width: z.string(),
  widget_height: z.string(),
  widget_animation_duration: z.string(),
  widget_fade_duration: z.string(),
  widget_chips: z.array(WidgetChipSchema),
});

export type WidgetSettingsData = z.infer<typeof WidgetSettingsDataSchema>;

export const DEFAULT_WIDGET_SETTINGS: WidgetSettingsData = {
  widget_enabled: true,
  widget_appearance: 'default',
  widget_position: 'bottom_right',
  widget_header: 'Marketrix AI',
  widget_body: 'How can I help you today?',
  widget_greeting: 'Hey There!',
  widget_greeting_toast: true,
  widget_recording: false,
  widget_feature_tell: true,
  widget_feature_show: true,
  widget_feature_do: true,
  widget_background_color: '#f5f5f5',
  widget_text_color: '#6B6B6B',
  widget_border_color: 'rgba(255, 255, 255, 0.3)',
  widget_accent_color: '#303030',
  widget_secondary_color: '#707070',
  widget_border_radius: '12px',
  widget_font_size: '14px',
  widget_width: '360px',
  widget_height: '450px',
  widget_animation_duration: '300ms',
  widget_fade_duration: '200ms',
  widget_chips: [],
};

export const WidgetSettingsWriteSchema = WidgetSettingsDataSchema.omit({
  widget_border_radius: true,
  widget_font_size: true,
  widget_animation_duration: true,
  widget_fade_duration: true,
});

export const ApplicationWidgetEntitySchema = z.strictObject({
  application_id: z.number(),
  widget_settings: WidgetSettingsDataSchema,
  marketrix_id: z.string().max(100),
  marketrix_key: z.string().max(100),
  snippet: z.string().nullish(),
  created_at: z.date(),
  updated_at: z.date(),
});

export type ApplicationWidgetData = z.infer<typeof ApplicationWidgetEntitySchema>;

export const ApplicationWidgetPublicSchema = ApplicationWidgetEntitySchema.pick({
  application_id: true,
  widget_settings: true,
});

export type ApplicationWidgetPublicData = z.infer<typeof ApplicationWidgetPublicSchema>;
