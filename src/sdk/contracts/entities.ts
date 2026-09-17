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

// Re-exported so existing importers of this file see no change — the three now live in
// `./activityLogVocabulary`, a dependency-free leaf `./activityLogMetadata` can import without cycling.
export { ActivityLogTypeSchema, ApplicationTypeSchema, WidgetTypeSchema };
export type { ActivityLogType, ApplicationType, WidgetType };

export const WorkspacePackageSchema = z.enum(['free', 'startup', 'growth', 'enterprise']);
export type PlanTier = z.infer<typeof WorkspacePackageSchema>;

/** The plan a Billing Cycle was opened on. `legacy_unknown` is pre-ledger history, which no plan sells. */
export const PlanSnapshotSchema = z.enum([...WorkspacePackageSchema.options, 'legacy_unknown']);
export type PlanSnapshot = z.infer<typeof PlanSnapshotSchema>;
export const AllowanceStatusSchema = z.enum(['known', 'unlimited', 'unknown']);
export type AllowanceStatus = z.infer<typeof AllowanceStatusSchema>;
export const RevenueStatusSchema = z.enum(['zero', 'known', 'unknown']);
export type RevenueStatus = z.infer<typeof RevenueStatusSchema>;

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

// `onboarding_reminders_sent`/`onboarding_reminder_sent_at` are deliberately absent: they are internal
// mail-worker bookkeeping columns (`models/user.ts`'s `UserInternalFields`), never read or written by
// a client, so they never join the wire entity at all rather than being added and then omitted per tier.
export const UserEntitySchema = BaseEntitySchema.extend({
  is_super: z.boolean(),
  status: EntityStatusSchema,
  email: z.email().max(255),
  external_id: z.string().max(255),
  first_name: z.string().max(100).nullish(),
  last_name: z.string().max(100).nullish(),
  image_url: z.string().max(500).nullish(),
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
// days_remaining is derived from ending_date at read time (whole days, clamped at 0, null with no
// ending_date) so every consumer gets one server-computed answer instead of re-deriving it from
// Date.now() client-side.
export const WorkspaceEntitySchema = BaseEntitySchema.extend({
  name: z.string().max(45),
  slug: z.string().max(100),
  status: EntityStatusSchema,
  package: WorkspacePackageSchema,
  ending_date: z.coerce.date().nullish(),
  days_remaining: z.number().int().nullable(),
  external_workspace_id: z.string().max(255).nullish(),
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
  name: z.string().max(200),
  slug: z.string().max(120),
  type: ApplicationTypeSchema,
  url: z.string().max(200),
  username: z.string().max(100).nullable(),
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

export const WidgetEntitySchema = BaseEntitySchema.extend({
  application_id: z.number(),
  type: WidgetTypeSchema,
  settings: WidgetSettingsDataSchema,
  status: EntityStatusSchema,
  marketrix_id: z.string().max(100),
  marketrix_key: z.string().max(100),
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

// `ip_address`/`user_agent`/`created_by` are gone: `ActivityMetadataByType` (`./activityLogMetadata`)
// is the actual write-time gate, and every one of its per-type shapes is `.strict()` — none of them
// ever admits these three keys, so no stored row carries them and no migration is needed.
//
// Derived from that same registry as a union of every per-type shape, now that it lives in its own
// leaf file rather than `models/columnSchemas.ts` (which imports FROM this file, so importing the
// registry back here would have cycled). A union rather than a `type`-keyed discriminated union
// because the discriminant is the sibling `activity_log.type` COLUMN, not a field inside `metadata`
// itself — Zod tries each branch in turn, which is looser than exact per-row typing but still a real
// narrowing over every key actually stored (verified against both environments' live key sets).
//
// `Object.values()` types as a plain `X[]`, which fails `z.union`'s `[a, b, ...rest]` tuple
// constraint, so the cast below is unavoidable — but it asserts only the ARRAY SHAPE (2+ elements),
// never the element type. Casting to `(typeof ActivityMetadataByType)[ActivityLogType]` (the real
// union of every branch's specific schema type, since `ActivityMetadataByType` keeps its object
// literal's own type under `satisfies` rather than widening to `Record<ActivityLogType, ZodType>`)
// keeps `z.infer<typeof ActivityLogMetadataSchema>` a genuine per-type union. The previous cast to
// `[ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]` erased every branch to `{}`, which is what forced
// every consumer (app#1313) to re-`safeParse` a row by hand to narrow it.
const activityMetadataVariants = Object.values(ActivityMetadataByType) as [
  (typeof ActivityMetadataByType)[ActivityLogType],
  (typeof ActivityMetadataByType)[ActivityLogType],
  ...(typeof ActivityMetadataByType)[ActivityLogType][],
];
export const ActivityLogMetadataSchema = z.union(activityMetadataVariants);

// `activity_log` has no `updated_at` column — a row is never edited after it's written — so this
// declares id/created_at inline rather than extending `BaseEntitySchema`, which also carries one.
export const ActivityLogEntitySchema = z.object({
  id: z.number(),
  created_at: z.coerce.date(),
  workspace_id: z.number(),
  user_id: z.number().nullable(),
  type: ActivityLogTypeSchema,
  metadata: ActivityLogMetadataSchema.nullish(),
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
