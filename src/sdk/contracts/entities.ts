import { z } from 'zod';

import { BaseEntitySchema, EntityStatusSchema } from './common';
export const WorkspacePackageSchema = z.enum(['free', 'startup', 'growth', 'enterprise']);
export type PlanTier = z.infer<typeof WorkspacePackageSchema>;

/** The plan a Billing Cycle was opened on. `legacy_unknown` is pre-ledger history, which no plan sells. */
export const PlanSnapshotSchema = z.enum([...WorkspacePackageSchema.options, 'legacy_unknown']);
export type PlanSnapshot = z.infer<typeof PlanSnapshotSchema>;
export const AllowanceStatusSchema = z.enum(['known', 'unlimited', 'unknown']);
export type AllowanceStatus = z.infer<typeof AllowanceStatusSchema>;
export const RevenueStatusSchema = z.enum(['zero', 'known', 'unknown']);
export type RevenueStatus = z.infer<typeof RevenueStatusSchema>;

export const ApplicationTypeSchema = z.enum(['app', 'website']);

export type ApplicationType = z.infer<typeof ApplicationTypeSchema>;

export const WidgetTypeSchema = z.enum(['widget']);

export type WidgetType = z.infer<typeof WidgetTypeSchema>;

export const InstructionTypeSchema = z.enum(['tell', 'show', 'do']);

export type InstructionType = z.infer<typeof InstructionTypeSchema>;

const AuthMethodSchema = z.enum(['password', 'oauth']);

// Users don't have plans — plans belong to workspaces (via the workspace_plan table).
/**
 * The workspace role vocabulary — `admin` administers, `member` does not. One spelling everywhere:
 * DB enum, this contract, the dashboard, and the WorkOS role slug. Declared here (not `workspace.ts`)
 * because `UserEntitySchema` needs it and `workspace.ts` already imports from this file.
 */
export const WorkspaceMemberRoleSchema = z.enum(['admin', 'member']);
export type WorkspaceMemberRole = z.infer<typeof WorkspaceMemberRoleSchema>;

export const UserEntitySchema = BaseEntitySchema.extend({
  is_super: z.boolean(),
  status: EntityStatusSchema,
  email: z.email(),
  external_id: z.string().nullish(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  image_url: z.string().nullish(),
  last_login_at: z.coerce.date().nullish(),
  auth_method: AuthMethodSchema.nullish(),
  // Present only when the user was looked up THROUGH a workspace (`userSearch` with a workspace_id) —
  // a role is a property of the membership, not of the person, so a user read on its own has none.
  workspace_role: WorkspaceMemberRoleSchema.nullish(),
});

// The session-read tier of a user: neither app nor personaOS reads `image_url` (avatars render
// initials), `external_id`, `last_login_at`, `created_at` or `updated_at` off `authMe` or `userSearch` —
// only `userUpdate`'s output and the `UserUpdateSchema` input it derives still need the full entity.
// `authMe` builds this projection by hand without timestamps, so a timestamp here is not an over-send but
// an outage: `z.coerce.date()` of `undefined` is an Invalid Date and every login fails validation.
export const UserSummarySchema = UserEntitySchema.omit({
  image_url: true,
  external_id: true,
  last_login_at: true,
  created_at: true,
  updated_at: true,
});
export type UserSummary = z.infer<typeof UserSummarySchema>;

export type UserData = z.infer<typeof UserEntitySchema>;

// package and ending_date come from the workspace_plan table (joined on fetch), NOT the workspace row.
export const WorkspaceEntitySchema = BaseEntitySchema.extend({
  name: z.string(),
  slug: z.string(),
  status: EntityStatusSchema,
  package: WorkspacePackageSchema,
  ending_date: z.coerce.date().nullish(),
  external_workspace_id: z.string().nullish(),
  // Read-only flag derived from `slack_webhook_url`'s presence. The URL itself
  // is a secret and is never returned to clients — only this boolean is.
  slack_webhook_configured: z.boolean(),
  notify_all_members_on_question: z.boolean(),
});

export type WorkspaceData = z.infer<typeof WorkspaceEntitySchema>;

// `workspaceGet`'s shape: neither app nor any other consumer's settings pages read
// `external_workspace_id` or `status` off it — `workspaceCreate` and `workspaceUpdate` still return the
// full entity. `notify_all_members_on_question` IS read here now, by the app's workspace Notifications
// settings toggle.
export const WorkspaceSummarySchema = WorkspaceEntitySchema.omit({
  external_workspace_id: true,
  status: true,
});
export type WorkspaceSummary = z.infer<typeof WorkspaceSummarySchema>;

export const ApplicationEntitySchema = BaseEntitySchema.extend({
  workspace_id: z.number(),
  name: z.string(),
  slug: z.string(),
  type: ApplicationTypeSchema,
  url: z.string(),
  username: z.string().nullable(),
  password: z.string().nullable(),
  allowed_domains: z.array(z.string()),
});

export type ApplicationData = z.infer<typeof ApplicationEntitySchema>;

/** Used for all API responses; password is write-only and never returned to clients. */
export const ApplicationReadSchema = ApplicationEntitySchema.omit({ password: true });

export type ApplicationReadData = z.infer<typeof ApplicationReadSchema>;

export const WidgetChipSchema = z.object({
  chip_mode: InstructionTypeSchema,
  chip_text: z.string(),
});

export type WidgetChip = z.infer<typeof WidgetChipSchema>;

export const WidgetSettingsDataSchema = z.object({
  widget_enabled: z.boolean(),
  // The widget reads this only as `!== 'default'` (greeting toast) and `=== 'hidden'`; the retired
  // `compact`/`full` rendered identically to `default`, so db-V246 folds them onto it.
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

// The widget renders these from its own constants, so a write is a no-op; they stay in the read shape
// because published bundles safeParse them out of widgetDefaultGet.
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
export type WidgetSettingsWriteData = z.infer<typeof WidgetSettingsWriteSchema>;

export const WidgetEntitySchema = BaseEntitySchema.extend({
  application_id: z.number(),
  type: WidgetTypeSchema,
  settings: WidgetSettingsDataSchema,
  status: EntityStatusSchema,
  marketrix_id: z.string(),
  marketrix_key: z.string(),
  snippet: z.string().nullish(),
});

export type WidgetData = z.infer<typeof WidgetEntitySchema>;

// The widget's own boot call (`widgetPublicSearch`) authenticates by marketrix_id/marketrix_key, so the
// response must never carry that pair back, nor `marketrix_id`/the rendered embed `snippet` — an
// unauthenticated visitor's browser is the caller.
export const WidgetPublicSchema = WidgetEntitySchema.pick({
  status: true,
  application_id: true,
  settings: true,
});

export type WidgetPublicData = z.infer<typeof WidgetPublicSchema>;

export const ActivityLogTypeSchema = z.enum([
  'update_workspace',
  'update_user',
  'create_application',
  'update_application',
  'delete_application',
  'create_widget',
  'update_widget',
  'delete_widget',
  'create_knowledge',
  'update_knowledge',
  'delete_knowledge',
  // Exactly two membership verbs: someone REQUESTS membership, an admin INVITES them — no approving;
  // a request is answered with a WorkOS invitation or not at all, and it still must be accepted.
  'request_membership',
  'invite_user',
  // Workspace + subscription lifecycle — the transparency record a customer reads in settings, so
  // SYSTEM actions (Stripe webhooks) write these too with `user_id: null` rather than a fabricated admin.
  'create_workspace',
  'trial_started',
  'trial_ending_soon',
  'trial_ended',
  'subscription_created',
  'subscription_canceled',
  'plan_changed',
  'payment_succeeded',
  'payment_failed',
  'widget_question',
  'start_simulation',
  'create_workflow',
  'update_workflow',
  'delete_workflow',
  'toggle_workflow',
  'slack_command',
  'publish_survey',
  'unpublish_survey',
  'delete_survey_response',
]);

export type ActivityLogType = z.infer<typeof ActivityLogTypeSchema>;

// `ip_address`/`user_agent`/`created_by` are gone: `models/columnSchemas.ts`'s `ActivityMetadataByType`
// registry is the actual write-time gate, and every one of its per-type shapes is `.strict()` — none of
// them ever admits these three keys, so no stored row carries them and no migration is needed.
//
// This schema itself CANNOT be derived from that registry, and stays `.passthrough()` rather than
// `.strict()`: `ActivityMetadataByType` lives in `models/columnSchemas.ts`, which already imports
// `ActivityLogTypeSchema`/`ApplicationTypeSchema`/`WidgetTypeSchema` FROM this file, so importing it back
// would cycle; moving the registry here instead would drag `contracts/slack.ts` (the `slack_command`
// variant's `status` enum) into this file's import closure, which is mirrored byte-for-byte into the
// widget/persona-os/internal SDKs (`tests/unit/syncConsumers.test.ts` pins each one's file list) — a
// widget-facing change like that needs an npm republish and a `bun.lock` repin, not a side effect of a
// typing pass. `target_user_id`/`target_user_email`/`reason`/`widget_type`/`reminder` are declared
// because they carry PII or an internal enum a reader must never see; every other per-type field (a
// widget's `chat_id`, a knowledge row's `file_name`, …) rides through the passthrough untouched, since
// several ARE read (`support/widget/index.tsx` reads `widget_question`'s `question`) and this schema has
// no closure-safe way to enumerate them precisely without restating the registry above.
export const ActivityLogMetadataSchema = z
  .object({
    details: z.string().optional(),
    id: z.number().optional(),
    type: z.string().optional(),
    name: z.string().optional(),
    target_user_id: z.number().optional(),
    target_user_email: z.string().optional(),
    reason: z.string().optional(),
    widget_type: WidgetTypeSchema.optional(),
    reminder: z.literal(true).optional(),
  })
  .passthrough();

export const ActivityLogEntitySchema = BaseEntitySchema.extend({
  workspace_id: z.number(),
  user_id: z.number().nullable(),
  type: ActivityLogTypeSchema,
  metadata: ActivityLogMetadataSchema.optional(),
});

export type ActivityLogData = z.infer<typeof ActivityLogEntitySchema>;

// The one activity a client writes: the widget logging a visitor's question. Every other activity is written by
// the api itself, so the input is closed to this shape. The credentials resolve the application and are not stored.
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
