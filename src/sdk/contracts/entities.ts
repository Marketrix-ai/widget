import { z } from 'zod';

import { BaseEntitySchema, EntityStatusSchema } from './common';

export const WorkspacePackageSchema = z.enum(['free', 'startup', 'growth', 'enterprise']);
export type WorkspacePackage = z.infer<typeof WorkspacePackageSchema>;

export const AgentTypeSchema = z.enum(['human', 'ai']);
export type AgentType = z.infer<typeof AgentTypeSchema>;

export const AgentVoiceSchema = z.enum(['male', 'female']);
export type AgentVoice = z.infer<typeof AgentVoiceSchema>;

export const AgentStatusSchema = z.enum(['active', 'learning', 'error']);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

// Learning progress uses nullable boolean:
// - null: callback not yet received
// - true: callback received with success
// - false: callback received with failure
export const LearningProgressSchema = z.object({
  graph_index_created: z.boolean().nullable(),
});

export const KnowledgeTypeSchema = z.enum(['document', 'video']);
export type KnowledgeType = z.infer<typeof KnowledgeTypeSchema>;

export const KnowledgeSourceSchema = z.enum(['user', 'research']);
export type KnowledgeSource = z.infer<typeof KnowledgeSourceSchema>;

export const QAFlowStatusSchema = z.enum(['pending', 'processing', 'waiting_review', 'completed', 'failed']);

/**
 * Simulation parent status — canonical wire vocabulary matching the
 * `simulation_status` Postgres ENUM and the `SimulationStatus` proto enum.
 * Wave-14 added `has_question` (parent reflects a task awaiting answer);
 * V56 migration adds the corresponding PG enum value.
 */
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

/**
 * Status carried on the `agent/updated` app event. The event has two emitter
 * lineages: (1) `agentService` + `agentLearningHooks` emit an agent-entity
 * status (`AgentStatusSchema`), and (2) the agentTask flow's `eventMapping`
 * emits a task-status (`SimulationTaskStatusSchema`). The union captures both
 * vocabularies so downstream consumers get exhaustiveness rather than `string`.
 */
export const AgentUpdatedStatusSchema = z.enum([
  // Agent entity statuses (AgentStatusSchema)
  'active',
  'learning',
  'error',
  // Task-level statuses surfaced via agentTask flow transitions
  'queued',
  'running',
  'completed',
  'failed',
  'has_question',
  'stopped',
]);

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

/**
 * Lightweight agent badge for embedding in other entities
 */
export const AgentBadgeSchema = z.object({
  id: z.number(),
  agent_name: z.string(),
  image_url: z.string().nullish(),
});
export type AgentBadgeData = z.infer<typeof AgentBadgeSchema>;

/**
 * Knowledge base document schema
 */
export const KnowledgeEntitySchema = BaseEntitySchema.extend({
  workspace_id: z.number(),
  application_id: z.number().optional(),
  file_name: z.string().min(1),
  file_size: z.coerce.number(),
  file_type: KnowledgeTypeSchema,
  file_url: z.string(),
  source_url: z.string().nullish(), // Original URL for URL-based documents
  source: KnowledgeSourceSchema.default('user').optional(),
  agents: z.array(AgentBadgeSchema).optional(),
});
export type KnowledgeData = z.infer<typeof KnowledgeEntitySchema>;

/**
 * QA verdict entity schemas — LLM evaluator output per (qa_run, qa_test_case).
 * Independent of simulation task status (which keeps raw execution semantics).
 */
export const QAVerdictSchema = z.enum(['passed', 'needs_healing', 'failed']);
export type QAVerdict = z.infer<typeof QAVerdictSchema>;

// ── QA Uxr Response (completion payload for process/refine streams) ──
export const QAProcessResponseSchema = z.object({
  ultimate_goal: z.string(),
  test_cases: z.array(
    z.object({
      test_title: z.string(),
      test_objective: z.string(),
      test_steps: z.array(z.string()),
      expected_outcome: z.string(),
      priority: z.enum(['Low', 'Medium', 'High']),
    }),
  ),
  summary: z.object({
    total_tests: z.number(),
    high_priority: z.number(),
    medium_priority: z.number(),
    low_priority: z.number(),
    estimated_time_minutes: z.number(),
  }),
});

export const TaskDependencySchema = z.object({
  task_id: z.string(),
  condition: z.enum(['pass']).optional(),
});
export type TaskDependency = z.infer<typeof TaskDependencySchema>;

/**
 * A single task within a simulation. Direct simulations have 1 task (the prompt).
 * QA simulations have N tasks (one per test case).
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

export const SimulationEntitySchema = BaseEntitySchema.extend({
  application_id: z.number(),
  agent_id: z.number(),
  job_id: z.string(),
  browser_session_id: z.string().nullish(),
  status: SimulationStatusSchema,
  status_message: z.string().nullish(),
  path: z.string().nullish(),
  instructions: z.string().nullish(),
  pinned: z.boolean().optional(),
  source: z.enum(['direct', 'qa']).optional(),
  agent_name: z.string().nullish(),
  graph_index_id: z.string().nullish(),
  source_metadata: z.record(z.string(), z.unknown()).nullish(),
  tasks: z.array(SimulationTaskEntrySchema).optional(),
  agents: z.array(AgentBadgeSchema).optional(),
  graph_status: GraphStatusSchema.optional(),
  graph_steps_processed: z.number().int().nonnegative().optional(),
  graph_steps_total: z.number().int().nonnegative().optional(),
  graph_error: z.string().nullish(),
  created_by_user_id: z.number().nullish(),
  // Persona selected for this run in the Generate Simulation modal. Nullable
  // for "Generic" runs and for user-study-flow runs (which use
  // persona_reaction.persona_id for many-personas-per-run). See migration V54.
  persona_id: z.number().nullish(),
  // Derived flag: true if any per-task status is `has_question`. The parent
  // `status` itself never holds `has_question` — that's a per-task state. The
  // flag drives the "Question" UI pill on the simulation header.
  has_question: z.boolean().optional(),
});
export type SimulationData = z.infer<typeof SimulationEntitySchema>;

export const AgentEntitySchema = BaseEntitySchema.extend({
  workspace_id: z.number(),
  user_id: z.number().nullish(),
  application_id: z.number(),
  agent_name: z.string(),
  agent_type: AgentTypeSchema,
  agent_voice: AgentVoiceSchema,
  agent_description: z.string().nullish(),
  instructions: z.string().nullish(),
  image_url: z.string().nullish(),
  graph_index_id: z.string().nullish(),
  status: AgentStatusSchema,
  status_message: z.string().nullish(),
  learning_progress: LearningProgressSchema.nullish(),
  learning_started_at: z.coerce.date().nullish(),
  workspace: WorkspaceEntitySchema.optional(),
  user: UserEntitySchema.optional(),
  knowledge: z.array(KnowledgeEntitySchema).optional(),
  simulations: z.array(SimulationEntitySchema).optional(),
  simulation_count: z.number().int().nonnegative().optional(),
  knowledge_count: z.number().int().nonnegative().optional(),
});
export type AgentData = z.infer<typeof AgentEntitySchema>;

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
  agent_id: z.number(),
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
 * QA run derived status — set by `deriveQARunStats` based on aggregated
 * task states. Emitted by the API on `qa-run/updated` events and returned
 * in QA run oRPC payloads.
 *
 * Canonical wire vocabulary; `deriveQARunStats` returns `'running'` directly.
 * `'pending'` is the empty-task initial state.
 */
export const QARunDerivedStatusSchema = z.enum(['pending', 'running', 'completed', 'failed', 'stopped']);
export type QARunDerivedStatus = z.infer<typeof QARunDerivedStatusSchema>;

// ── Activity Log ──

export const ActionLogTypeSchema = z.enum([
  'user_login',
  'url_visit',
  'update_workspace',
  'create_user',
  'update_user',
  'delete_user',
  'create_agent',
  'update_agent',
  'delete_agent',
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

/**
 * Action log metadata schema
 * Captures common metadata fields used across different action log types
 */
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

// ── User Quota ──

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
