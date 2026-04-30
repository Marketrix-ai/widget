/**
 * Marketrix API Schema Definitions
 *
 * This file defines all Zod schemas for the Marketrix API, organized by functional areas
 * to match the route structure. It provides type-safe validation for requests, responses,
 * and internal data structures.
 *
 * Schema Categories (code name → user-facing name):
 * - Base Types: Core enums and common schemas
 * - Authentication: User auth, OAuth, password management
 * - Workspace: Organization and workspace management
 * - User: User account management
 * - Agent: AI agent creation and management
 * - Application: Application management
 * - Knowledge: Knowledge base and document management
 * - Simulation: Simulation runs and results
 * - QA: QA Flows, runs, and test cases
 * - Widget: Widget configuration
 * - Connector: Connector triggers
 * - Chat: AI-powered chat and conversation management
 * - Guide: Guide system
 * - Activity Log: System activity tracking and auditing
 * - App Config: In-app configuration management
 * - Rule: Business rule management
 * - Migration: Database migration and system updates
 */

import { z } from 'zod';

// ============================================================================
// BASE TYPES & ENUMS - Core system enums and common schemas
// ============================================================================

/**
 * Core system enums for plans and statuses
 */
export const UserPlanSchema = z.enum(['free', 'starter', 'growth', 'enterprise']);
export const EntityStatusSchema = z.enum(['created', 'active', 'suspended', 'pending_approval']);
export const WorkspacePackageSchema = z.enum(['free', 'starter', 'growth', 'enterprise']);
export const AgentTypeSchema = z.enum(['human', 'ai']);
export const AgentVoiceSchema = z.enum(['male', 'female']);
export const AgentStatusSchema = z.enum(['active', 'learning', 'error']);
// Learning progress uses nullable boolean:
// - null: callback not yet received
// - true: callback received with success
// - false: callback received with failure
export const LearningProgressSchema = z.object({
  vector_index_created: z.boolean().nullable(),
  graph_index_created: z.boolean().nullable(),
});
export const KnowledgeTypeSchema = z.enum(['document', 'video']);
export const KnowledgeSourceSchema = z.enum(['user', 'research']);
export const QAFlowStatusSchema = z.enum(['pending', 'processing', 'waiting_review', 'completed', 'failed']);
export const QATestStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'failed']);
export const QARunStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'failed', 'stopped']);
export const ChatRoleSchema = z.enum(['user', 'agent']);
export const ChatSourceSchema = z.enum(['widget', 'app']);
export const InstructionTypeSchema = z.enum(['tell', 'show', 'do']);
export const ApplicationTypeSchema = z.enum(['app', 'website']);
export const WidgetTypeSchema = z.enum(['widget']);
export const ConnectorTypeSchema = z.enum(['timer', 'github', 'slack', 'teams', 'jira', 'mcp']);
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

/**
 * Base entity schema with common fields for all database entities
 */
export const BaseEntitySchema = z.object({
  id: z.number().optional(),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
});

/** Convert an Express multipart file to a Web File. */
export function fromMulterFile(f: { buffer: Uint8Array; originalname: string; mimetype: string }): File {
  return new File([new Uint8Array(f.buffer)], f.originalname, { type: f.mimetype });
}

export const FileSchema = z.object({
  file: z.instanceof(File),
  application_id: z.coerce.number().optional(),
});

// ============================================================================
// SHARED HELPERS — Reusable input/output schemas
// ============================================================================

// ── Shared input helpers ──
export const ByIdSchema = z.object({ id: z.coerce.number() });
export const BySlugSchema = z.object({ slug: z.string() });
export const ByAgentIdSchema = z.object({ agent_id: z.coerce.number() });
export const ByWidgetIdSchema = z.object({ widget_id: z.coerce.number() });
export const BySimulationIdSchema = z.object({ simulation_id: z.coerce.number() });
export const ByApplicationIdSchema = z.object({ application_id: z.coerce.number() });
export const ByUserIdSchema = z.object({ user_id: z.coerce.number() });

// ── Shared output helpers ──
export const SuccessSchema = z.object({ success: z.literal(true) });
export const SuccessWithMessageSchema = SuccessSchema.extend({ message: z.string() });

// ── Shared filter fragments ──
export const WorkspaceFilterSchema = z.object({
  workspace_id: z.coerce.number().optional(),
});
export const ApplicationFilterSchema = z.object({
  application_id: z.coerce.number().optional(),
});
export const PaginationSchema = z.object({
  limit: z.coerce.number().optional().default(50),
  offset: z.coerce.number().optional().default(0),
});

// ── List wrappers ──

/** Paginated list for unbounded queries — includes total/limit/offset for pagination */
export const paginatedListOf = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({
    items: z.array(schema),
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
  });

/** Simple list for bounded results (scoped to parent entity) — includes count */
export const listOf = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({
    items: z.array(schema),
    count: z.number(),
  });

// ============================================================================
// ROOT ROUTES SCHEMAS - Basic system endpoints
// ============================================================================

/**
 * Health check response schema
 */
export const HealthResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
  service: z.string(),
  version: z.string(),
  build: z.string(),
});

/**
 * API index response schema
 */
export const IndexResponseSchema = z.object({
  name: z.string(),
  version: z.string(),
  build: z.string(),
  status: z.string(),
  timestamp: z.string(),
});

// ============================================================================
// USER SCHEMAS - User account management and operations
// ============================================================================

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

/**
 * User creation schema
 */
export const UserCreateSchema = UserEntitySchema.partial().extend({
  email: z.string().email(),
  password: z.string(),
});

/**
 * User update schema
 */
export const UserUpdateSchema = UserEntitySchema.partial();

/**
 * Batch user creation schema
 */
export const BatchUserCreateSchema = z.object({
  users: z.array(UserCreateSchema),
});

/**
 * Batch user creation result schema
 */
export const BatchUserCreateResultSchema = z.object({
  users: z.array(UserEntitySchema.partial()),
});

// ============================================================================
// AUTHENTICATION SCHEMAS - User authentication and authorization
// ============================================================================

/**
 * Login schema with authentication token
 */
export const TokenSchema = z.object({
  token: z.string(),
});

// ============================================================================
// WORKSPACE SCHEMAS - Organization and workspace management
// ============================================================================

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
});

/**
 * Workspace creation schema
 */
export const WorkspaceCreateSchema = WorkspaceEntitySchema.partial().extend({
  name: z.string().min(1),
});

/**
 * Workspace update schema
 */
export const WorkspaceUpdateSchema = WorkspaceEntitySchema.partial();

export const WorkspacePlanStatusSchema = z.enum([
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'trialing',
  'incomplete',
  'incomplete_expired',
  'paused',
]);

export type WorkspacePlanStatus = z.infer<typeof WorkspacePlanStatusSchema>;

/**
 * Workspace plan entity schema - tracks plan/subscription for each workspace
 */
export const WorkspacePlanEntitySchema = BaseEntitySchema.extend({
  workspace_id: z.number(),
  package: WorkspacePackageSchema,
  ending_date: z.coerce.date(),
  stripe_subscription_id: z.string().nullable(),
  stripe_price_id: z.string().nullable(),
  status: WorkspacePlanStatusSchema.default('active').optional(),
});

/**
 * Workspace plan creation schema
 */
export const WorkspacePlanCreateSchema = WorkspacePlanEntitySchema.partial().extend({
  workspace_id: z.number(),
  package: WorkspacePackageSchema,
});

/**
 * Workspace plan update schema
 */
export const WorkspacePlanUpdateSchema = WorkspacePlanEntitySchema.partial();

export const WorkspaceMemberRoleSchema = z.enum(['owner', 'member']);

export const WorkspaceMemberEntitySchema = BaseEntitySchema.extend({
  workspace_id: z.number(),
  user_id: z.number(),
  role: WorkspaceMemberRoleSchema,
});

export type WorkspaceMemberData = z.infer<typeof WorkspaceMemberEntitySchema>;
export type WorkspaceMemberRole = z.infer<typeof WorkspaceMemberRoleSchema>;

/**
 * Lightweight agent badge for embedding in other entities
 */
export const AgentBadgeSchema = z.object({
  id: z.number(),
  agent_name: z.string(),
  image_url: z.string().nullish(),
});

export type AgentBadgeData = z.infer<typeof AgentBadgeSchema>;

// ============================================================================
// KNOWLEDGE SCHEMAS - Knowledge base and document management
// ============================================================================

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

// ============================================================================
// QA CROSS-BROWSER SCHEMAS (must be defined before QA schemas)
// ============================================================================

export const BrowserTypeSchema = z.enum(['chromium', 'firefox', 'webkit']);

export const BrowserConfigSchema = z.object({
  browsers: z.array(BrowserTypeSchema).default(['chromium']),
  parallel: z.boolean().default(false),
  fail_fast: z.boolean().default(false),
  timeout_per_browser: z.number().int().min(60).max(3600).optional(),
});

export type BrowserType = z.infer<typeof BrowserTypeSchema>;
export type BrowserConfig = z.infer<typeof BrowserConfigSchema>;

// ============================================================================
// QA DOCUMENT SCHEMAS - QA document and test result management
// ============================================================================

/**
 * QA document entity schema
 */
export const QAFlowEntitySchema = BaseEntitySchema.extend({
  workspace_id: z.number(),
  user_id: z.number(),
  application_id: z.number(),
  file_name: z.string().min(1),
  file_size: z.coerce.number(),
  file_type: z.string(),
  file_url: z.string(),
  file_path: z.string().nullable(),
  text_content: z.string().nullish(),
  additional_instructions: z.string().max(1000).nullish(),
  status: QAFlowStatusSchema,
  processing_step: z.string().nullish(),
  processing_started_at: z.coerce.date().nullish(),
  ultimate_goal: z.string().nullish(),
  browser_config: BrowserConfigSchema.nullish(),
  persona_ids: z.array(z.coerce.number()).optional().default([]),
  pinned: z.boolean().optional().default(false),
});

/**
 * QA document create schema
 */
export const QAFlowCreateSchema = z.object({
  application_id: z.coerce.number(),
  file: z.instanceof(File).optional(),
  text_content: z.string().optional(),
  file_name: z.string().optional(),
  additional_instructions: z.string().max(1000).optional(),
  persona_ids: z.array(z.coerce.number()).optional(),
});

/**
 * QA run entity schema
 */
export const QARunEntitySchema = BaseEntitySchema.extend({
  qa_flow_id: z.number(),
  workspace_id: z.number(),
  triggered_by: z.number(),
  browser_type: BrowserTypeSchema,
  browser_config: BrowserConfigSchema.nullish(),
  simulation_id: z.number().nullish(),
  source: z.enum(['manual', 'automation', 'github_pr', 'slack_command']).nullish(),
  source_metadata: z.record(z.string(), z.unknown()).nullish(),
  auto_heal: z.boolean().default(false),
  auto_accept: z.boolean().default(false),
});

/**
 * JSON entry schemas for qa_test_case embedded arrays
 */
export const QAVersionHistoryEntrySchema = z.object({
  version: z.number().int().positive(),
  test_title: z.string(),
  test_objective: z.string(),
  test_steps: z.array(z.string()),
  expected_outcome: z.string(),
  priority: z.enum(['Low', 'Medium', 'High']),
  change_type: z.enum(['created', 'modified', 'self_healed', 'refined', 'deleted']),
  change_reason: z.string().nullish(),
  changed_by: z.number().nullish(),
  created_at: z.string(),
  accepted: z.boolean().optional(),
});

export const QAHealingAttemptEntrySchema = z.object({
  failure_type: z.enum(['locator', 'assertion', 'timeout', 'flow_change', 'environment']),
  failure_message: z.string().nullish(),
  failure_context: z.record(z.string(), z.unknown()).nullish(),
  repair_strategy: z.string().nullish(),
  repair_details: z.record(z.string(), z.unknown()).nullish(),
  confidence_score: z.number().min(0).max(1).nullish(),
  validation_status: z.enum(['pending', 'validated', 'failed', 'rejected']),
  simulation_id: z.number().nullish(),
  validation_simulation_id: z.number().nullish(),
  healed_version: z.number().nullish(),
  created_at: z.string(),
});

/**
 * QA verdict entity schemas — LLM evaluator output per (qa_run, qa_test_case).
 * Independent of simulation task status (which keeps raw execution semantics).
 */
export const QAVerdictSchema = z.enum(['passed', 'needs_healing', 'failed']);
export type QAVerdict = z.infer<typeof QAVerdictSchema>;

export const QAEvaluationSchema = z.object({
  outcome_reached: z.boolean(),
  steps_aligned: z.boolean(),
  healing_recommended: z.boolean(),
  is_actual_bug: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  evaluated_at: z.string(),
});
export type QAEvaluation = z.infer<typeof QAEvaluationSchema>;

export const QATestVerdictEntitySchema = BaseEntitySchema.extend({
  qa_run_id: z.number(),
  qa_test_case_id: z.number(),
  simulation_task_id: z.string().nullable(),
  verdict: QAVerdictSchema,
  evaluation: QAEvaluationSchema.nullable(),
});
export type QATestVerdictData = z.infer<typeof QATestVerdictEntitySchema>;

/** QA test case entity schema. */
export const QATestCaseEntitySchema = BaseEntitySchema.extend({
  qa_flow_id: z.number(),
  workspace_id: z.number(),
  order_index: z.number().int().nonnegative(),
  test_title: z.string(),
  test_objective: z.string(),
  test_steps: z.array(z.string()),
  expected_outcome: z.string(),
  priority: z.enum(['Low', 'Medium', 'High']),
  is_active: z.preprocess(v => (typeof v === 'number' ? v !== 0 : v), z.boolean()),
  current_version: z.number().int().positive(),
  version_history: z.array(QAVersionHistoryEntrySchema).nullable(),
  healing_attempts: z.array(QAHealingAttemptEntrySchema).nullable(),
  healing_metadata: z.record(z.string(), z.unknown()).nullish(),
  last_healed_at: z.coerce.date().nullish(),
  blocked_by: z
    .array(z.object({ index: z.number().int().nonnegative(), condition: z.enum(['pass']).optional() }))
    .default([]),
});

/**
 * QA test case create schema
 */
export const QATestCaseCreateSchema = z.object({
  qa_flow_id: z.number(),
  test_title: z.string(),
  test_objective: z.string(),
  test_steps: z.array(z.string()),
  expected_outcome: z.string(),
  priority: z.enum(['Low', 'Medium', 'High']).optional(),
});

/**
 * QA document processing response schema
 */
export const QAFlowProcessingResponseSchema = z.object({
  ultimateGoal: z.string(),
  document: QAFlowEntitySchema,
  testCases: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      prompt: z.string(),
      objective: z.string(),
      steps: z.array(z.string()),
      expectedOutcome: z.string(),
      priority: z.enum(['Low', 'Medium', 'High']),
    }),
  ),
  summary: z.object({
    total: z.number(),
    estimatedTime: z.string(),
    complexity: z.enum(['Low', 'Medium', 'High']),
  }),
});

// ── QA Insight Response (completion payload for process/refine streams) ──
export const QAInsightResponseSchema = z.object({
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

// ── SSE stream events for QA processing ──
export const SSEEventSchema = z.discriminatedUnion('event', [
  z.object({ event: z.literal('response.created'), data: z.object({ message: z.string() }) }),
  z.object({ event: z.literal('response.progress'), data: z.object({ message: z.string() }) }),
  z.object({ event: z.literal('response.clear'), data: z.object({}).optional() }),
  z.object({ event: z.literal('response.completed'), data: QAInsightResponseSchema }),
  z.object({ event: z.literal('error'), data: z.object({ detail: z.string() }) }),
]);

// ============================================================================
// QA Test Version & Healing Types (consolidated into qa_test_case JSON columns)
// ============================================================================

/** Value types in QA test case version diffs */
export const DiffValueSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]);

export const QATestVersionChangeTypeSchema = z.enum(['created', 'modified', 'self_healed', 'refined', 'deleted']);
export const QAFailureTypeSchema = z.enum(['locator', 'assertion', 'timeout', 'flow_change', 'environment']);
export const QAValidationStatusSchema = z.enum(['pending', 'validated', 'failed', 'rejected']);

export const QAHealingMetadataSchema = z.object({
  healing_enabled: z.boolean().default(true),
  auto_apply: z.boolean().default(false),
  min_confidence_threshold: z.number().min(0).max(1).default(0.85),
  max_healing_attempts: z.number().int().min(1).max(5).default(2),
  last_healing_attempt: z.string().datetime().nullable(),
  total_healing_attempts: z.number().int().default(0),
  successful_heals: z.number().int().default(0),
});

export const FailureAnalysisSchema = z.object({
  failure_type: QAFailureTypeSchema,
  is_healable: z.boolean(),
  is_actual_bug: z.boolean(),
  failure_message: z.string(),
  failure_context: z.record(z.string(), z.unknown()),
  suggested_repair: z
    .object({
      type: z.enum(['update_locator', 'update_assertion', 'update_steps', 'skip_test']),
      confidence: z.number().min(0).max(1),
      details: z.record(z.string(), z.unknown()),
    })
    .nullable(),
});

export type QATestVersionChangeType = z.infer<typeof QATestVersionChangeTypeSchema>;
export type QAFailureType = z.infer<typeof QAFailureTypeSchema>;
export type QAValidationStatus = z.infer<typeof QAValidationStatusSchema>;
export type QAHealingMetadata = z.infer<typeof QAHealingMetadataSchema>;
export type FailureAnalysis = z.infer<typeof FailureAnalysisSchema>;
export type QAVersionHistoryEntry = z.infer<typeof QAVersionHistoryEntrySchema>;
export type QAHealingAttemptEntry = z.infer<typeof QAHealingAttemptEntrySchema>;

// ============================================================================
// SIMULATION SCHEMAS - Application simulation and testing
// ============================================================================

/**
 * Simulation action schemas
 */
export const GoToUrlActionSchema = z.object({
  go_to_url: z.object({
    url: z.string(),
    new_tab: z.boolean(),
  }),
});

export const ClickElementByIndexActionSchema = z.object({
  click_element_by_index: z.object({
    index: z.number().int().min(1), // Must be >= 1 (data-id value from browser_state)
  }),
});

export const InputTextActionSchema = z.object({
  input_text: z.object({
    index: z.number(),
    text: z.string(),
    clear_existing: z.boolean(),
  }),
});

export const WriteFileActionSchema = z.object({
  write_file: z.object({
    file_name: z.string(),
    content: z.string(),
    append: z.boolean(),
    trailing_newline: z.boolean(),
    leading_newline: z.boolean(),
  }),
});

export const GetOtpActionSchema = z.object({
  get_otp: z.object({
    question: z.string(),
  }),
});

export const DoneActionSchema = z.object({
  done: z.object({
    success: z.boolean(),
    message: z.string().optional(),
  }),
});

export const WaitActionSchema = z.object({
  wait: z.object({
    seconds: z.number(),
  }),
});

export const ReloadPageActionSchema = z.object({
  reload_page: z.object({}),
});

export const OpenNewTabActionSchema = z.object({
  open_new_tab: z.object({
    url: z.string(),
  }),
});

export const NavigateToUrlActionSchema = z.object({
  navigate_to_url: z.object({
    url: z.string(),
  }),
});

/**
 * Schema for simulation actions.
 * Browser-use can emit many action types beyond the ones explicitly defined above,
 * so we accept any single-key object (e.g. { scroll: {...} }, { send_keys: {...} }).
 */
export const SimulationActionSchema = z.record(z.string(), z.unknown());

/**
 * Model output schema for simulation step
 */
export const SimulationModelOutputSchema = z
  .object({
    evaluation_previous_goal: z.string().optional().nullable(),
    memory: z.string().optional().nullable(),
    next_goal: z.string().optional().nullable(),
    action: z.array(SimulationActionSchema).optional().nullable(),
    thinking: z.string().optional().nullable(),
  })
  .passthrough();

/**
 * Result schema for simulation step
 */
export const SimulationResultSchema = z
  .object({
    is_done: z.boolean(),
    success: z.boolean().optional().nullable(),
    long_term_memory: z.string().optional().nullable(),
    extracted_content: z.string().optional().nullable(),
    include_extracted_content_only_once: z.boolean().optional().nullable(),
    include_in_memory: z.boolean().optional().nullable(),
    error: z.string().optional().nullable(),
    metadata: z
      .object({
        click_x: z.number().optional(),
        click_y: z.number().optional(),
        new_tab_opened: z.boolean().optional(),
        input_x: z.number().optional(),
        input_y: z.number().optional(),
      })
      .passthrough()
      .optional()
      .nullable(),
  })
  .passthrough();

/**
 * Browser tab schema (browser-use format)
 */
export const BrowserTabSchema = z
  .object({
    url: z.string(),
    title: z.string(),
    tab_id: z.string().optional(),
    parent_tab_id: z.string().optional().nullable(),
  })
  .passthrough();

/**
 * Interacted element schema (browser-use can emit null attributes/bounds, optional stable_hash/ax_name)
 */
export const InteractedElementSchema = z
  .object({
    node_id: z.number().optional(),
    backend_node_id: z.number().optional(),
    frame_id: z.string().optional().nullable(),
    node_type: z.number().optional(),
    node_value: z.string().optional(),
    node_name: z.string().optional(),
    attributes: z.record(z.string(), z.string()).optional().nullable(),
    x_path: z.string().optional(),
    element_hash: z.number().optional(),
    bounds: z
      .object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      })
      .passthrough()
      .optional()
      .nullable(),
    stable_hash: z.number().optional(),
    ax_name: z.string().optional().nullable(),
  })
  .passthrough();

/**
 * Browser state schema for simulation step (browser-use format)
 */
export const SimulationStateSchema = z
  .object({
    tabs: z.array(BrowserTabSchema),
    screenshot_path: z.string().nullable(),
    interacted_element: z.array(InteractedElementSchema.nullable()),
    url: z.string(),
    title: z.string(),
  })
  .passthrough();

/**
 * Metadata schema for simulation step (browser-use can omit or add step_interval)
 */
export const SimulationStepMetadataSchema = z
  .object({
    step_start_time: z.number().optional().nullable(),
    step_end_time: z.number().optional().nullable(),
    step_number: z.number().optional().nullable(),
    step_interval: z.number().optional().nullable(),
  })
  .passthrough();

/**
 * Individual simulation step schema (browser-use adds state_message, metadata can be null)
 */
export const SimulationStepSchema = z
  .object({
    model_output: SimulationModelOutputSchema.nullable(),
    result: z.array(SimulationResultSchema),
    state: SimulationStateSchema,
    metadata: SimulationStepMetadataSchema.nullable(),
    state_message: z.string().optional().nullable(),
  })
  .passthrough();

/**
 * Complete simulation history schema
 */
export const SimulationHistorySchema = z.object({
  history: z.array(SimulationStepSchema),
});

/**
 * Summary of one simulation step for JSON listing (topic + screenshot link)
 */
export const SimulationStepSummarySchema = z.object({
  step_number: z.number().int().positive(),
  topic: z.string(),
  screenshot_url: z.string().nullable(),
  title: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
});

/**
 * One row in the simulation_progress table.
 */
export const SimulationProgressEntrySchema = z.object({
  status: z.string(),
  status_message: z.string().nullable(),
  task_id: z.string().nullish(),
  created_at: z.coerce.date(),
});
export type SimulationProgressEntry = z.infer<typeof SimulationProgressEntrySchema>;

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
  status: z.enum(['pending', 'in_progress', 'has_question', 'passed', 'failed', 'skipped', 'stopped']),
  error_message: z.string().nullish(),
  started_at: z.string().nullish(),
  completed_at: z.string().nullish(),
  order_index: z.number().int().nonnegative().default(0),
  tab_id: z.string().nullish(),
  step_count: z.number().int().nonnegative().default(0),
  blocked_by: z.array(TaskDependencySchema).default([]),
});
export type SimulationTaskEntry = z.infer<typeof SimulationTaskEntrySchema>;

/**
 * App simulation schema
 */
export const SimulationEntitySchema = BaseEntitySchema.extend({
  application_id: z.number(),
  agent_id: z.number(),
  job_id: z.string(),
  browser_session_id: z.string().nullish(),
  status: z.string(),
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
  mindmap_status: z.string().optional(),
  mindmap_steps_processed: z.number().int().nonnegative().optional(),
  mindmap_steps_total: z.number().int().nonnegative().optional(),
  mindmap_error: z.string().nullish(),
});

/**
 * Simulation logging user - user who has started at least one simulation (for GET /simulation/logging-users)
 */
export const SimulationLoggingUserSchema = z.object({
  user_id: z.number(),
  email: z.string(),
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  last_simulation_at: z.string().optional(), // ISO date of most recent simulation start
});

/**
 * Simulation creation schema
 */
export const SimulationCreateSchema = SimulationEntitySchema.partial().extend({
  application_id: z.number(),
  agent_id: z.number(),
  instructions: z.string(),
  max_steps: z.number().int().positive().max(1000).optional(),
  timeout: z.number().positive().max(360).optional(), // Max 6 hours in minutes
});

/**
 * Simulation update schema
 */
export const SimulationUpdateSchema = z.object({
  job_id: z.string().optional(),
  status: z.string().optional(),
  status_message: z.string().optional(),
  pinned: z.boolean().optional(),
  graph_index_id: z.string().optional(),
});

/**
 * Simulation answer submission schema
 */
export const SimulationAnswerSchema = z.object({
  answer: z.string().min(1),
});

// ============================================================================
// RRWEB SESSION SCHEMAS - RRWeb session recording management
// ============================================================================

/**
 * Complete RRWeb session entity schema
 */
export const SessionEntitySchema = BaseEntitySchema.extend({
  session_id: z.string(),
  chat_id: z.string(),
  application_id: z.coerce.number().nullish(),
  blob_url: z.string().nullable(),
  event_count: z.coerce.number().int().nonnegative(),
  started_at: z.coerce.date(),
  ended_at: z.coerce.date().nullable(),
  is_active: z.preprocess(v => (typeof v === 'number' ? v !== 0 : v), z.boolean()),
  metadata: z
    .object({
      userAgent: z.string().optional(),
      url: z.string().optional(),
      viewport: z.object({ width: z.number(), height: z.number() }).optional(),
    })
    .nullable(),
  last_batch_index: z.coerce.number().int().nullable(),
  last_event_timestamp: z.coerce.number().int().nullable(),
  last_upload_time: z.coerce.date().nullable(),
});

/**
 * RRWeb session upsert schema (for create/update)
 */
export const SessionUpsertSchema = z.object({
  session_id: z.string().min(1),
  chat_id: z.string().min(1),
  application_id: z.number().int().nullish(),
  blob_url: z.string().nullish(),
  event_count: z.number().int().nonnegative().optional(),
  started_at: z.coerce.date().optional(),
  ended_at: z.coerce.date().nullish(),
  is_active: z.preprocess(v => (typeof v === 'number' ? v !== 0 : v), z.boolean()).optional(),
  metadata: z
    .object({
      userAgent: z.string().optional(),
      url: z.string().optional(),
      applicationId: z.number().optional(), // API persists to application_id column; also accepted from metadata
      viewport: z.object({ width: z.number(), height: z.number() }).optional(),
    })
    .nullable()
    .optional(),
  last_batch_index: z.number().int().nonnegative().nullish(),
  last_event_timestamp: z.number().int().nullish(),
  last_upload_time: z.coerce.date().nullish(),
});

/**
 * API response schema for the simulationProgress endpoint.
 * Synthesises id/simulation_id so existing callers keep working.
 */
export const SimulationProgressEntitySchema = z.object({
  id: z.number(),
  simulation_id: z.number(),
  status: z.string(),
  status_message: z.string().nullable(),
  created_at: z.coerce.date(),
});

/**
 * Mindmap edge schema - transition from one node to another via an action
 */
export const MindMapEdgeSchema = z
  .object({
    start: z.string(),
    end: z.string(),
    action: z.string(),
  })
  .passthrough();

/**
 * Mindmap section schema - functional UI section within a page node
 */
export const MindMapSectionSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    purpose: z.string(),
    elements: z.array(z.record(z.string(), z.unknown())).default([]),
    bbox: z.record(z.string(), z.unknown()).default({}),
    screenshot: z.string().default(''),
    embedding: z.array(z.number()).nullish(),
  })
  .passthrough();

/**
 * Mindmap node schema - unique page state observed during simulation.
 * Matches agent's PageNode model (perception/graph.py).
 * Uses passthrough() because Cosmos DB adds metadata fields and the agent
 * model may evolve faster than the schema.
 */
export const MindMapNodeSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    url: z.string(),
    summary: z.string().default(''),
    screenshot: z.string().default(''),
    sections: z.array(MindMapSectionSchema).default([]),
    sequence_ids: z.array(z.number()).default([]),
    embedding: z.array(z.number()).nullish(),
  })
  .passthrough();

/**
 * Mindmap schema - knowledge graph showing nodes and edges from simulation
 */
export const MindMapSchema = z.object({
  nodes: z.array(MindMapNodeSchema),
  edges: z.array(MindMapEdgeSchema),
});

// ============================================================================
// AGENT SCHEMAS - AI agent creation and management
// ============================================================================

/**
 * Complete agent entity schema
 */
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
  vector_store_id: z.string().nullish(),
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

const parseIds = (val: unknown): number[] => {
  if (Array.isArray(val)) return val.map(v => Number(v));
  if (typeof val === 'string') {
    const parsed: unknown = JSON.parse(val);
    return Array.isArray(parsed) ? (parsed as unknown[]).map(v => Number(v)) : [];
  }
  return [];
};

const KnowledgeIdsSchema = z.union([z.array(z.number()), z.string()]).transform(parseIds);
const SimulationIdsSchema = z.union([z.array(z.number()), z.string()]).transform(parseIds);

/**
 * Agent creation schema
 */
export const AgentCreateSchema = AgentEntitySchema.partial().extend({
  application_id: z.coerce.number(),
  agent_name: z.string(),
  agent_type: AgentTypeSchema,
  agent_voice: AgentVoiceSchema,
  agent_description: z.string(),
  instructions: z.string(),
  file: z.instanceof(File).optional(),
  image_url: z.string().optional(),
  knowledge_ids: KnowledgeIdsSchema,
  simulation_ids: SimulationIdsSchema,
});

/**
 * Agent update schema
 */
export const AgentUpdateSchema = AgentEntitySchema.partial().extend({
  file: z.instanceof(File).optional(),
  knowledge_ids: KnowledgeIdsSchema,
  simulation_ids: SimulationIdsSchema,
});

/**
 * Agent task start response schema
 * Response from agent server when starting a task
 */
export const AgentTaskStartResponseSchema = z.object({
  text: z.string(),
  task_id: z.string().optional(),
});

/**
 * Agent task stop response schema
 * Response from agent server when stopping a task
 */
export const AgentTaskStopResponseSchema = z.object({
  status: z.string(),
  message: z.string().optional(),
});

/**
 * Agent task status response schema
 * Response from agent server for task status queries
 */
export const AgentTaskStatusResponseSchema = z.object({
  task_id: z.string().optional(),
  status: z.string().optional(),
  current_step: z.string().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

/**
 * Simulation status response schema
 * Response for simulation status queries from agent server
 */
export const SimulationStatusResponseSchema = z.object({
  workflow_id: z.string(),
  workflow_type: z.string(),
  status: z.string(),
  current_step: z.string(),
  error: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

/**
 * Browser session response schema
 * Response for browser session operations from agent server
 */
export const BrowserSessionResponseSchema = z.object({
  browser_session_id: z.string().optional(),
  live_view_url: z.string().nullish(),
  status: z.string().optional(),
  message: z.string().nullish(),
  success: z.boolean().optional(),
});

/**
 * Task status enum schema
 * Common status values for tasks and simulations
 */
export const TaskStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'failed', 'stopped', 'has_question']);

/**
 * Agent knowledge search configuration schema
 */
export const AgentSearchConfigSchema = z.object({
  contentType: z.enum(['document', 'video', 'automation_log', 'screenshot', 'all']).optional(),
  context: z.string().optional(),
  previousActions: z.array(z.string()).optional(),
  top: z.coerce.number().min(1).max(100).optional(),
  minConfidence: z.coerce.number().min(0).max(1).optional(),
  entities: z.array(z.string()).optional(),
  useVectorSearch: z.boolean().optional(),
  vectorThreshold: z.coerce.number().min(0).max(1).optional(),
});

/**
 * Search document schema (matches Azure Search document structure)
 */
export const SearchDocumentSchema = z.object({
  id: z.string(),
  content: z.string(),
  contentType: z.enum(['document', 'video', 'automation_log', 'screenshot']),
  sourceFile: z.string(),
  sourceType: z.string(),
  metadata: z.string(), // JSON stringified
  confidence: z.number(),
  keyPhrases: z.array(z.string()),
  entities: z.array(z.string()), // Format: "text:category:confidence"
  sentiment: z.string(), // JSON stringified
  vectorContent: z.array(z.number()),
});

/**
 * Search result schema (Azure Search result wrapper)
 */
export const SearchResultSchema = z.object({
  document: SearchDocumentSchema,
  score: z.number(),
  highlights: z.record(z.string(), z.array(z.string())).optional(),
});

/**
 * Agent simulation index request schema
 */
export const AgentSimulationIndexRequestSchema = z.object({
  simulation_id: z.coerce.number().positive('Simulation ID must be a positive number'),
});

/**
 * Agent simulation index response schema
 */
export const AgentSimulationIndexResponseSchema = z.object({
  agent: AgentEntitySchema,
  simulation_id: z.number(),
  knowledge_id: z.number(),
  message: z.string(),
});

// ============================================================================
// APPLICATION SCHEMAS - Application management (apps and websites)
// ============================================================================

/**
 * Application entity schema
 */
export const ApplicationEntitySchema = BaseEntitySchema.extend({
  workspace_id: z.number(),
  name: z.string(),
  type: ApplicationTypeSchema,
  url: z.string().nullish(),
  username: z.string().nullish(),
  password: z.string().nullish(),
  allowed_domains: z.array(z.string()).nullish().default([]),
});

/**
 * Application creation schema
 */
export const ApplicationCreateSchema = ApplicationEntitySchema.partial().extend({
  type: ApplicationTypeSchema,
  name: z.string().min(1),
  url: z.string(),
  allowed_domains: z.array(z.string()).optional().default([]),
});

/**
 * Application update schema
 */
export const ApplicationUpdateSchema = ApplicationEntitySchema.partial().omit({ workspace_id: true });

// ============================================================================
// WIDGET SCHEMAS - Widget management (widget, slack, etc.)
// ============================================================================

/**
 * Zod schema for widget chips
 */
export const WidgetChipSchema = z.object({
  chip_mode: z.enum(['show', 'tell', 'do']),
  chip_text: z.string(),
});

/**
 * Zod schema for widget settings
 */
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

/**
 * Slack widget settings schema (example for future use)
 */
export const SlackSettingsDataSchema = z.object({
  webhook_url: z.string().url(),
  channel: z.string(),
  bot_token: z.string(),
  notifications_enabled: z.boolean(),
});

/**
 * Widget entity schema
 */
export const WidgetEntitySchema = BaseEntitySchema.extend({
  application_id: z.number(),
  agent_id: z.number(),
  type: WidgetTypeSchema,
  settings: z.union([WidgetSettingsDataSchema, SlackSettingsDataSchema]),
  status: EntityStatusSchema,
  marketrix_id: z.string(),
  marketrix_key: z.string(),
  snippet: z.string().nullish(),
});

/**
 * Widget information schema
 */
export const WidgetInfoSchema = WidgetEntitySchema.extend({
  application: ApplicationEntitySchema.partial(),
  workspace: WorkspaceEntitySchema.partial(),
  user: UserEntitySchema.partial(),
  agent: AgentEntitySchema.partial(),
});

/**
 * Widget search result schema - includes optional eager-loaded agent
 */
export const WidgetWithAgentSchema = WidgetEntitySchema.extend({
  agent: AgentEntitySchema.partial().optional(),
});

/**
 * Application with widgets schema - matches API response structure
 */
export const ApplicationWithWidgetsSchema = ApplicationEntitySchema.extend({
  widgets: z.array(WidgetEntitySchema).optional(),
  agents: z.array(AgentEntitySchema).optional(),
});

/**
 * Widget creation schema
 */
export const WidgetCreateSchema = WidgetEntitySchema.partial().extend({
  application_id: z.number().positive(),
  agent_id: z.number().positive(),
  type: WidgetTypeSchema,
  settings: z.union([WidgetSettingsDataSchema, SlackSettingsDataSchema]).optional(),
});

/**
 * Widget update schema
 */
export const WidgetUpdateSchema = WidgetEntitySchema.partial();

// ============================================================================
// URL GUIDE SCHEMAS - URL-based guidance messages for widget
// ============================================================================

/**
 * URL Guide entity schema - stores URL patterns and messages to show in widget
 * message can be a string (single message) or array of strings (multiple chips)
 */
export const UrlGuideEntitySchema = BaseEntitySchema.extend({
  widget_id: z.number(),
  url_pattern: z.string(),
  message: z.union([z.string(), z.array(z.string())]), // Support both single message and multiple messages
  description: z.string().optional(),
});

/**
 * URL Guide creation schema
 */
export const UrlGuideCreateSchema = UrlGuideEntitySchema.partial().extend({
  widget_id: z.number().positive(),
  url_pattern: z.string().min(1),
  message: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]), // Support both single message and multiple messages
});

/**
 * URL Guide update schema
 */
export const UrlGuideUpdateSchema = UrlGuideEntitySchema.partial();

// ============================================================================
// CHAT SCHEMAS - AI-powered chat and conversation management
// ============================================================================

/**
 * Chat request schema
 * Requires either: marketrix_id + marketrix_key OR agent_id + application_id
 */
export const ChatRequestSchema = z
  .object({
    marketrix_id: z.string().optional(),
    marketrix_key: z.string().optional(),
    agent_id: z.number().positive().optional(),
    application_id: z.number().positive().optional(),
    chat_id: z.string().optional(), // Optional since it comes from path params in some routes
    content: z.string(),
  })
  .refine(data => (data.marketrix_id && data.marketrix_key) ?? (data.agent_id && data.application_id), {
    message: 'Either marketrix_id + marketrix_key or both agent_id + application_id must be provided',
  });

/**
 * Chat response entity schema
 */
export const ChatResponseSchema = z.object({
  text: z.string(),
  task_id: z.string().optional(),
});

// ============================================================================
// WIDGET STREAM SCHEMAS - Typed events and commands for widget communication
// ============================================================================

/** Server → Widget event (discriminated union on `type`) */
export const WidgetEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('registered'), chat_id: z.string(), application_id: z.number().optional() }),
  z.object({ type: z.literal('pong') }),
  z.object({ type: z.literal('heartbeat') }),
  z.object({
    type: z.literal('chat/response'),
    request_id: z.string(),
    text: z.string(),
    task_id: z.string().optional(),
  }),
  z.object({
    type: z.literal('chat/error'),
    request_id: z.string(),
    error: z.string(),
  }),
  z.object({
    type: z.literal('task/status'),
    status: z.enum(['started', 'completed', 'failed', 'stopped', 'in_progress', 'has_question']),
    message: z.string().optional(),
    task_id: z.string().optional(),
    timestamp: z.number().optional(),
  }),
  z.object({
    type: z.literal('tool/call'),
    call_id: z.string(),
    tool: z.string(),
    args: z.record(z.string(), z.unknown()),
    mode: z.enum(['show', 'do']).optional(),
    explanation: z.string().optional(),
    state_version: z.number().optional(),
  }),
]);

/** Widget → Server command (discriminated union on `type`) */
export const WidgetCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('chat/tell'), request_id: z.string(), content: z.string() }),
  z.object({ type: z.literal('chat/show'), request_id: z.string(), content: z.string() }),
  z.object({ type: z.literal('chat/do'), request_id: z.string(), content: z.string() }),
  z.object({ type: z.literal('chat/stop'), task_id: z.string().optional() }),
  z.object({
    type: z.literal('tool/response'),
    call_id: z.string(),
    success: z.boolean(),
    data: z.string().optional(),
    error: z.string().optional(),
    state_version: z.number().optional(),
  }),
  z.object({ type: z.literal('ping') }),
  z.object({
    type: z.literal('rrweb/metadata'),
    session_id: z.string(),
    chat_id: z.string(),
    application_id: z.number(),
    url: z.string().optional(),
    user_agent: z.string().optional(),
    timestamp: z.number().optional(),
    viewport: z
      .object({
        width: z.number(),
        height: z.number(),
      })
      .optional(),
  }),
  z.object({
    type: z.literal('rrweb/events'),
    session_id: z.string(),
    events: z.array(z.unknown()),
  }),
]);

export type WidgetEvent = z.infer<typeof WidgetEventSchema>;
export type WidgetCommand = z.infer<typeof WidgetCommandSchema>;

// ============================================================================
// APP EVENTS - Real-time event stream for the dashboard app
// ============================================================================

export const AppEventScopeSchema = z.enum(['simulations', 'agents', 'qa', 'user', 'jobs', 'triggers', 'automations']);

export const AppEventSchema = z.discriminatedUnion('type', [
  // Simulation events
  z.object({
    type: z.literal('simulation/updated'),
    simulation_id: z.number(),
    application_id: z.number(),
    status: z.string(),
    step_label: z.string().optional(),
    step_pending: z.boolean().optional(),
    task_id: z.string().nullish(),
  }),
  z.object({
    type: z.literal('simulation/created'),
    simulation_id: z.number(),
    application_id: z.number(),
  }),
  z.object({
    type: z.literal('simulation/deleted'),
    simulation_id: z.number(),
    application_id: z.number(),
  }),

  // Flow-driven simulation lifecycle events
  z.object({
    type: z.literal('simulation/queued'),
    simulation_id: z.number(),
    job_id: z.string(),
  }),
  z.object({
    type: z.literal('simulation/started'),
    simulation_id: z.number(),
    job_id: z.string(),
  }),
  z.object({
    type: z.literal('simulation/step'),
    simulation_id: z.number(),
    job_id: z.string(),
    step_count: z.number().optional(),
    message: z.string().optional(),
  }),
  z.object({
    type: z.literal('simulation/question'),
    simulation_id: z.number(),
    job_id: z.string(),
    question: z.string().optional(),
  }),
  z.object({
    type: z.literal('simulation/completed'),
    simulation_id: z.number(),
    job_id: z.string(),
    step_count: z.number().optional(),
  }),
  z.object({
    type: z.literal('simulation/failed'),
    simulation_id: z.number(),
    job_id: z.string(),
    error: z.string().optional(),
  }),
  z.object({
    type: z.literal('simulation/stopped'),
    simulation_id: z.number(),
    job_id: z.string(),
  }),

  // Mindmap generation progress
  z.object({
    type: z.literal('simulation/mindmap-updated'),
    simulation_id: z.number(),
    application_id: z.number(),
    mindmap_status: z.string(),
    steps_processed: z.number(),
    steps_total: z.number(),
  }),

  // Flow-driven qa-run terminal event
  z.object({
    type: z.literal('qa-run/completed'),
    run_id: z.number(),
    status: z.string(),
  }),

  // Agent events
  z.object({
    type: z.literal('agent/updated'),
    agent_id: z.number().optional(),
    context_id: z.string().optional(),
    task_id: z.string().optional(),
    application_id: z.number().optional(),
    status: z.string(),
  }),
  z.object({
    type: z.literal('agent/created'),
    agent_id: z.number(),
    application_id: z.number(),
  }),
  z.object({
    type: z.literal('agent/deleted'),
    agent_id: z.number(),
    application_id: z.number(),
  }),

  // QA events
  z.object({
    type: z.literal('qa-document/updated'),
    document_id: z.number(),
    application_id: z.number(),
    status: z.string(),
    step_label: z.string().optional(),
  }),
  z.object({
    type: z.literal('qa-run/updated'),
    run_id: z.number(),
    document_id: z.number(),
    application_id: z.number(),
    status: z.string(),
    simulation_id: z.number().optional(),
  }),
  z.object({
    type: z.literal('qa-test/updated'),
    test_id: z.number(),
    run_id: z.number(),
    document_id: z.number(),
    application_id: z.number(),
    status: z.string(),
  }),

  // User events
  z.object({
    type: z.literal('user/updated'),
    user_id: z.number(),
    workspace_id: z.number(),
    status: z.string(),
  }),

  // Job lifecycle events (for long-running dashboard operations)
  z.object({
    type: z.literal('job/progress'),
    job_id: z.string(),
    application_id: z.number(),
    status: z.string(),
    message: z.string().optional(),
    // Phase 4: sub-phase indicator for chained jobs (e.g. research -> segments -> personas).
    phase: z.enum(['research', 'segments', 'personas']).optional(),
  }),
  z.object({
    type: z.literal('job/completed'),
    job_id: z.string(),
    application_id: z.number(),
    result: z.unknown().optional(),
  }),
  z.object({
    type: z.literal('job/failed'),
    job_id: z.string(),
    application_id: z.number(),
    error: z.string(),
  }),

  // Trigger events
  z.object({
    type: z.literal('trigger/fired'),
    trigger_id: z.number(),
    workspace_id: z.number(),
    provider: z.string(),
    name: z.string(),
    payload: z.unknown().optional(),
    timestamp: z.string(),
  }),

  // Automation run events
  z.object({
    type: z.literal('automation-run/completed'),
    automation_id: z.number(),
    run_id: z.number(),
    status: z.literal('completed'),
  }),
  z.object({
    type: z.literal('automation-run/failed'),
    automation_id: z.number(),
    run_id: z.number(),
    status: z.literal('failed'),
    error: z.string().optional(),
  }),

  // Reaction simulation events
  z.object({
    type: z.literal('reaction/completed'),
    reaction_id: z.number(),
    run_id: z.number(),
    application_id: z.number(),
  }),
  z.object({
    type: z.literal('reaction/failed'),
    reaction_id: z.number(),
    run_id: z.number(),
    application_id: z.number(),
    error: z.string().optional(),
  }),
  z.object({
    type: z.literal('reaction/progress'),
    reaction_id: z.number(),
    run_id: z.number(),
    application_id: z.number(),
    result_id: z.number(),
    persona_id: z.number().nullable(),
    completed_personas: z.number(),
    total_personas: z.number(),
    failed_personas: z.number(),
  }),
]);

export type AppEvent = z.infer<typeof AppEventSchema>;
export type AppEventScope = z.infer<typeof AppEventScopeSchema>;

// ============================================================================
// ACTIVITY LOG SCHEMAS - System activity tracking and auditing
// ============================================================================

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

/**
 * Action log entity schema
 */
export const ActionLogEntitySchema = BaseEntitySchema.extend({
  workspace_id: z.number(),
  user_id: z.number(),
  type: ActionLogTypeSchema,
  metadata: ActionLogMetadataSchema.optional(),
});

/**
 * Action log creation schema
 */
export const ActionLogCreateSchema = ActionLogEntitySchema.partial().extend({
  type: ActionLogTypeSchema,
});

// ============================================================================
// CHAT / CONVERSATION SCHEMAS - AI-powered chat and conversation management
// ============================================================================

export const ConversationTypeSchema = z.enum(['widget_chat', 'app_chat', 'guide_preview', 'slack']);
export const ConversationMessageRoleSchema = z.enum(['user', 'agent', 'assistant', 'system', 'tool']);

export const ConversationEntitySchema = BaseEntitySchema.extend({
  context_id: z.string(),
  workspace_id: z.number(),
  application_id: z.number().nullish(),
  agent_id: z.number().nullish(),
  user_id: z.number().nullish(),
  simulation_id: z.number().nullish(),
  session_id: z.number().nullish(),
  persona_id: z.number().nullish(),
  type: ConversationTypeSchema,
  channel_id: z.string().nullish(),
  preview_video_url: z.string().nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});

export const ConversationMessageEntitySchema = BaseEntitySchema.extend({
  conversation_id: z.number(),
  role: ConversationMessageRoleSchema,
  content: z.string(),
  tool_call_id: z.string().nullish(),
});

// ============================================================================
// CONNECTOR SCHEMAS - External service connectors for automations
// ============================================================================

/**
 * Connector entity schema (per-workspace provider credentials/endpoints)
 */
export const ConnectorEntitySchema = BaseEntitySchema.extend({
  workspace_id: z.number(),
  application_id: z.number().nullish(),
  provider: ConnectorTypeSchema,
  name: z.string().min(1).max(120),
  identifier: z.string().max(120).nullish(),
  api_endpoint: z.string().url().nullish(),
  api_token: z.string().nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
  is_active: z.boolean().default(true),
  status: EntityStatusSchema.default('active'),
});

/**
 * Upsert payload for connector
 */
export const ConnectorUpsertSchema = z.object({
  id: z.coerce.number().optional(),
  application_id: z.number().nullish(),
  provider: ConnectorTypeSchema,
  name: z.string().min(1).max(120),
  identifier: z.string().max(120).nullish(),
  api_endpoint: z.string().url().nullish(),
  api_token: z.string().nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
  is_active: z.boolean().optional(),
  status: EntityStatusSchema.optional(),
});

/**
 * Search payload for connectors
 */
export const ConnectorSearchSchema = z.object({
  application_id: z.number().nullish(),
  provider: ConnectorTypeSchema.optional(),
  status: EntityStatusSchema.optional(),
  is_active: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

/**
 * MCP activation status — subset of connector fields exposed to the dashboard
 */
export const McpStatusSchema = z.object({
  id: z.number(),
  application_id: z.number(),
  identifier: z.string(),
  api_token: z.string(),
  is_active: z.boolean(),
  created_at: z.coerce.date().optional(),
});

export const McpToolSchema = z.object({
  name: z.string(),
  category: z.string(),
  description: z.string(),
  inputSchema: z.record(z.string(), z.unknown()),
  enabled: z.boolean(),
});

/** GitHub repo item (from GitHub API user/repos) */
export const GithubRepoSchema = z.object({
  id: z.number(),
  full_name: z.string(),
  name: z.string(),
  private: z.boolean(),
  html_url: z.string(),
  default_branch: z.string().optional(),
});

/** GitHub Actions workflow run (from repos/.../actions/runs) */
export const GithubWorkflowRunSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: z.string(),
  conclusion: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  html_url: z.string(),
  head_branch: z.string(),
  run_attempt: z.number(),
});

// ============================================================================
// AUTOMATION SCHEMAS - DAG-based workflow engine
// ============================================================================

export const AutomationRunStatusSchema = z.enum(['pending', 'running', 'completed', 'failed', 'stopped']);

export const AutomationNodeKindSchema = z.enum(['connector', 'condition']);

const ConnectorNodeSchema = z.object({
  kind: z.literal('connector'),
  connector_type: z.string().min(1),
  connector_id: z.number().nullable().optional(),
  connection_id: z.number().nullable().optional(),
  trigger_id: z.number().nullable().optional(),
  action_id: z.number().nullable().optional(),
  capability: z.string().min(1),
  role: z.enum(['trigger', 'callback']),
  config: z.record(z.string(), z.unknown()).default({}),
});

const ConditionNodeSchema = z.object({
  kind: z.literal('condition'),
  config: z.object({
    field: z.string().min(1),
    operator: z.enum(['equals', 'not_equals', 'contains', 'gt', 'lt']),
    value: z.unknown(),
  }),
});

export const AutomationNodeSchema = z.discriminatedUnion('kind', [ConnectorNodeSchema, ConditionNodeSchema]);

export const AutomationEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  when: z.enum(['true', 'false']).optional(),
});

export const AutomationGraphSchema = z.object({
  nodes: z.record(z.string(), AutomationNodeSchema),
  edges: z.array(AutomationEdgeSchema),
});

export const AutomationConcurrencySchema = z.enum(['skip', 'queue', 'replace']).default('skip');

export const AutomationEntitySchema = BaseEntitySchema.extend({
  workspace_id: z.number(),
  created_by_user_id: z.number().nullable(),
  name: z.string(),
  graph: AutomationGraphSchema,
  concurrency: AutomationConcurrencySchema,
  enabled: z.boolean(),
  last_run_at: z.coerce.date().nullable(),
  next_run_at: z.coerce.date().nullable(),
});

export const AutomationCreateSchema = z.object({
  name: z.string().min(1).max(255),
  graph: AutomationGraphSchema,
  concurrency: AutomationConcurrencySchema.optional(),
  enabled: z.boolean().optional(),
});

export const AutomationUpdateSchema = z.object({
  id: z.coerce.number(),
  name: z.string().min(1).max(255).optional(),
  graph: AutomationGraphSchema.optional(),
  enabled: z.boolean().optional(),
});

export const AutomationSearchSchema = z.object({
  enabled: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

export const AutomationNodeResultSchema = z.object({
  status: z.enum(['in_progress', 'completed', 'failed', 'skipped', 'stopped']),
  output: z.record(z.string(), z.unknown()).nullable().optional(),
  error: z.string().nullable().optional(),
  duration_ms: z.number().optional(),
});

export const AutomationRunEntitySchema = z.object({
  id: z.number().optional(),
  automation_id: z.number(),
  status: AutomationRunStatusSchema,
  trigger_node_id: z.string(),
  trigger_data: z.record(z.string(), z.unknown()).nullable(),
  node_results: z.record(z.string(), AutomationNodeResultSchema),
  started_at: z.coerce.date(),
  completed_at: z.coerce.date().nullable(),
});

export const AutomationRunSearchSchema = z.object({
  status: AutomationRunStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

export const ConnectorCapabilitySchema = z.object({
  connector_type: z.string(),
  built_in: z.boolean(),
  triggers: z.array(
    z.object({
      capability: z.string(),
      description: z.string(),
      config_schema: z.record(z.string(), z.unknown()),
    }),
  ),
  callbacks: z.array(
    z.object({
      capability: z.string(),
      description: z.string(),
      config_schema: z.record(z.string(), z.unknown()),
    }),
  ),
});

// ============================================================================
// GITHUB PR AUTOMATION — Schemas for PR-triggered QA workflows
// ============================================================================

export const GithubPRFileItemSchema = z.object({
  filename: z.string(),
  status: z.string(),
  additions: z.number(),
  deletions: z.number(),
  patch: z.string().optional(),
});

export const GithubPRTriggerDataSchema = z.object({
  event: z.string(),
  action: z.string(),
  pull_request: z.object({
    number: z.number(),
    title: z.string(),
    html_url: z.string(),
    head: z.object({ sha: z.string(), ref: z.string() }),
    base: z.object({ ref: z.string() }),
  }),
  repository: z.object({
    full_name: z.string(),
    name: z.string(),
    owner: z.object({ login: z.string() }),
  }),
  sender: z.object({ login: z.string() }),
  files: z.array(GithubPRFileItemSchema).optional(),
});

export const GithubCheckRunInputSchema = z.object({
  name: z.string(),
  head_sha: z.string(),
  status: z.enum(['queued', 'in_progress', 'completed']).optional(),
  conclusion: z.enum(['success', 'failure', 'neutral', 'cancelled', 'timed_out', 'action_required']).optional(),
  started_at: z.string().optional(),
  completed_at: z.string().optional(),
  output: z
    .object({
      title: z.string(),
      summary: z.string(),
      text: z.string().optional(),
    })
    .optional(),
});

// ============================================================================
// MIGRATION SCHEMAS - Database migration and system updates
// ============================================================================

/**
 * Migration prepare schema
 */
export const MigrationPrepareSchema = z.object({
  migration_type: z.string().optional(),
  dry_run: z.boolean().default(true),
});

/**
 * Migration run schema
 */
export const MigrationRunSchema = z.object({
  migration_type: z.string().optional(),
  backup: z.boolean().default(true),
});

// ============================================================================
// FILE UPLOAD RESPONSE SCHEMAS - File upload and media handling
// ============================================================================

/**
 * File upload response schema
 */
export const FileUploadResponseSchema = z.object({
  url: z.string(),
});

// ============================================================================
// SERVICE SCHEMAS - Internal service communication and data transfer
// ============================================================================

/**
 * Upload user logo data schema
 */
export const UploadUserLogoDataSchema = z.object({
  user_id: z.number(),
  file: z.instanceof(File),
});

/**
 * User prompt data schema for chat/playground prompts
 */
export const UserPromptDataSchema = z.object({
  user_id: z.number(),
  application_id: z.number(),
  source: ChatSourceSchema,
  prompt: z.string(),
  status: z.string(),
});

/**
 * User quota response schema (for SDK chat endpoints)
 */
export const UserQuotaSchema = z.object({
  user_id: z.number(),
  limit: z.number(),
  used: z.number(),
  remaining: z.number(),
});

/**
 * Update chat count data schema
 */
export const UpdateChatCountDataSchema = z.object({
  user_id: z.number(),
  workspace_id: z.number(),
  chat_count: z.number(),
  prompt_text: z.string(),
  metadata: z.record(z.string(), z.string()).optional(),
});

/**
 * AI agent status email data schema
 */

/**
 * Mail options data schema
 */
export const MailOptionsDataSchema = z.object({
  to: z.string(),
  subject: z.string(),
  template: z.string(),
  context: z.record(z.string(), z.string()),
});

// ============================================================================
// CONSTANTS - System-wide constants and configuration values
// ============================================================================

/**
 * Initial prompt limit for new users
 */
export const INITIAL_PROMPT_LIMIT = 50;

// ============================================================================
// STRIPE SCHEMAS - Stripe subscription and payment management
// ============================================================================

/**
 * Stripe webhook event schema
 * Matches the structure of Stripe.Event from the Stripe SDK
 */
export const StripeWebhookEventSchema = z.object({
  id: z.string(),
  object: z.literal('event'),
  api_version: z.string().nullish(),
  created: z.number(),
  data: z.object({
    object: z.record(z.string(), z.unknown()), // The actual event object varies by event type
    previous_attributes: z.record(z.string(), z.unknown()).optional(),
  }),
  livemode: z.boolean(),
  pending_webhooks: z.number(),
  request: z
    .object({
      id: z.string().nullable(),
      idempotency_key: z.string().nullable(),
    })
    .nullable()
    .optional(),
  type: z.string(), // Event type (e.g., 'customer.subscription.created')
});

/**
 * Stripe checkout session creation request schema
 */
export const StripeCheckoutSchema = z.object({
  priceId: z.string().min(1, 'Price ID is required'),
  successUrl: z.string().url('Success URL must be a valid URL'),
  cancelUrl: z.string().url('Cancel URL must be a valid URL'),
});

/**
 * Stripe customer portal session creation request schema
 */
export const StripePortalSchema = z.object({
  returnUrl: z.string().url('Return URL must be a valid URL'),
});

/**
 * Stripe trial subscription creation request schema
 */
export const StripeTrialSchema = z.object({
  plan: z.enum(['starter', 'growth']).default('starter'),
  interval: z.enum(['month', 'year']).default('month'),
});

/**
 * Stripe downgrade confirmation request schema
 */
export const StripeDowngradeSchema = z.object({
  subscriptionId: z.string().min(1, 'Subscription ID is required'),
  priceId: z.string().min(1, 'Price ID is required'),
});

/**
 * Stripe downgrade response schema
 */
export const StripeDowngradeResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

/**
 * Plan information response schema
 */
export const PlanInfoSchema = z.object({
  subscriptionId: z.string().nullable(),
  customerId: z.string().nullable(),
  status: z
    .enum(['active', 'past_due', 'canceled', 'unpaid', 'trialing', 'incomplete', 'incomplete_expired', 'paused'])
    .nullable(),
  planTier: z.enum(['free', 'starter', 'growth', 'enterprise']).nullable(),
  billingInterval: z.enum(['month', 'year']).nullable(),
  priceId: z.string().nullable(),
  trialEndDate: z.coerce.date().nullable(),
  currentPeriodStart: z.coerce.date().nullable(),
  currentPeriodEnd: z.coerce.date().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  isTrialing: z.boolean(),
  daysRemainingInTrial: z.number().nullable(),
  trialProvisioned: z.boolean(),
});

/**
 * Checkout session response schema
 */
export const CheckoutSessionSchema = z.object({
  sessionId: z.string(),
  url: z.string().url(),
});

/**
 * Portal session response schema
 */
export const PortalSessionSchema = z.object({
  url: z.string().url(),
});

/**
 * Trial subscription response schema
 */
export const TrialSubscriptionSchema = z.object({
  subscriptionId: z.string(),
  customerId: z.string(),
  status: z.literal('trialing'),
  trialStartDate: z.coerce.date(),
  trialEndDate: z.coerce.date(),
  planTier: z.enum(['starter', 'growth']),
  daysRemainingInTrial: z.number(),
});

/**
 * Usage metric schema for individual resource
 */
export const UsageMetricSchema = z.object({
  used: z.number().int().min(0),
  limit: z.number().int(),
});

/**
 * Subscription usage statistics schema (workspace-wide resource tracking)
 * Used for billing and subscription management
 */
export const SubscriptionUsageSchema = z.object({
  applications: UsageMetricSchema,
  simulationsPerMonth: UsageMetricSchema,
  userPrompts: UsageMetricSchema,
});

/**
 * Price amount schema for individual pricing
 */
export const PriceAmountSchema = z.object({
  amount: z.number().int().min(0),
  currency: z.string().default('usd'),
  formatted: z.string(),
});

/**
 * Plan pricing schema for a specific plan tier
 */
export const PlanPricingSchema = z.object({
  planId: z.enum(['free', 'starter', 'growth', 'enterprise']),
  monthly: PriceAmountSchema.nullable(),
  annual: PriceAmountSchema.nullable(),
  priceIds: z.object({
    monthly: z.string().nullable(),
    annual: z.string().nullable(),
  }),
});

/**
 * Stripe pricing response schema
 */
export const StripePricingSchema = z.object({
  plans: z.array(PlanPricingSchema),
  lastUpdated: z.string().datetime(),
});

/**
 * Plan catalog entry schema (metadata for display)
 */
export const PlanCatalogEntrySchema = z.object({
  id: z.enum(['free', 'starter', 'growth', 'enterprise']),
  name: z.string(),
  description: z.string(),
  features: z.array(z.string()),
  cta: z.string(),
  isPopular: z.boolean(),
  customPriceDisplay: z.string().optional(),
  priceSubtext: z.string().optional(),
  borderColor: z.string(),
  buttonColor: z.string(),
  outlineColor: z.string(),
  checkColor: z.string(),
});

/**
 * Plan catalog response schema (GET /stripe/plans)
 */
export const PlanCatalogSchema = z.object({
  plans: z.array(PlanCatalogEntrySchema),
});

/**
 * Stripe configuration schema for frontend
 */
export const StripeConfigSchema = z.object({
  publishableKey: z.string(),
  priceIds: z.object({
    starter: z.object({
      monthly: z.string().nullable(),
      annual: z.string().nullable(),
    }),
    growth: z.object({
      monthly: z.string().nullable(),
      annual: z.string().nullable(),
    }),
  }),
  trialDays: z.number().int().min(0),
  calendlyUrl: z.string(),
});

/**
 * Public client config (no auth). Values are kept in backend env only.
 */
export const PublicConfigSchema = z.object({
  widgetKey: z.string(),
  widgetId: z.string(),
  widgetUrl: z.string(),
});

// ============================================================================
// TYPE EXPORTS - Essential TypeScript types for external use
// ============================================================================

/**
 * Core enum types
 */
export type UserPlan = z.infer<typeof UserPlanSchema>;
export type EntityStatus = z.infer<typeof EntityStatusSchema>;
export type WorkspacePackage = z.infer<typeof WorkspacePackageSchema>;
export type AgentType = z.infer<typeof AgentTypeSchema>;
export type AgentVoice = z.infer<typeof AgentVoiceSchema>;
export type AgentStatus = z.infer<typeof AgentStatusSchema>;
export type KnowledgeType = z.infer<typeof KnowledgeTypeSchema>;
export type KnowledgeSource = z.infer<typeof KnowledgeSourceSchema>;
export type ChatStatus = z.infer<typeof ChatRoleSchema>;
export type ChatSource = z.infer<typeof ChatSourceSchema>;
export type InstructionType = z.infer<typeof InstructionTypeSchema>;
export type ApplicationType = z.infer<typeof ApplicationTypeSchema>;
export type WidgetType = z.infer<typeof WidgetTypeSchema>;
export type ConnectorType = z.infer<typeof ConnectorTypeSchema>;
export type ActionLogType = z.infer<typeof ActionLogTypeSchema>;

export type FileData = z.infer<typeof FileSchema>;

/**
 * Service and data transfer types
 */
export type ActionLogData = z.infer<typeof ActionLogEntitySchema>;
export type ActionLogMetadataData = z.infer<typeof ActionLogMetadataSchema>;
export type UpdateChatCountData = z.infer<typeof UpdateChatCountDataSchema>;
export type TokenData = z.infer<typeof TokenSchema>;
export type UserCreateData = z.infer<typeof UserCreateSchema>;
export type UserUpdateData = z.infer<typeof UserUpdateSchema>;
export type BatchUserCreateData = z.infer<typeof BatchUserCreateSchema>;
export type BatchUserCreateResult = z.infer<typeof BatchUserCreateResultSchema>;
export type UploadUserLogoData = z.infer<typeof UploadUserLogoDataSchema>;
export type WorkspaceReadData = z.infer<typeof WorkspaceCreateSchema>;
export type WorkspaceUpdateData = z.infer<typeof WorkspaceUpdateSchema>;
export type WidgetInfoData = z.infer<typeof WidgetInfoSchema>;
export type AgentCreationData = z.infer<typeof AgentCreateSchema>;
export type AgentUpdateData = z.infer<typeof AgentUpdateSchema>;
export type AgentSearchConfig = z.infer<typeof AgentSearchConfigSchema>;
export type SearchDocument = z.infer<typeof SearchDocumentSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type AgentSimulationIndexRequest = z.infer<typeof AgentSimulationIndexRequestSchema>;
export type AgentSimulationIndexResponse = z.infer<typeof AgentSimulationIndexResponseSchema>;
export type AgentTaskStartResponseData = z.infer<typeof AgentTaskStartResponseSchema>;
export type AgentTaskStopResponseData = z.infer<typeof AgentTaskStopResponseSchema>;
export type AgentTaskStatusResponseData = z.infer<typeof AgentTaskStatusResponseSchema>;
export type SimulationStatusResponseData = z.infer<typeof SimulationStatusResponseSchema>;
export type BrowserSessionResponseData = z.infer<typeof BrowserSessionResponseSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type FileUploadResponse = z.infer<typeof FileUploadResponseSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatResponseData = z.infer<typeof ChatResponseSchema>;
export type MailOptionsData = z.infer<typeof MailOptionsDataSchema>;
// ============================================================================
// MODEL ATTRIBUTES - TypeScript interfaces for Sequelize models
// ============================================================================

/**
 * Model attribute types for Sequelize models
 */
export type UserData = z.infer<typeof UserEntitySchema>;
export type WorkspaceData = z.infer<typeof WorkspaceEntitySchema>;
export type WorkspacePlanData = z.infer<typeof WorkspacePlanEntitySchema>;
export type AgentData = z.infer<typeof AgentEntitySchema>;
export type KnowledgeData = z.infer<typeof KnowledgeEntitySchema>;
export type ApplicationData = z.infer<typeof ApplicationEntitySchema>;
export type ApplicationCreateData = z.infer<typeof ApplicationCreateSchema>;
export type ApplicationUpdateData = z.infer<typeof ApplicationUpdateSchema>;
export type ApplicationWithWidgetsData = z.infer<typeof ApplicationWithWidgetsSchema>;
export type WidgetData = z.infer<typeof WidgetEntitySchema>;
export type WidgetWithAgentData = z.infer<typeof WidgetWithAgentSchema>;
export type WidgetCreateData = z.infer<typeof WidgetCreateSchema>;
export type WidgetUpdateData = z.infer<typeof WidgetUpdateSchema>;
export type UrlGuideData = z.infer<typeof UrlGuideEntitySchema>;
export type UrlGuideCreateData = z.infer<typeof UrlGuideCreateSchema>;
export type UrlGuideUpdateData = z.infer<typeof UrlGuideUpdateSchema>;
export type WidgetSettingsData = z.infer<typeof WidgetSettingsDataSchema>;
export type SlackSettingsData = z.infer<typeof SlackSettingsDataSchema>;
export type WidgetSettingsKey = keyof z.infer<typeof WidgetSettingsDataSchema>;
export type WidgetChip = z.infer<typeof WidgetChipSchema>;
export type SlackSettingsKey = keyof z.infer<typeof SlackSettingsDataSchema>;
export type SimulationData = z.infer<typeof SimulationEntitySchema>;
export type SimulationLoggingUserData = z.infer<typeof SimulationLoggingUserSchema>;
export type SimulationStepData = z.infer<typeof SimulationStepSchema>;
export type SimulationStepSummaryData = z.infer<typeof SimulationStepSummarySchema>;
export type SimulationHistoryData = z.infer<typeof SimulationHistorySchema>;
export type SimulationModelOutputData = z.infer<typeof SimulationModelOutputSchema>;
export type SimulationResultData = z.infer<typeof SimulationResultSchema>;
export type SimulationStateData = z.infer<typeof SimulationStateSchema>;
export type SimulationActionData = z.infer<typeof SimulationActionSchema>;
export type BrowserTabData = z.infer<typeof BrowserTabSchema>;
export type InteractedElementData = z.infer<typeof InteractedElementSchema>;
export type ConversationType = z.infer<typeof ConversationTypeSchema>;
export type ConversationMessageRole = z.infer<typeof ConversationMessageRoleSchema>;
export type ConversationData = z.infer<typeof ConversationEntitySchema>;
export type ConversationMessageData = z.infer<typeof ConversationMessageEntitySchema>;
export type ConnectorData = z.infer<typeof ConnectorEntitySchema>;
export type ConnectorUpsertData = z.infer<typeof ConnectorUpsertSchema>;
export type ConnectorSearchData = z.infer<typeof ConnectorSearchSchema>;
export type McpStatusData = z.infer<typeof McpStatusSchema>;
export type McpToolData = z.infer<typeof McpToolSchema>;
export type AutomationData = z.infer<typeof AutomationEntitySchema>;
export type AutomationCreateData = z.infer<typeof AutomationCreateSchema>;
export type AutomationUpdateData = z.infer<typeof AutomationUpdateSchema>;
export type AutomationSearchData = z.infer<typeof AutomationSearchSchema>;
export type AutomationRunData = z.infer<typeof AutomationRunEntitySchema>;
export type AutomationRunSearchData = z.infer<typeof AutomationRunSearchSchema>;
export type AutomationGraph = z.infer<typeof AutomationGraphSchema>;
export type AutomationNode = z.infer<typeof AutomationNodeSchema>;
export type AutomationNodeResult = z.infer<typeof AutomationNodeResultSchema>;
export type UserQuotaData = z.infer<typeof UserQuotaSchema>;
export type SubscriptionUsageData = z.infer<typeof SubscriptionUsageSchema>;
export type SimulationProgressData = z.infer<typeof SimulationProgressEntitySchema>;
export type MindMapEdgeData = z.infer<typeof MindMapEdgeSchema>;
export type MindMapNodeData = z.infer<typeof MindMapNodeSchema>;
export type MindMapData = z.infer<typeof MindMapSchema>;
export const SessionStatsEntrySchema = z.object({
  date: z.string().describe('YYYY-MM-DD'),
  sessions: z.number().int().nonnegative(),
  events: z.number().int().nonnegative(),
});

export const SessionStatsResponseSchema = z.object({
  items: z.array(SessionStatsEntrySchema),
});

export type SessionData = z.infer<typeof SessionEntitySchema>;
export type SessionUpsertData = z.infer<typeof SessionUpsertSchema>;
export type SessionStatsEntry = z.infer<typeof SessionStatsEntrySchema>;
export type SessionStatsResponse = z.infer<typeof SessionStatsResponseSchema>;
export type StripeCheckoutData = z.infer<typeof StripeCheckoutSchema>;
export type StripePortalData = z.infer<typeof StripePortalSchema>;
export type StripeTrialData = z.infer<typeof StripeTrialSchema>;
export type StripeDowngradeData = z.infer<typeof StripeDowngradeSchema>;
export type StripeDowngradeResponseData = z.infer<typeof StripeDowngradeResponseSchema>;
export type PlanInfoData = z.infer<typeof PlanInfoSchema>;
export type CheckoutSessionData = z.infer<typeof CheckoutSessionSchema>;
export type PortalSessionData = z.infer<typeof PortalSessionSchema>;
export type TrialSubscriptionData = z.infer<typeof TrialSubscriptionSchema>;
export type PriceAmountData = z.infer<typeof PriceAmountSchema>;
export type PlanPricingData = z.infer<typeof PlanPricingSchema>;
export type StripePricingData = z.infer<typeof StripePricingSchema>;
export type StripeConfigData = z.infer<typeof StripeConfigSchema>;
export type PublicConfigData = z.infer<typeof PublicConfigSchema>;
export type QAFlowData = z.infer<typeof QAFlowEntitySchema>;
export type QAFlowLastRunData = {
  id: number;
  status: string;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  created_at: Date | null;
};
export type QAFlowListItemData = QAFlowData & {
  run_count: number;
  display_title: string;
  total_failed: number;
  pass_rate: number | null;
  last_run: QAFlowLastRunData | null;
};
export type QARunData = z.infer<typeof QARunEntitySchema>;
export type QATestCaseData = z.infer<typeof QATestCaseEntitySchema>;
export type QAFlowProcessingResponseData = z.infer<typeof QAFlowProcessingResponseSchema>;

// ---------------------------------------------------------------------------
// Preview Video Chat
// ---------------------------------------------------------------------------

export const PreviewVideoChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.string().optional(),
});

export const PreviewVideoChatEntitySchema = BaseEntitySchema.extend({
  workspace_id: z.number(),
  application_id: z.number().nullish(),
  agent_id: z.number().nullish(),
  simulation_id: z.number().nullish(),
  chat_id: z.string(),
  chat_content: z.string().nullish(),
  chat_history: z.array(PreviewVideoChatMessageSchema).nullish(),
  chat_output: z.string().nullish(),
  preview_video_url: z.string().nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});

export const PreviewVideoChatUpsertSchema = z.object({
  application_id: z.number().nullish(),
  agent_id: z.number().nullish(),
  simulation_id: z.number().nullish(),
  chat_id: z.string(),
  chat_content: z.string().nullish(),
  chat_history: z.array(PreviewVideoChatMessageSchema).nullish(),
  chat_output: z.string().nullish(),
  preview_video_url: z.string().nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});

export const PreviewVideoChatSearchSchema = z.object({
  chat_id: z.string().optional(),
  agent_id: z.number().optional(),
  simulation_id: z.number().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

export type PreviewVideoChatMessageData = z.infer<typeof PreviewVideoChatMessageSchema>;
export type PreviewVideoChatData = z.infer<typeof PreviewVideoChatEntitySchema>;
export type PreviewVideoChatUpsertData = z.infer<typeof PreviewVideoChatUpsertSchema>;
export type PreviewVideoChatSearchData = z.infer<typeof PreviewVideoChatSearchSchema>;

// ============================================================================
// CONNECTION / TRIGGER / ACTION SCHEMAS
// ============================================================================

export const ConnectionProviderSchema = z.enum(['github', 'slack', 'teams', 'jira']);
export const TriggerProviderSchema = z.enum(['github', 'slack', 'teams', 'jira', 'timer', 'mcp']);
export const ActionProviderSchema = z.enum(['github', 'slack', 'teams', 'jira', 'internal']);
export const ConnectionStatusSchema = z.enum(['connected', 'disconnected']);

// --- Connection ---
export const ConnectionEntitySchema = BaseEntitySchema.extend({
  workspace_id: z.number(),
  provider: ConnectionProviderSchema,
  status: ConnectionStatusSchema.default('disconnected'),
  credentials: z.record(z.string(), z.unknown()).nullish(),
  provider_data: z.record(z.string(), z.unknown()).nullish(),
  connected_at: z.coerce.date().nullish(),
});

// --- Trigger ---
export const TriggerEntitySchema = BaseEntitySchema.extend({
  workspace_id: z.number(),
  connection_id: z.number().nullish(),
  connector_id: z.number().nullish(),
  provider: TriggerProviderSchema,
  name: z.string().min(1).max(255),
  source_config: z.record(z.string(), z.unknown()).default({}),
  webhook_id: z.string(),
  webhook_secret: z.string(),
  enabled: z.boolean().default(true),
  last_triggered_at: z.coerce.date().nullish(),
});

export const TriggerCreateSchema = z.object({
  connection_id: z.number().nullish(),
  connector_id: z.number().nullish(),
  provider: TriggerProviderSchema,
  name: z.string().min(1).max(255),
  source_config: z.record(z.string(), z.unknown()).default({}),
});

export const TriggerUpdateSchema = z.object({
  trigger_id: z.coerce.number(),
  name: z.string().min(1).max(255).optional(),
  source_config: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

export const TriggerSearchSchema = z
  .object({
    provider: TriggerProviderSchema.optional(),
    connection_id: z.coerce.number().optional(),
    connector_id: z.coerce.number().optional(),
  })
  .extend(PaginationSchema.shape);

// --- Action ---
export const ActionEntitySchema = BaseEntitySchema.extend({
  workspace_id: z.number(),
  connection_id: z.number().nullish(),
  provider: ActionProviderSchema,
  name: z.string().min(1).max(255),
  type: z.string().min(1).max(60),
  target_config: z.record(z.string(), z.unknown()).default({}),
  is_default: z.boolean().default(false),
  enabled: z.boolean().default(true),
  last_executed_at: z.coerce.date().nullish(),
});

export const ActionCreateSchema = z.object({
  connection_id: z.number().nullish(),
  provider: ActionProviderSchema,
  name: z.string().min(1).max(255),
  type: z.string().min(1).max(60),
  target_config: z.record(z.string(), z.unknown()).default({}),
});

export const ActionUpdateSchema = z.object({
  action_id: z.coerce.number(),
  name: z.string().min(1).max(255).optional(),
  target_config: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

export const ActionSearchSchema = z
  .object({
    provider: ActionProviderSchema.optional(),
    type: z.string().optional(),
  })
  .extend(PaginationSchema.shape);

// ============================================================================
// INSIGHT - UX Insights: Personas, Heatmaps, Reactions
// ============================================================================

export const InsightConnectorStatusSchema = z.enum(['connected', 'not_connected']);

export const InsightConnectorSchema = z.object({
  key: z.string(),
  label: z.string(),
  color: z.string(),
  status: InsightConnectorStatusSchema,
  session_count: z.number().nullable(),
});

export const InsightSegmentEntitySchema = z.object({
  id: z.number(),
  application_id: z.number(),
  name: z.string(),
  percentage: z.number(),
  description: z.string(),
  avg_sessions_per_week: z.number(),
  mobile_percentage: z.number(),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
});

export const InsightPersonaEntitySchema = z.object({
  id: z.number(),
  application_id: z.number(),
  segment_id: z.number().nullable(),
  segment_name: z.string().optional(),
  is_selected: z.boolean().default(false),
  is_top: z.boolean().default(false),
  name: z.string(),
  initials: z.string(),
  description: z.string(),
  traits: z.array(z.string()),
  tags: z.array(z.string()).optional().default([]),
  source: z.enum(['generated', 'domain', 'manual']).optional().default('generated'),
  age_range: z.string().optional().default(''),
  goals: z.string().optional().default(''),
  behavior: z.string().optional().default(''),
  pain_points: z.string().optional().default(''),
  triggers: z.string().optional().default(''),
  openness: z.number().nullable().optional(),
  conscientiousness: z.number().nullable().optional(),
  extraversion: z.number().nullable().optional(),
  agreeableness: z.number().nullable().optional(),
  neuroticism: z.number().nullable().optional(),
  mbti_type: z.string().optional().default(''),
  mbti_rationale: z.string().optional().default(''),
  key_features: z.array(z.string()).optional().default([]),
  bhvr_proficiency: z.number().nullable().optional(),
  bhvr_preciseness: z.number().nullable().optional(),
  bhvr_sensitivity: z.number().nullable().optional(),
  bhvr_efficiency: z.number().nullable().optional(),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
});

export const InsightPersonasResponseSchema = z.object({
  connectors: z.array(InsightConnectorSchema),
  segments: z.array(InsightSegmentEntitySchema),
  personas: z.array(InsightPersonaEntitySchema),
});

export const DomainPersonaSuggestionSchema = z.object({
  name: z.string(),
  initials: z.string(),
  description: z.string(),
  traits: z.array(z.string()),
  tags: z.array(z.string()).optional().default([]),
  is_top: z.boolean().default(false),
});

export const InsightPersonasSaveDomainInputSchema = z.object({
  personas: z.array(
    DomainPersonaSuggestionSchema.extend({
      is_selected: z.boolean(),
    }),
  ),
});

export const InsightPersonaUpdateInputSchema = z.object({
  id: z.coerce.number(),
  name: z.string().optional(),
  description: z.string().optional(),
  age_range: z.string().optional(),
  goals: z.string().optional(),
  behavior: z.string().optional(),
  pain_points: z.string().optional(),
  triggers: z.string().optional(),
  tags: z.array(z.string()).optional(),
  traits: z.array(z.string()).optional(),
  key_features: z.array(z.string()).optional(),
});

export const DomainPersonaSuggestResponseSchema = z
  .object({
    label: z.string(),
    industry: z.string(),
    personas: z.array(DomainPersonaSuggestionSchema),
  })
  .nullable();

// Heatmaps

export const HeatmapTypeSchema = z.enum(['clicks', 'scroll', 'attention']);
export const HeatmapVariationSchema = z.enum(['desktop', 'tablet', 'mobile']);

export const HeatSpotSchema = z.object({
  x: z.number(),
  y: z.number(),
  radius: z.number(),
  intensity: z.number(),
});

export const HeatmapStatsSchema = z.object({
  total_interactions: z.number(),
  unique_users: z.number(),
  hottest_zone: z.string(),
  dead_zones: z.number(),
});

export const HeatmapElementCountSchema = z.object({
  selector: z.string(),
  count: z.number(),
  dead_clicks: z.number(),
  rage_clicks: z.number(),
});

export const HeatmapPageEntitySchema = z.object({
  id: z.number(),
  application_id: z.number(),
  path: z.string(),
  session_count: z.number(),
  variation_count: z.number(),
  variations: z.array(HeatmapVariationSchema).default([]),
  visitor_count: z.number().optional(),
  last_aggregated_at: z.coerce.date().nullable().optional(),
  representative_session_id: z.string().nullable().optional(),
});

export const HeatmapSnapshotEntitySchema = z.object({
  id: z.number(),
  heatmap_page_id: z.number(),
  variation: HeatmapVariationSchema,
  type: HeatmapTypeSchema,
  spots: z.array(HeatSpotSchema),
  stats: HeatmapStatsSchema,
  page_width: z.number().nullable().optional(),
  page_height: z.number().nullable().optional(),
  element_counts: z.array(HeatmapElementCountSchema).optional(),
  representative_session_override: z.string().nullable().optional(),
});

export const HeatmapJobStatusSchema = z.object({
  job_id: z.string().nullable(),
  status: z.enum(['idle', 'queued', 'active', 'completed', 'failed']),
  last_aggregated_at: z.coerce.date().nullable(),
});

/**
 * Candidate session returned by `insightHeatmapCandidates`. Represents a
 * session that contributed to a (page, variation) heatmap and could be
 * pinned as that snapshot's DOM backdrop via `insightHeatmapSetBackdrop`.
 */
export const HeatmapCandidateSchema = z.object({
  session_id: z.string(),
  width: z.number(),
  height: z.number(),
  event_count: z.number(),
  started_at: z.coerce.date(),
  has_full_snapshot: z.boolean(),
});

export type HeatmapCandidate = z.infer<typeof HeatmapCandidateSchema>;

// Reactions

export const ReactionScoreSchema = z.object({
  score: z.number().min(1).max(10),
  justification: z.string(),
});

export const ContextRefSchema = z.object({
  type: z.enum(['doc', 'sim', 'session']),
  id: z.string(),
  label: z.string(),
});

export const ReactionReplayEvidenceSchema = z.object({
  simulations: z
    .array(
      z.object({
        simulation_id: z.number(),
        task_id: z.string().nullable().optional(),
        step_count: z.number(),
        summary: z.string(),
      }),
    )
    .default([]),
  moments: z
    .array(
      z.object({
        sim_index: z.number(),
        step_index: z.number(),
        label: z.string(),
      }),
    )
    .max(6)
    .default([]),
  context_refs: z.array(ContextRefSchema).default([]),
});

export const PersonaSnapshotSchema = z.object({
  name: z.string(),
  initials: z.string().optional(),
  segment_name: z.string().optional(),
  traits: z.array(z.string()).optional(),
  age_range: z.string().optional(),
});

export const ReactionResultEntitySchema = z.object({
  id: z.number(),
  run_id: z.number(),
  persona_id: z.number().nullable(),
  persona_name: z.string().optional(),
  persona_initials: z.string().optional(),
  ad_hoc_persona: z
    .object({ name: z.string(), description: z.string(), traits: z.array(z.string()) })
    .nullable()
    .optional(),
  overall_reactions: z.record(z.string(), ReactionScoreSchema),
  dimension_scores: z.record(z.string(), ReactionScoreSchema),
  simulation_id: z.number().nullable().optional(),
  task_id: z.string().nullable().optional(),
  status: z.enum(['pending', 'completed', 'failed']).optional(),
  replay_evidence: ReactionReplayEvidenceSchema.nullable().optional(),
  error: z.string().nullable().optional(),
  persona_snapshot: PersonaSnapshotSchema.nullable().optional(),
  created_at: z.coerce.date().optional(),
});

export const SuggestedSimulationSchema = z.object({
  description: z.string(),
  selected: z.boolean(),
  simulation_id: z.number().nullable().optional(),
  task_id: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
});

export const ReactionRunEntitySchema = z.object({
  id: z.number(),
  reaction_id: z.number(),
  run_number: z.number().optional(),
  context_refs: z.array(ContextRefSchema),
  simulations: z.array(SuggestedSimulationSchema),
  persona_ids: z.array(z.number()).optional(),
  results: z.array(ReactionResultEntitySchema).optional(),
  status: z.enum(['running', 'completed', 'failed']).nullable().optional(),
  processing_started_at: z.coerce.date().nullable().optional(),
  completed_at: z.coerce.date().nullable().optional(),
  failed_at: z.coerce.date().nullable().optional(),
  error: z.string().nullable().optional(),
  created_at: z.coerce.date().optional(),
});

export const ReactionEntitySchema = z.object({
  id: z.number(),
  application_id: z.number(),
  question: z.string(),
  run_count: z.number().optional(),
  last_run_at: z.coerce.date().optional(),
  runs: z.array(ReactionRunEntitySchema).optional(),
  created_at: z.coerce.date().optional(),
});

export const ChatContextResponseSchema = z.object({
  contextRefs: z.array(ContextRefSchema),
  suggestedSimulations: z.array(SuggestedSimulationSchema),
});

// ============================================================================
// SLACK COMMAND LOG SCHEMAS - Slash command logging and capability stats
// ============================================================================

export const SlackCommandLogStatusSchema = z.enum(['received', 'classifying', 'dispatched', 'completed', 'failed']);

export const SlackCommandLogEntitySchema = z.object({
  id: z.number(),
  workspace_id: z.number(),
  slack_user_id: z.string(),
  slack_channel_id: z.string().nullable(),
  raw_text: z.string(),
  detected_intent: z.string(),
  extracted_params: z.record(z.string(), z.unknown()),
  status: SlackCommandLogStatusSchema,
  response_text: z.string().nullable(),
  error_message: z.string().nullable(),
  duration_ms: z.number().nullable(),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
});

export const SlackCommandLogSearchSchema = z.object({
  intent: z.string().optional(),
  limit: z.coerce.number().optional().default(20),
  offset: z.coerce.number().optional().default(0),
});

export const SlackCapabilitySchema = z.object({
  intent: z.string(),
  name: z.string(),
  description: z.string(),
  example: z.string(),
  execution_count: z.number(),
  last_used: z.string().nullable(),
});

// Type aliases
export type ConnectionData = z.infer<typeof ConnectionEntitySchema>;
export type TriggerData = z.infer<typeof TriggerEntitySchema>;
export type ActionData = z.infer<typeof ActionEntitySchema>;
export type SlackCommandLogData = z.infer<typeof SlackCommandLogEntitySchema>;
export type SlackCapabilityData = z.infer<typeof SlackCapabilitySchema>;
export type GithubPRFileItem = z.infer<typeof GithubPRFileItemSchema>;
export type GithubPRTriggerData = z.infer<typeof GithubPRTriggerDataSchema>;
export type GithubCheckRunInput = z.infer<typeof GithubCheckRunInputSchema>;
