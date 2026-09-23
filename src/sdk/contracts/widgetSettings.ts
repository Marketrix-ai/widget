/**
 * The Support Widget's settings and entity schemas, zod only, so the widget bundle and the dashboard read them
 * without pulling in the widget procedures: widget and instruction types, chips, positions, the settings
 * document with its render constants and writable subset, and the stored and public widget entities.
 * Public Widget projections never expose stored credentials.
 */
import { z } from 'zod';

export const WidgetTypeSchema = z.enum(['widget']);
export type WidgetType = z.infer<typeof WidgetTypeSchema>;

export const InstructionTypeSchema = z.enum(['tell', 'show', 'do']);

export type InstructionType = z.infer<typeof InstructionTypeSchema>;

export const WidgetChipSchema = z.strictObject({
  chip_mode: InstructionTypeSchema,
  chip_text: z.string(),
});

export type WidgetChip = z.infer<typeof WidgetChipSchema>;

export const WidgetPositionSchema = z.enum(['bottom_left', 'bottom_right', 'top_left', 'top_right']);
export type WidgetPosition = z.infer<typeof WidgetPositionSchema>;

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

export const WIDGET_RENDER_CONSTANTS = [
  'widget_border_radius',
  'widget_font_size',
  'widget_animation_duration',
  'widget_fade_duration',
] as const;

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
