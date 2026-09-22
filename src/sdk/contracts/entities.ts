/**
 * The vocabularies and entities the widget shares with the dashboard: plan, allowance and member-role enums,
 * Widget settings and entities, and activity-log entries, plus `allowanceConsistency`, the one rule tying
 * allowance amounts to the allowance status. Public Widget projections never expose stored credentials.
 * User, workspace and Application rows live in narrower files so the widget never mirrors them.
 */
import { z } from 'zod';

import { ActivityMetadataByType } from './activityLogMetadata';
import {
  type ActivityLogType,
  ActivityLogTypeSchema,
  type ApplicationType,
  ApplicationTypeSchema,
  type WidgetType,
  WidgetTypeSchema,
} from './activityLogVocabulary';

export { ActivityLogTypeSchema, ApplicationTypeSchema, WidgetTypeSchema };
export type { ActivityLogType, ApplicationType, WidgetType };

export const WorkspacePackageSchema = z.enum(['free', 'startup', 'growth', 'enterprise']);
export type PlanTier = z.infer<typeof WorkspacePackageSchema>;

export const PlanSnapshotSchema = z.enum([...WorkspacePackageSchema.options, 'legacy_unknown']);
export type PlanSnapshot = z.infer<typeof PlanSnapshotSchema>;
export const AllowanceStatusSchema = z.enum(['known', 'unlimited', 'unknown']);
export type AllowanceStatus = z.infer<typeof AllowanceStatusSchema>;
export const allowanceConsistency = (
  cycle: {
    allowance_status: AllowanceStatus;
    allowance_credits: string | null;
    remaining_credits?: string | null;
    percent_left?: number | null;
  },
  ctx: z.RefinementCtx,
): void => {
  const known = cycle.allowance_status === 'known';
  for (const field of ['allowance_credits', 'remaining_credits', 'percent_left'] as const) {
    if (field in cycle && known !== (cycle[field] !== null)) {
      ctx.addIssue({ code: 'custom', path: [field], message: 'must be known iff the allowance status is known' });
    }
  }
};
export const RevenueStatusSchema = z.enum(['zero', 'known', 'unknown']);
export type RevenueStatus = z.infer<typeof RevenueStatusSchema>;

export const InstructionTypeSchema = z.enum(['tell', 'show', 'do']);

export type InstructionType = z.infer<typeof InstructionTypeSchema>;

export const WorkspaceMemberRoleSchema = z.enum(['admin', 'member']);
export type WorkspaceMemberRole = z.infer<typeof WorkspaceMemberRoleSchema>;

export const WidgetChipSchema = z.strictObject({
  chip_mode: InstructionTypeSchema,
  chip_text: z.string(),
});

export type WidgetChip = z.infer<typeof WidgetChipSchema>;

export const WidgetSettingsDataSchema = z.strictObject({
  widget_enabled: z.boolean(),
  widget_appearance: z.enum(['default', 'hidden']),
  widget_position: z.enum(['bottom_left', 'bottom_right', 'top_left', 'top_right']),
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
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type ApplicationWidgetData = z.infer<typeof ApplicationWidgetEntitySchema>;

export const ApplicationWidgetPublicSchema = ApplicationWidgetEntitySchema.pick({
  application_id: true,
  widget_settings: true,
});

export type ApplicationWidgetPublicData = z.infer<typeof ApplicationWidgetPublicSchema>;

const activityMetadataVariants = Object.values(ActivityMetadataByType) as [
  (typeof ActivityMetadataByType)[ActivityLogType],
  (typeof ActivityMetadataByType)[ActivityLogType],
  ...(typeof ActivityMetadataByType)[ActivityLogType][],
];
export const ActivityLogMetadataSchema = z.union(activityMetadataVariants);

export const ActivityLogEntitySchema = z.strictObject({
  id: z.number(),
  created_at: z.coerce.date(),
  workspace_id: z.number(),
  user_id: z.number().nullable(),
  type: ActivityLogTypeSchema,
  metadata: ActivityLogMetadataSchema.nullish(),
});

export type ActivityLogData = z.infer<typeof ActivityLogEntitySchema>;
