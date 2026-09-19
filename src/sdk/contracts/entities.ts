/**
 * Entity schemas for users, workspaces, applications, widgets and activity log rows — the shapes most
 * other contracts build on.
 *
 * Exports the full entity schema and a narrower read/summary variant for each, plus the activity log's
 * per-type metadata union. `ApplicationEntitySchema`'s `skill_distillation_status`/`_error` track the
 * last skill-distillation attempt for that application, since a distilled skill is written directly with
 * no separate draft row. `ApplicationEntitySchema` carries no `username`/`password` (Part F step 10
 * folded the application's own default login into `application_credential` with `origin: null`) —
 * `ApplicationCreateSchema`/`ApplicationUpdateSchema` (`contracts/application.ts`) still accept them as
 * write-through-only input fields, routed to that credential row by `applicationService.ts`, never stored
 * on this entity or returned by it. `WidgetPublicSchema` never returns the widget's own auth credentials,
 * since an unauthenticated visitor's browser is the caller.
 * `ApplicationEntitySchema` also IS the row schema: `models/application.ts`'s fields and `COLUMN_SCHEMAS`'s
 * `application` enum entries are typed directly off it, so it can never drift from the table it describes.
 * `UserEntitySchema`'s `first_name`/`last_name`/`image_url` are DERIVED (Part F step 10 dropped the
 * columns -- WorkOS is the system of record): `userService.ts`'s members-list search batches
 * `workos.userManagement.listUsers({organizationId})` once per list, never per row, and `authMe`
 * (`handlers/auth.ts`) reads them out of the session instead of a column or a live WorkOS call, since the
 * login flow already resolves the WorkOS profile via `resolveUserByWorkosIdentity`. The global super-user
 * search does not enrich these fields at all -- there is no workspace to scope a batch call by.
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
});

export type WorkspaceData = z.infer<typeof WorkspaceEntitySchema>;

export const WorkspaceSummarySchema = WorkspaceEntitySchema.omit({
  external_workspace_id: true,
  status: true,
});
export type WorkspaceSummary = z.infer<typeof WorkspaceSummarySchema>;

export const ApplicationSkillDistillationStatusSchema = z.enum(['idle', 'pending', 'failed']);
export type ApplicationSkillDistillationStatus = z.infer<typeof ApplicationSkillDistillationStatusSchema>;

export const WidgetChipSchema = z.object({
  chip_mode: InstructionTypeSchema,
  chip_text: z.string(),
});

export type WidgetChip = z.infer<typeof WidgetChipSchema>;

export const WidgetSettingsDataSchema = z.object({
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

// Widget (Part F step 10): folded into `application` as `widget_settings`/`marketrix_id`/`marketrix_key`
// columns -- `type`/`status` are gone (the only writer created `type: 'widget'`; `status` had nowhere to
// fold into, `application` never had a `status` column). `ApplicationWidgetEntitySchema` is the narrow
// widget-only projection `widgetCreate`/`widgetUpdate`/`widgetSearch` return, keyed by `application_id`
// now that there is no separate widget id; `snippet` is DERIVED (built from marketrix_id/key, never
// stored). `ApplicationWidgetPublicSchema` is the widget's own session-less boot lookup — it must never
// return the credential pair or the snippet back to the caller that just supplied them.
export const ApplicationWidgetEntitySchema = z.object({
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

export const ActivityLogEntitySchema = z.object({
  id: z.number(),
  created_at: z.coerce.date(),
  workspace_id: z.number(),
  user_id: z.number().nullable(),
  type: ActivityLogTypeSchema,
  metadata: ActivityLogMetadataSchema.nullish(),
});

export type ActivityLogData = z.infer<typeof ActivityLogEntitySchema>;

export const WidgetQuestionLogSchema = z
  .object({
    type: z.literal('widget_question'),
    metadata: z
      .object({
        question: z.string(),
        mode: InstructionTypeSchema,
        chat_id: z.string(),
        timestamp: z.string(),
        marketrix_id: z.string(),
        marketrix_key: z.string(),
        user_id: z.number().int().positive().optional(),
      })
      .strict(),
  })
  .strict();
