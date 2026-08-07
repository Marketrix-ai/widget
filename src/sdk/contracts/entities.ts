import { z } from 'zod';

import { BaseEntitySchema, EntityStatusSchema } from './common';

export const WorkspacePackageSchema = z.enum(['free', 'startup', 'growth', 'enterprise']);

export const KnowledgeTypeSchema = z.enum(['document', 'video']);
export type KnowledgeType = z.infer<typeof KnowledgeTypeSchema>;

export const KnowledgeSourceSchema = z.enum(['user', 'research']);

// Canonical wire vocabulary matching the `simulation_status` Postgres ENUM and the
// `SimulationStatus` proto enum.
export const SimulationStatusSchema = z.enum([
  'queued',
  'running',
  'creating_knowledge',
  'has_question',
  'completed',
  'failed',
  'stopped',
]);
export type SimulationStatus = z.infer<typeof SimulationStatusSchema>;

/**
 * Graph generation lifecycle status on a simulation row. Values written by
 * `graphDispatch.ts` and `simulationHooks.ts`.
 */
export const GraphStatusSchema = z.enum(['pending', 'generating', 'completed', 'failed']);

export const ApplicationTypeSchema = z.enum(['app', 'website']);
export type ApplicationType = z.infer<typeof ApplicationTypeSchema>;

export const WidgetTypeSchema = z.enum(['widget']);
export type WidgetType = z.infer<typeof WidgetTypeSchema>;

export const InstructionTypeSchema = z.enum(['tell', 'show', 'do']);
export type InstructionType = z.infer<typeof InstructionTypeSchema>;

const AuthMethodSchema = z.enum(['password', 'oauth']);

// Users don't have plans — plans belong to workspaces (via the workspace_plan table).
/**
 * The workspace role vocabulary — `admin` administers the workspace, `member` does not. One spelling
 * everywhere: the same two words in the database enum, in this contract, in the dashboard, and as the
 * WorkOS role slug. Declared here rather than in `workspace.ts` because `UserEntitySchema` needs it and
 * `workspace.ts` already imports from this file.
 */
export const WorkspaceMemberRoleSchema = z.enum(['admin', 'member']);

export const UserEntitySchema = BaseEntitySchema.extend({
  is_super: z.boolean(),
  status: EntityStatusSchema,
  email: z.string().email(),
  external_id: z.string().nullish(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  password: z.string().nullish(),
  image_url: z.string().nullish(),
  last_login_at: z.coerce.date().nullish(),
  auth_method: AuthMethodSchema.nullish(),
  // Present only when the user was looked up THROUGH a workspace (`userSearch` with a workspace_id) —
  // a role is a property of the membership, not of the person, so a user read on its own has none.
  workspace_role: WorkspaceMemberRoleSchema.nullish(),
});
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
  slack_webhook_configured: z.boolean().optional(),
  notify_all_members_on_question: z.boolean().optional(),
});
export type WorkspaceData = z.infer<typeof WorkspaceEntitySchema>;

export const KnowledgeEntitySchema = BaseEntitySchema.extend({
  workspace_id: z.number(),
  application_id: z.number().optional(),
  file_name: z.string().min(1),
  file_size: z.coerce.number(),
  file_type: KnowledgeTypeSchema,
  file_url: z.string(),
  source_url: z.string().nullish(), // Original URL for URL-based documents
  source: KnowledgeSourceSchema.default('user').optional(),
  // Non-null ⇒ respondent evidence (an interview transcript / persona file) rather than product
  // knowledge; the unfiltered chunk search excludes those rows.
  persona_id: z.number().nullish(),
  // `.default().optional()` is load-bearing on the two NOT NULL fields (same idiom as `source` above):
  // Knowledge is `Model<KnowledgeData>`, so a key that is required in the inferred output is required
  // by `CreationAttributes` too, and every existing `Knowledge.create({...})` call site stops compiling.
  ingest_status: z.enum(['pending', 'embedding', 'ready', 'failed', 'unsupported']).default('pending').optional(),
  ingest_error: z.string().nullish(),
  extracted_chars: z.number().default(0).optional(),
});
export type KnowledgeData = z.infer<typeof KnowledgeEntitySchema>;

// A file uploaded under a persona (meeting minutes, transcripts, …). `file_type` is the raw
// upload MIME type (free-form) — persona files aren't constrained to the document/video vocabulary.
export const PersonaFileEntitySchema = BaseEntitySchema.extend({
  workspace_id: z.number(),
  application_id: z.number(),
  persona_id: z.number(),
  file_name: z.string().min(1),
  file_size: z.coerce.number(),
  file_type: z.string(),
  file_url: z.string(),
});
export type PersonaFileData = z.infer<typeof PersonaFileEntitySchema>;

/**
 * Device viewport — the only device dimension (Chrome-only). A simulation runs at exactly
 * one viewport; selecting N viewports fans out into N simulations (one per viewport).
 * Defined here (the widget/root import closure) so SSE + simulation + qa contracts can share it.
 */
export const ViewportNameSchema = z.enum(['desktop', 'tablet', 'mobile']);
export type ViewportName = z.infer<typeof ViewportNameSchema>;
export const VIEWPORT_DIMENSIONS: Record<ViewportName, { width: number; height: number }> = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 393, height: 852 },
};

export const SentimentSchema = z.enum(['positive', 'neutral', 'negative']);

export const StepReactionSchema = z.object({
  step_index: z.number(),
  // screenshot_ref stays nullable: the live persistStepReaction path (simulationTerminal)
  // inserts step rows with a NULL screenshot_ref, and the read path re-parses this schema —
  // a non-nullable shape would 500 simulationGet + every studies read. reaction/sentiment
  // are NOT NULL columns (always written).
  screenshot_ref: z.string().nullable(),
  reaction: z.string(),
  sentiment: SentimentSchema,
});
// One reactor's reaction to one simulation. run_id/user_index are null for a
// direct sim's attached persona; set for a study persona-user. Shared by the
// direct-sim read path AND the study replay.
export const SimulationReactionEntitySchema = z.object({
  id: z.number(),
  run_id: z.number().nullable(),
  persona_id: z.number().nullable(),
  user_index: z.number().nullable(),
  simulation_id: z.number().nullable(),
  // A/B variant this reaction's sim belongs to. Set for ab study reactions (from the
  // sim's variant at create), null for uxr/survey/direct. Lets the app build a
  // {study_variant_id → simulation_id} map purely from the run's reactions — no
  // positional zip of orderedVariants[i] → distinctSimIds[i] in DB row order.
  study_variant_id: z.number().nullable(),
  // uxr browser-task the sim ran (null for ab study/survey/direct); mirrors study_variant_id.
  study_task_id: z.number().nullable(),
  journey_reaction: z.string().nullable(),
  journey_sentiment: SentimentSchema.nullable(),
  status: z.enum(['pending', 'completed', 'failed']),
  step_reactions: z.array(StepReactionSchema).default([]),
  question_answers: z.array(z.object({ study_question_id: z.number(), answer: z.string() })).default([]),
});

export const SimulationEntitySchema = BaseEntitySchema.extend({
  application_id: z.number(),
  job_id: z.string(),
  browser_session_id: z.string().nullish(),
  status: SimulationStatusSchema,
  status_message: z.string(),
  path: z.string().nullish(),
  instructions: z.string(),
  // Persisted display name `{TypeLabel} #{id} Run`.
  name: z.string().nullish(),
  type: z.enum(['direct', 'uxr', 'survey', 'ab', 'qa']),
  pinned: z.boolean().optional(),
  source: z.enum(['direct', 'qa']).optional(),
  graph_id: z.string().nullish(),
  source_metadata: z.record(z.string(), z.unknown()).nullish(),
  step_count: z.number().int().nonnegative().nullish(),
  started_at: z.coerce.date().nullish(),
  completed_at: z.coerce.date().nullish(),
  // Stamped once this sim's study/QA terminal output is persisted — the synthesis gate's settle marker.
  output_persisted_at: z.coerce.date().nullish(),
  graph_status: GraphStatusSchema.optional(),
  graph_steps_processed: z.number().int().nonnegative().optional(),
  graph_steps_total: z.number().int().nonnegative().optional(),
  graph_error: z.string().nullish(),
  created_by_user_id: z.number().nullish(),
  // Mirror of `status === 'has_question'`, surfaced as a standalone flag so the live SSE
  // stream can toggle the header "Question" pill without refetching the status.
  has_question: z.boolean().optional(),
  // Riders — personas that REACT to this sim.
  riders: z.array(z.object({ persona_id: z.number(), user_count: z.number().int().positive() })).default([]),
  reactions: z.array(SimulationReactionEntitySchema).default([]),
  // Driver — the single persona this sim RUNS AS (in-character; QA + survey); null = neutral.
  driver_persona_id: z.number().nullable().default(null),
  viewport: ViewportNameSchema.default('desktop'),
});
export type SimulationData = z.infer<typeof SimulationEntitySchema>;

export const ApplicationEntitySchema = BaseEntitySchema.extend({
  workspace_id: z.number(),
  name: z.string(),
  slug: z.string(),
  type: ApplicationTypeSchema,
  url: z.string(),
  username: z.string().nullish(),
  password: z.string().nullish(),
  allowed_domains: z.array(z.string()).default([]),
});
export type ApplicationData = z.infer<typeof ApplicationEntitySchema>;

/** Used for all API responses; password is write-only and never returned to clients. */
export const ApplicationReadSchema = ApplicationEntitySchema.omit({ password: true });
export type ApplicationReadData = z.infer<typeof ApplicationReadSchema>;

export const WidgetChipSchema = z.object({
  chip_mode: z.enum(['show', 'tell', 'do']),
  chip_text: z.string(),
});
export type WidgetChip = z.infer<typeof WidgetChipSchema>;

export const WidgetSettingsDataSchema = z.object({
  widget_enabled: z.boolean(),
  widget_appearance: z.enum(['default', 'compact', 'full', 'hidden']),
  widget_position: z.enum(['bottom_left', 'bottom_right', 'top_left', 'top_right']),
  widget_device: z.enum(['desktop', 'mobile', 'desktop_mobile']),
  widget_header: z.string(),
  widget_body: z.string(),
  widget_greeting: z.string(),
  widget_greeting_toast: z.boolean(),
  widget_recording: z.boolean(),
  widget_feature_tell: z.boolean(),
  widget_feature_show: z.boolean(),
  widget_feature_do: z.boolean(),
  widget_feature_human: z.boolean(),
  widget_background_color: z.string(),
  widget_text_color: z.string(),
  widget_border_color: z.string(),
  widget_accent_color: z.string(),
  widget_secondary_color: z.string(),
  widget_border_radius: z.string(),
  widget_font_size: z.string(),
  widget_width: z.string(),
  widget_height: z.string(),
  widget_shadow: z.string(),
  widget_animation_duration: z.string(),
  widget_fade_duration: z.string(),
  widget_bounce_effect: z.boolean(),
  widget_chips: z.array(WidgetChipSchema),
});
export type WidgetSettingsData = z.infer<typeof WidgetSettingsDataSchema>;

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

/** `message` is one or more chip texts shown by the widget when the URL pattern matches. */
export const StateTriggerEntitySchema = BaseEntitySchema.extend({
  widget_id: z.number(),
  url_pattern: z.string(),
  message: z.array(z.string()),
  description: z.string().optional(),
});
export type StateTriggerData = z.infer<typeof StateTriggerEntitySchema>;

/**
 * Run status — first-class TEXT+CHECK column on qa_run and study_run (no longer derived).
 * `finalizing` = all sims terminal but the run-level fold still completing.
 * Canonical wire vocabulary shared by QA runs and study runs.
 */
export const RunStatusSchema = z.enum(['created', 'running', 'finalizing', 'completed', 'failed', 'stopped']);
export type RunStatus = z.infer<typeof RunStatusSchema>;

/** QA outcome per (run, persona, journey, viewport) — DATA-derived by the api from qa_outcomes; NOT a wire status. */
export const QARunOutcomeStatusSchema = z.enum(['passed', 'failed', 'indecisive']);
export type QARunOutcomeStatus = z.infer<typeof QARunOutcomeStatusSchema>;

/** A human resolution of an indecisive outcome — resolves to a decision, so no `indecisive`. */
export const RulingSchema = z.enum(['passed', 'failed']);
export type Ruling = z.infer<typeof RulingSchema>;

export const ActivityLogTypeSchema = z.enum([
  'user_login',
  'url_visit',
  'update_workspace',
  'create_user',
  'update_user',
  'delete_user',
  'create_application',
  'update_application',
  'delete_application',
  'create_widget',
  'update_widget',
  'delete_widget',
  'create_knowledge',
  'update_knowledge',
  'delete_knowledge',
  // The membership vocabulary is exactly two verbs: someone REQUESTS membership, an admin INVITES them.
  // There is no approving — a request is answered with a WorkOS invitation or not at all, and the
  // invitation still has to be accepted. The retired `approve_user` / `deny_user` / `request_workspace`
  // are gone from the wire; both databases hold zero rows using them (checked 2026-08-06) and Postgres
  // keeps the dead labels because an enum value cannot be dropped without rewriting the type.
  'request_membership',
  'invite_user',
  // Workspace + subscription lifecycle. These are the transparency record a customer reads in settings,
  // so they are written for the SYSTEM's actions too (Stripe webhooks) with `user_id: null` — nobody
  // clicked anything when a trial lapsed, and attributing it to the last admin would be a lie.
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
  'qa_run_started',
  'start_simulation',
  'create_workflow',
  'update_workflow',
  'delete_workflow',
  'toggle_workflow',
  'slack_command',
  'create_form',
  'update_form',
  'delete_form',
  'duplicate_form',
  'publish_form',
  'unpublish_form',
  'archive_form',
  'submit_form_response',
  'delete_form_response',
]);
export type ActivityLogType = z.infer<typeof ActivityLogTypeSchema>;

export const ActivityLogMetadataSchema = z
  .object({
    details: z.string().optional(),
    id: z.number().optional(),
    type: z.string().optional(),
    name: z.string().optional(),
    target_user_id: z.number().optional(),
    target_user_email: z.string().optional(),
    reason: z.string().optional(),
    assigned_role: z.string().optional(),
    new_role: z.string().optional(),
    previous_role: z.string().optional(),
    workspace_name: z.string().optional(),
    workspace_slug: z.string().optional(),
    ip_address: z.string().optional(),
    user_agent: z.string().optional(),
    widget_type: z.string().optional(),
    created_by: z.number().optional(),
  })
  .passthrough();

export const ActivityLogEntitySchema = BaseEntitySchema.extend({
  workspace_id: z.number(),
  user_id: z.number().nullable(),
  type: ActivityLogTypeSchema,
  metadata: ActivityLogMetadataSchema.optional(),
});
export type ActivityLogData = z.infer<typeof ActivityLogEntitySchema>;

export const ActivityLogCreateSchema = ActivityLogEntitySchema.partial().extend({
  type: ActivityLogTypeSchema,
});
