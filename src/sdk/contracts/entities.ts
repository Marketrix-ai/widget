import { z } from 'zod';

import { BaseEntitySchema, EntityStatusSchema } from './common';

export const WorkspacePackageSchema = z.enum(['free', 'startup', 'growth', 'enterprise']);
export type WorkspacePackage = z.infer<typeof WorkspacePackageSchema>;

export const KnowledgeTypeSchema = z.enum(['document', 'video']);
export type KnowledgeType = z.infer<typeof KnowledgeTypeSchema>;

export const KnowledgeSourceSchema = z.enum(['user', 'research']);
export type KnowledgeSource = z.infer<typeof KnowledgeSourceSchema>;

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
 * `graphDispatch.ts` and `simulationHooks.ts`; relayed on the
 * `simulation/graph-updated` app event.
 */
export const GraphStatusSchema = z.enum(['pending', 'generating', 'completed', 'failed']);

export const ApplicationTypeSchema = z.enum(['app', 'website']);
export type ApplicationType = z.infer<typeof ApplicationTypeSchema>;

export const WidgetTypeSchema = z.enum(['widget']);
export type WidgetType = z.infer<typeof WidgetTypeSchema>;

export const InstructionTypeSchema = z.enum(['tell', 'show', 'do']);
export type InstructionType = z.infer<typeof InstructionTypeSchema>;

/**
 * Authentication method schema
 * password: Email/password authentication
 * oauth: Social login (Google, Microsoft, Apple, etc.) or SSO
 */
export const AuthMethodSchema = z.enum(['password', 'oauth']);

/**
 * Complete user entity schema
 * Note: Users don't have plans - plans belong to workspaces (via workspace_plan table)
 */
export const UserEntitySchema = BaseEntitySchema.extend({
  is_super: z.boolean(),
  status: EntityStatusSchema,
  email: z.string().email(),
  external_id: z.string().nullish(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  password: z.string().nullish(),
  image_url: z.string().nullish(),
  prompt_limit: z.number().nullish(),
  last_login_at: z.coerce.date().nullish(),
  auth_method: AuthMethodSchema.nullish(),
});
export type UserData = z.infer<typeof UserEntitySchema>;

export const UserCreateSchema = UserEntitySchema.partial().extend({
  email: z.string().email(),
  password: z.string(),
});
export type UserCreateData = z.infer<typeof UserCreateSchema>;

/**
 * Complete workspace entity schema
 * Note: package and ending_date come from workspace_plan table (joined when fetching workspace data).
 * They are NOT stored on the workspace table itself.
 */
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
});
export type KnowledgeData = z.infer<typeof KnowledgeEntitySchema>;

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

export const TaskDependencySchema = z.object({
  task_id: z.string(),
  condition: z.enum(['pass']).optional(),
});
export type TaskDependency = z.infer<typeof TaskDependencySchema>;

/**
 * A single task within a simulation. Direct simulations have 1 task (the prompt).
 * QA simulations have N tasks (one per journey).
 */
export const SimulationTaskEntrySchema = z.object({
  task_id: z.string(),
  title: z.string(),
  instructions: z.string(),
  status: z.enum(['pending', 'running', 'has_question', 'passed', 'failed', 'skipped', 'stopped']),
  error_message: z.string().nullish(),
  started_at: z.string().nullish(),
  completed_at: z.string().nullish(),
  order_index: z.number().int().nonnegative().default(0),
  tab_id: z.string().nullish(),
  step_count: z.number().int().nonnegative().default(0),
  blocked_by: z.array(TaskDependencySchema).default([]),
});
export type SimulationTaskEntry = z.infer<typeof SimulationTaskEntrySchema>;

export const SentimentSchema = z.enum(['positive', 'neutral', 'negative']);

export const StepReactionSchema = z.object({
  step_index: z.number(),
  // fix #3: nullable to match the persisted rows. The live persistStepReaction path
  // (simulationTerminal) inserts step rows with NULL screenshot_ref (and a not-yet-
  // classified sentiment), and the read path re-parses this schema — a non-nullable
  // shape would 500 simulationGet + every studies read.
  screenshot_ref: z.string().nullable(),
  reaction: z.string(),
  sentiment: SentimentSchema.nullable(),
});
// One reactor's reaction to one simulation. run_id/user_index are null for a
// direct sim's attached persona; set for a study persona-user. Shared by the
// direct-sim read path AND the study replay.
export const PersonaSimReactionEntitySchema = z.object({
  id: z.number(),
  run_id: z.number().nullable(),
  persona_id: z.number().nullable(),
  user_index: z.number().nullable(),
  simulation_id: z.number().nullable(),
  // A/B variant this reaction's sim belongs to. Set for abtest reactions (from the
  // sim's variant at create), null for uxr/survey/direct. Lets the app build a
  // {study_variant_id → simulation_id} map purely from the run's reactions — no
  // positional zip of orderedVariants[i] → distinctSimIds[i] in DB row order.
  study_variant_id: z.number().nullable(),
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
  status_message: z.string().nullish(),
  path: z.string().nullish(),
  instructions: z.string().nullish(),
  // Persisted display name `{TypeLabel} #{id} Run`.
  name: z.string().nullish(),
  // Origin type: direct/uxr/survey/ab/qa.
  type: z.enum(['direct', 'uxr', 'survey', 'ab', 'qa']).nullish(),
  pinned: z.boolean().optional(),
  source: z.enum(['direct', 'qa']).optional(),
  graph_id: z.string().nullish(),
  source_metadata: z.record(z.string(), z.unknown()).nullish(),
  tasks: z.array(SimulationTaskEntrySchema).optional(),
  graph_status: GraphStatusSchema.optional(),
  graph_steps_processed: z.number().int().nonnegative().optional(),
  graph_steps_total: z.number().int().nonnegative().optional(),
  graph_error: z.string().nullish(),
  created_by_user_id: z.number().nullish(),
  // Derived flag: true if any per-task status is `has_question`. The parent
  // `status` itself never holds `has_question` — that's a per-task state. The
  // flag drives the "Question" UI pill on the simulation header.
  has_question: z.boolean().optional(),
  // Participants — personas that REACT to this sim; each carries persona_id + user_count (both required) + their reactions.
  participants: z.array(z.object({ persona_id: z.number(), user_count: z.number().int().positive() })).default([]),
  reactions: z.array(PersonaSimReactionEntitySchema).default([]),
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
  url: z.string().nullish(),
  username: z.string().nullish(),
  password: z.string().nullish(),
  allowed_domains: z.array(z.string()).nullish().default([]),
});
export type ApplicationData = z.infer<typeof ApplicationEntitySchema>;

/**
 * Application read schema — entity minus password. Used for all API
 * responses; password is write-only and never returned to clients.
 */
export const ApplicationReadSchema = ApplicationEntitySchema.omit({ password: true });
export type ApplicationReadData = z.infer<typeof ApplicationReadSchema>;

export const WidgetChipSchema = z.object({
  chip_mode: z.enum(['show', 'tell', 'do']),
  chip_text: z.string(),
});
export type WidgetChip = z.infer<typeof WidgetChipSchema>;

export const WidgetSettingsDataSchema = z.object({
  widget_enabled: z.boolean(),
  widget_appearance: z.enum(['default', 'compact', 'full']),
  widget_position: z.enum(['bottom_left', 'bottom_right', 'top_left', 'top_right']),
  widget_device: z.enum(['desktop', 'mobile', 'desktop_mobile']),
  widget_header: z.string(),
  widget_body: z.string(),
  widget_greeting: z.string(),
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

/**
 * State Trigger entity schema - stores URL patterns and messages to show in widget
 * `message` is one or more chip texts shown by the widget when the URL pattern matches.
 */
export const StateTriggerEntitySchema = BaseEntitySchema.extend({
  widget_id: z.number(),
  url_pattern: z.string(),
  message: z.array(z.string()),
  description: z.string().optional(),
});
export type StateTriggerData = z.infer<typeof StateTriggerEntitySchema>;

/**
 * QA run status — first-class TEXT+CHECK column on qa_run (no longer derived).
 * `synthesizing` = all sims terminal but per-journey verdicts still completing (QA has no
 * run-level rollup like studies). Canonical wire vocabulary.
 */
export const QARunStatusSchema = z.enum(['running', 'synthesizing', 'completed', 'failed', 'stopped']);
export type QARunStatus = z.infer<typeof QARunStatusSchema>;

/** QA verdict per (run, persona, journey, viewport) — DATA-derived by the api from qa_verdict; NOT a wire status. */
export const QARunVerdictStatusSchema = z.enum(['passed', 'failed', 'indecisive']);
export type QARunVerdictStatus = z.infer<typeof QARunVerdictStatusSchema>;

/** A human resolution of an indecisive verdict — resolves to a decision, so no `indecisive`. */
export const HumanRulingSchema = z.enum(['passed', 'failed']);
export type HumanRuling = z.infer<typeof HumanRulingSchema>;

export const ActionLogTypeSchema = z.enum([
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
  'approve_user',
  'deny_user',
  'request_workspace',
  'widget_question',
  'qa_run_started',
  'start_simulation',
  'create_automation',
  'update_automation',
  'delete_automation',
  'toggle_automation',
  'slack_command',
]);
export type ActionLogType = z.infer<typeof ActionLogTypeSchema>;

export const ActionLogMetadataSchema = z
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
  .passthrough(); // Allow additional fields for flexibility (e.g., updatedData, previousData, createdData)
export type ActionLogMetadataData = z.infer<typeof ActionLogMetadataSchema>;

export const ActionLogEntitySchema = BaseEntitySchema.extend({
  workspace_id: z.number(),
  user_id: z.number(),
  type: ActionLogTypeSchema,
  metadata: ActionLogMetadataSchema.optional(),
});
export type ActionLogData = z.infer<typeof ActionLogEntitySchema>;

export const ActionLogCreateSchema = ActionLogEntitySchema.partial().extend({
  type: ActionLogTypeSchema,
});

export const UserQuotaSchema = z.object({
  user_id: z.number(),
  limit: z.number(),
  used: z.number(),
  remaining: z.number(),
});
export type UserQuotaData = z.infer<typeof UserQuotaSchema>;

// Shared across root (AppEventSchema user-study/run payload) and UX-research domain.
export const SuggestedSimulationSchema = z.object({
  description: z.string(),
  selected: z.boolean(),
  simulation_id: z.number().nullable().optional(),
  task_id: z.string().nullable().optional(),
  status: SimulationStatusSchema.nullable().optional(),
});
export type SuggestedSimulation = z.infer<typeof SuggestedSimulationSchema>;
