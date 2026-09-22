/**
 * Canonical user, workspace, Application, Widget and activity-log entity schemas.
 * They define full stored shapes plus narrower read and public projections.
 * Application credentials live separately, and public Widget projections never expose them.
 * User profile fields derive from WorkOS rather than database columns.
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
import { BaseEntitySchema, EntityStatusSchema } from './common';

export { ActivityLogTypeSchema, ApplicationTypeSchema, WidgetTypeSchema };
export type { ActivityLogType, ApplicationType, WidgetType };

export const WorkspacePackageSchema = z.enum(['free', 'startup', 'growth', 'enterprise']);
export type PlanTier = z.infer<typeof WorkspacePackageSchema>;

export const PlanSnapshotSchema = z.enum([...WorkspacePackageSchema.options, 'legacy_unknown']);
export type PlanSnapshot = z.infer<typeof PlanSnapshotSchema>;
export const AllowanceStatusSchema = z.enum(['known', 'unlimited', 'unknown']);
export type AllowanceStatus = z.infer<typeof AllowanceStatusSchema>;
export const RevenueStatusSchema = z.enum(['zero', 'known', 'unknown']);
export type RevenueStatus = z.infer<typeof RevenueStatusSchema>;

export const InstructionTypeSchema = z.enum(['tell', 'show', 'do']);

export type InstructionType = z.infer<typeof InstructionTypeSchema>;

export const WorkspaceMemberRoleSchema = z.enum(['admin', 'member']);
export type WorkspaceMemberRole = z.infer<typeof WorkspaceMemberRoleSchema>;

export const UserEntitySchema = BaseEntitySchema.extend({
  is_super: z.boolean(),
  status: EntityStatusSchema,
  email: z.email().max(255),
  external_id: z.string().max(255),
  first_name: z.string().max(100).nullish(),
  last_name: z.string().max(100).nullish(),
  image_url: z.string().max(500).nullish(),
  workspace_role: WorkspaceMemberRoleSchema.nullish(),
});

export const UserSummarySchema = UserEntitySchema.omit({
  image_url: true,
  external_id: true,
  created_at: true,
  updated_at: true,
});
export type UserSummary = z.infer<typeof UserSummarySchema>;

export type UserData = z.infer<typeof UserEntitySchema>;

export const WorkspaceEntitySchema = BaseEntitySchema.extend({
  name: z.string().max(45),
  slug: z.string().max(100),
  status: EntityStatusSchema,
  package: WorkspacePackageSchema,
  external_workspace_id: z.string().max(255).nullish(),
  slack_webhook_configured: z.boolean(),
  notify_all_members_on_question: z.boolean(),
  notification_recipient_user_id: z.number().nullable(),
});

export type WorkspaceData = z.infer<typeof WorkspaceEntitySchema>;

export const WorkspaceSummarySchema = WorkspaceEntitySchema.omit({
  external_workspace_id: true,
  status: true,
});
export type WorkspaceSummary = z.infer<typeof WorkspaceSummarySchema>;

export const ApplicationSkillDistillationStatusSchema = z.enum(['idle', 'pending', 'failed']);
export type ApplicationSkillDistillationStatus = z.infer<typeof ApplicationSkillDistillationStatusSchema>;

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

export const ApplicationEntitySchema = BaseEntitySchema.extend({
  workspace_id: z.number(),
  name: z.string().max(200),
  slug: z.string().max(120),
  type: ApplicationTypeSchema,
  url: z.string().max(200),
  allowed_domains: z.array(z.string()),
  skill_distillation_status: ApplicationSkillDistillationStatusSchema,
  skill_distillation_error: z.string().nullable(),
  widget_settings: WidgetSettingsDataSchema.nullable(),
  marketrix_id: z.string().max(100).nullable(),
  marketrix_key: z.string().max(100).nullable(),
});

export type ApplicationData = z.infer<typeof ApplicationEntitySchema>;

export const ApplicationReadSchema = ApplicationEntitySchema;

export type ApplicationReadData = z.infer<typeof ApplicationReadSchema>;

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

export const WidgetQuestionLogSchema = z.strictObject({
  type: z.literal('widget_question'),
  metadata: z.strictObject({
    question: z.string(),
    mode: InstructionTypeSchema,
    chat_id: z.string(),
    timestamp: z.string(),
    marketrix_id: z.string(),
    marketrix_key: z.string(),
    user_id: z.number().int().positive().optional(),
  }),
});
