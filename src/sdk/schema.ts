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
 * - TaskPilot: Legacy prompt tracking (deprecated — new code uses 'app' source)
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
export const QAFlowStatusSchema = z.enum(['pending', 'processing', 'waiting_review', 'completed', 'failed']);
export const QATestStatusSchema = z.enum(['pending', 'running', 'completed', 'failed']);
export const QARunStatusSchema = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']);
export const ChatRoleSchema = z.enum(['user', 'agent']);
// 'taskpilot' is legacy (was used by playground) — kept for backward-compat with existing DB rows
export const ChatSourceSchema = z.enum(['taskpilot', 'widget', 'app']);
export const InstructionTypeSchema = z.enum(['tell', 'show', 'do']);
export const ApplicationTypeSchema = z.enum(['app', 'website']);
export const WidgetTypeSchema = z.enum(['widget', 'slack']);
export const ConnectorTypeSchema = z.enum(['timer', 'github', 'slack', 'teams', 'jira']);
export const ActionLogTypeSchema = z.enum([
  'user_login',
  'url_visit',
  'update_tenant',
  'create_user',
  'update_user',
  'delete_user',
  'create_agent',
  'update_agent',
  'delete_agent',
  'create_connection',
  'update_connection',
  'delete_connection',
  'create_integration',
  'update_integration',
  'delete_integration',
  'create_knowledge',
  'update_knowledge',
  'delete_knowledge',
  'approve_user',
  'deny_user',
  'request_tenant',
  'widget_question',
  'qa_run_started',
  'start_simulation',
]);

/**
 * Base entity schema with common fields for all database entities
 */
export const BaseEntitySchema = z.object({
  id: z.number().optional(),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
});

export const FileSchema = z.object({
  file: z.custom<Express.Multer.File>(),
  connection_id: z.coerce.number().optional(),
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
  connection_id: z.number().optional(),
  file_name: z.string(),
  file_size: z.number(),
  file_type: KnowledgeTypeSchema,
  file_url: z.string(),
  source_url: z.string().nullish(), // Original URL for URL-based documents
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
  connection_id: z.number(),
  file_name: z.string(),
  file_size: z.number(),
  file_type: z.string(),
  file_url: z.string(),
  file_path: z.string().nullable(),
  additional_instructions: z.string().max(1000).nullable().optional(),
  status: QAFlowStatusSchema,
  processing_step: z.string().nullable().optional(),
  ultimate_goal: z.string().nullable().optional(),
  browser_config: BrowserConfigSchema.nullable().optional(),
});

/**
 * QA document create schema
 */
export const QAFlowCreateSchema = z.object({
  connection_id: z.coerce.number(),
  file: z.custom<Express.Multer.File>().optional(),
  text_content: z.string().optional(),
  file_name: z.string().optional(),
  additional_instructions: z.string().max(1000).optional(),
});

/**
 * QA run entity schema
 */
export const QARunEntitySchema = BaseEntitySchema.extend({
  qa_document_id: z.number(),
  workspace_id: z.number(),
  triggered_by: z.number(),
  status: QARunStatusSchema,
  browser_type: BrowserTypeSchema,
  browser_config: BrowserConfigSchema.nullable().optional(),
  total_tests: z.number().int().nonnegative(),
  passed_tests: z.number().int().nonnegative(),
  failed_tests: z.number().int().nonnegative(),
  started_at: z.coerce.date().nullable().optional(),
  completed_at: z.coerce.date().nullable().optional(),
});

/**
 * JSON entry schemas for qa_test_case embedded arrays
 */
export const QAProgressLogEntrySchema = z.object({
  step: z.number(),
  message: z.string(),
  timestamp: z.string(),
  status: z.enum(['success', 'error', 'info']),
});

export const QAExecutionEntrySchema = z.object({
  run_id: z.number(),
  status: z.enum(['pending', 'running', 'passed', 'failed', 'skipped']),
  browser_type: BrowserTypeSchema.nullable().optional(),
  progress_log: z.array(QAProgressLogEntrySchema).default([]),
  error_message: z.string().nullable().optional(),
  screenshot_url: z.string().nullable().optional(),
  simulation_id: z.number().nullable().optional(),
  duration_ms: z.number().nullable().optional(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
});

export const QAVersionHistoryEntrySchema = z.object({
  version: z.number().int().positive(),
  test_title: z.string(),
  test_objective: z.string(),
  test_steps: z.array(z.string()),
  expected_outcome: z.string(),
  priority: z.enum(['Low', 'Medium', 'High']),
  change_type: z.enum(['created', 'modified', 'self_healed', 'refined', 'deleted']),
  change_reason: z.string().nullable().optional(),
  changed_by: z.number().nullable().optional(),
  created_at: z.string(),
  accepted: z.boolean().optional(),
});

export const QAHealingAttemptEntrySchema = z.object({
  failure_type: z.enum(['locator', 'assertion', 'timeout', 'flow_change', 'environment']),
  failure_message: z.string().nullable().optional(),
  failure_context: z.record(z.string(), z.unknown()).nullable().optional(),
  repair_strategy: z.string().nullable().optional(),
  repair_details: z.record(z.string(), z.unknown()).nullable().optional(),
  confidence_score: z.number().min(0).max(1).nullable().optional(),
  validation_status: z.enum(['pending', 'validated', 'failed', 'rejected']),
  simulation_id: z.number().nullable().optional(),
  validation_simulation_id: z.number().nullable().optional(),
  healed_version: z.number().nullable().optional(),
  created_at: z.string(),
});

/**
 * QA test case entity schema (replaces old qa_test_result)
 */
export const QATestCaseEntitySchema = BaseEntitySchema.extend({
  qa_document_id: z.number(),
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
  executions: z.array(QAExecutionEntrySchema).nullable(),
  healing_attempts: z.array(QAHealingAttemptEntrySchema).nullable(),
  healing_metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  last_healed_at: z.coerce.date().nullable().optional(),
});

/**
 * QA test case create schema
 */
export const QATestCaseCreateSchema = z.object({
  qa_document_id: z.number(),
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

// ============================================================================
// QA Test Version & Healing Types (consolidated into qa_test_case JSON columns)
// ============================================================================

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
export type QAExecutionEntry = z.infer<typeof QAExecutionEntrySchema>;
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
 * One entry inside simulation.progress_log (stored as JSON array on the simulation row).
 */
export const SimulationProgressEntrySchema = z.object({
  status: z.string(),
  status_message: z.string().nullable(),
  num_steps: z.number().int().nonnegative().nullable(),
  created_at: z.coerce.date(),
});
export type SimulationProgressEntry = z.infer<typeof SimulationProgressEntrySchema>;

/**
 * App simulation schema
 */
export const SimulationEntitySchema = BaseEntitySchema.extend({
  connection_id: z.number(),
  agent_id: z.number(),
  job_id: z.string(),
  session_id: z.string().nullable().optional(),
  status: z.string(),
  status_message: z.string().nullish(),
  path: z.string().nullish(),
  instructions: z.string().nullish(),
  num_steps: z.number().int().nonnegative(),
  pinned: z.boolean().optional(),
  source: z.enum(['direct', 'qa']).optional(),
  agent_name: z.string().nullish(),
  graph_index_id: z.string().nullable().optional(),
  progress_log: z.array(SimulationProgressEntrySchema).optional(),
  agents: z.array(AgentBadgeSchema).optional(),
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
  connection_id: z.number(),
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
  num_steps: z.number().int().nonnegative().optional(),
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
  marketrix_chat_id: z.string(),
  connection_id: z.number().int().nullable().optional(),
  blob_url: z.string().nullable(),
  event_count: z.number().int().nonnegative(),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().nullable(),
  is_active: z.preprocess(v => (typeof v === 'number' ? v !== 0 : v), z.boolean()),
  metadata: z
    .object({
      userAgent: z.string().optional(),
      url: z.string().optional(),
    })
    .nullable(),
  last_batch_index: z.number().int().nonnegative().nullable(),
  last_event_timestamp: z.number().int().nullable(),
  last_upload_time: z.string().datetime().nullable(),
});

/**
 * RRWeb session upsert schema (for create/update)
 */
export const SessionUpsertSchema = z.object({
  session_id: z.string().min(1),
  marketrix_chat_id: z.string().min(1),
  connection_id: z.number().int().nullable().optional(),
  blob_url: z.string().nullable().optional(),
  event_count: z.number().int().nonnegative().optional(),
  started_at: z.string().datetime().optional(),
  ended_at: z.string().datetime().nullable().optional(),
  is_active: z.preprocess(v => (typeof v === 'number' ? v !== 0 : v), z.boolean()).optional(),
  metadata: z
    .object({
      userAgent: z.string().optional(),
      url: z.string().optional(),
      connectionId: z.number().optional(), // Still accepted; API persists to connection_id column
    })
    .nullable()
    .optional(),
  last_batch_index: z.number().int().nonnegative().nullable().optional(),
  last_event_timestamp: z.number().int().nullable().optional(),
  last_upload_time: z.string().datetime().nullable().optional(),
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
  num_steps: z.number().int().nonnegative().nullable(),
  created_at: z.coerce.date(),
});

/**
 * Mindmap edge schema - transition from one node to another via an action
 */
export const MindMapEdgeSchema = z.object({
  start: z.string(),
  end: z.string(),
  action: z.string(),
});

/**
 * Mindmap node schema - unique web state (page + situation) during simulation
 */
export const MindMapNodeSchema = z.object({
  id: z.string(),
  screenshots: z.array(z.string()),
  title: z.string(),
  url: z.string(),
  state: z.array(z.string()),
  mentions: z.array(z.string()),
});

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
  connection_id: z.number(),
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

const KnowledgeIdsSchema = z.string().transform(str => {
  const parsed: unknown = JSON.parse(str);
  return Array.isArray(parsed) ? (parsed as unknown[]).map(v => Number(v)) : [];
});

const SimulationIdsSchema = z.string().transform(str => {
  const parsed: unknown = JSON.parse(str);
  return Array.isArray(parsed) ? (parsed as unknown[]).map(v => Number(v)) : [];
});

/**
 * Agent creation schema
 */
export const AgentCreateSchema = AgentEntitySchema.partial().extend({
  connection_id: z.coerce.number(),
  agent_name: z.string(),
  agent_type: AgentTypeSchema,
  agent_voice: AgentVoiceSchema,
  agent_description: z.string(),
  instructions: z.string(),
  file: z.custom<Express.Multer.File>(),
  knowledge_ids: KnowledgeIdsSchema,
  simulation_ids: SimulationIdsSchema,
});

/**
 * Agent update schema
 */
export const AgentUpdateSchema = AgentEntitySchema.partial().extend({
  file: z.custom<Express.Multer.File>(),
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
  session_id: z.string().optional(),
  live_view_url: z.string().nullable().optional(),
  status: z.string().optional(),
  message: z.string().nullable().optional(),
  success: z.boolean().optional(),
});

/**
 * Task status enum schema
 * Common status values for tasks and simulations
 */
export const TaskStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
  'has_question',
  'in_progress',
]);

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

/**
 * Agent video generation request schema
 */
export const AgentVideoGenerateRequestSchema = z.object({
  simulation_id: z.coerce.number().optional(),
  prompt: z.string().optional(),
});

// ============================================================================
// CONNECTION SCHEMAS - Connection management (apps and websites)
// ============================================================================

/**
 * Connection entity schema
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
 * Connection creation schema
 */
export const ApplicationCreateSchema = ApplicationEntitySchema.partial().extend({
  type: ApplicationTypeSchema,
  name: z.string().min(1),
  url: z.string(),
  allowed_domains: z.array(z.string()).optional().default([]),
});

/**
 * Connection update schema
 */
export const ApplicationUpdateSchema = ApplicationEntitySchema.partial().omit({ workspace_id: true });

// ============================================================================
// INTEGRATION SCHEMAS - Integration management (widget, slack, etc.)
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
 * Slack integration settings schema (example for future use)
 */
export const SlackSettingsDataSchema = z.object({
  webhook_url: z.string().url(),
  channel: z.string(),
  bot_token: z.string(),
  notifications_enabled: z.boolean(),
});

/**
 * Integration entity schema
 */
export const WidgetEntitySchema = BaseEntitySchema.extend({
  connection_id: z.number(),
  agent_id: z.number(),
  type: WidgetTypeSchema,
  settings: z.union([WidgetSettingsDataSchema, SlackSettingsDataSchema]),
  status: EntityStatusSchema,
  marketrix_id: z.string(),
  marketrix_key: z.string(),
  snippet: z.string().nullish(),
});

/**
 * Integration information schema
 */
export const WidgetInfoSchema = WidgetEntitySchema.extend({
  connection: ApplicationEntitySchema.partial(),
  workspace: WorkspaceEntitySchema.partial(),
  user: UserEntitySchema.partial(),
  agent: AgentEntitySchema.partial(),
});

/**
 * Integration search result schema - includes optional eager-loaded agent
 */
export const WidgetWithAgentSchema = WidgetEntitySchema.extend({
  agent: AgentEntitySchema.partial().optional(),
});

/**
 * Connection with integrations schema - matches API response structure
 */
export const ApplicationWithWidgetsSchema = ApplicationEntitySchema.extend({
  integrations: z.array(WidgetEntitySchema),
  agents: z.array(AgentEntitySchema).optional(),
});

/**
 * Integration creation schema
 */
export const WidgetCreateSchema = WidgetEntitySchema.partial().extend({
  connection_id: z.number().positive(),
  agent_id: z.number().positive(),
  type: WidgetTypeSchema,
  settings: z.union([WidgetSettingsDataSchema, SlackSettingsDataSchema]).optional(),
});

/**
 * Integration update schema
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
  integration_id: z.number(),
  url_pattern: z.string(),
  message: z.union([z.string(), z.array(z.string())]), // Support both single message and multiple messages
  description: z.string().optional(),
});

/**
 * URL Guide creation schema
 */
export const UrlGuideCreateSchema = UrlGuideEntitySchema.partial().extend({
  integration_id: z.number().positive(),
  url_pattern: z.string().min(1),
  message: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]), // Support both single message and multiple messages
});

/**
 * URL Guide update schema
 */
export const UrlGuideUpdateSchema = UrlGuideEntitySchema.partial();

// ============================================================================
// TOUR SCHEMAS - Interactive tour and guidance system
// ============================================================================

export const TourStepSchema = z.object({
  step_number: z.number(),
  action: z.string(),
  element: z.string(),
  text: z.string(),
  description: z.string(),
  selector: z.string(),
});

export const TourAnswerSchema = z.array(TourStepSchema);

/**
 * Tour entity schema
 */
export const TourEntitySchema = BaseEntitySchema.extend({
  connection_id: z.number(),
  question: z.string(),
  answer: TourAnswerSchema,
});

// ============================================================================
// CHAT SCHEMAS - AI-powered chat and conversation management
// ============================================================================

/**
 * Chat request schema
 * Requires either: marketrix_id + marketrix_key OR agent_id + connection_id
 */
export const ChatRequestSchema = z
  .object({
    marketrix_id: z.string().optional(),
    marketrix_key: z.string().optional(),
    agent_id: z.number().positive().optional(),
    connection_id: z.number().positive().optional(),
    chat_id: z.string().optional(), // Optional since it comes from path params in some routes
    content: z.string(),
  })
  .refine(data => (data.marketrix_id && data.marketrix_key) ?? (data.agent_id && data.connection_id), {
    message: 'Either marketrix_id + marketrix_key or both agent_id + connection_id must be provided',
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
  z.object({ type: z.literal('registered'), chat_id: z.string(), connection_id: z.number().optional() }),
  z.object({ type: z.literal('pong') }),
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
    status: z.enum(['started', 'completed', 'failed', 'stopped']),
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
    marketrix_chat_id: z.string(),
    connection_id: z.number(),
    url: z.string().optional(),
    user_agent: z.string().optional(),
    timestamp: z.number().optional(),
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

export const AppEventScopeSchema = z.enum(['simulations', 'agents', 'qa', 'user', 'jobs']);

export const AppEventSchema = z.discriminatedUnion('type', [
  // Simulation events
  z.object({
    type: z.literal('simulation/updated'),
    simulation_id: z.number(),
    connection_id: z.number(),
    status: z.string(),
    step_label: z.string().optional(),
  }),
  z.object({
    type: z.literal('simulation/created'),
    simulation_id: z.number(),
    connection_id: z.number(),
  }),
  z.object({
    type: z.literal('simulation/deleted'),
    simulation_id: z.number(),
    connection_id: z.number(),
  }),

  // Agent events
  z.object({
    type: z.literal('agent/updated'),
    agent_id: z.number(),
    connection_id: z.number(),
    status: z.string(),
  }),
  z.object({
    type: z.literal('agent/created'),
    agent_id: z.number(),
    connection_id: z.number(),
  }),
  z.object({
    type: z.literal('agent/deleted'),
    agent_id: z.number(),
    connection_id: z.number(),
  }),

  // QA events
  z.object({
    type: z.literal('qa-document/updated'),
    document_id: z.number(),
    connection_id: z.number(),
    status: z.string(),
    step_label: z.string().optional(),
  }),
  z.object({
    type: z.literal('qa-run/updated'),
    run_id: z.number(),
    document_id: z.number(),
    connection_id: z.number(),
    status: z.string(),
  }),
  z.object({
    type: z.literal('qa-test/updated'),
    test_id: z.number(),
    run_id: z.number(),
    document_id: z.number(),
    connection_id: z.number(),
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
    connection_id: z.number(),
    status: z.string(),
    message: z.string().optional(),
  }),
  z.object({
    type: z.literal('job/completed'),
    job_id: z.string(),
    connection_id: z.number(),
    result: z.unknown().optional(),
  }),
  z.object({
    type: z.literal('job/failed'),
    job_id: z.string(),
    connection_id: z.number(),
    error: z.string(),
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
    integration_type: z.string().optional(),
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
// CHAT SCHEMAS - AI-powered chat and conversation management
// ============================================================================

/**
 * Chat entity schema - matches the Chat model structure
 */
export const ChatEntitySchema = BaseEntitySchema.extend({
  user_id: z.number(),
  connection_id: z.number(),
  agent_id: z.number(),
  chat_id: z.string(),
  role: ChatRoleSchema,
  source: ChatSourceSchema,
  message: z.string(),
});

// ============================================================================
// CONNECTOR SCHEMAS - External service connectors for automations
// ============================================================================

/**
 * Connector entity schema (per-workspace provider credentials/endpoints)
 */
export const ConnectorEntitySchema = BaseEntitySchema.extend({
  workspace_id: z.number(),
  provider: ConnectorTypeSchema,
  name: z.string().min(1).max(120),
  identifier: z.string().max(120).nullable().optional(),
  api_endpoint: z.string().url().nullable().optional(),
  api_token: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  is_active: z.boolean().default(true),
  status: EntityStatusSchema.default('active'),
});

/**
 * Upsert payload for connector
 */
export const ConnectorUpsertSchema = z.object({
  id: z.coerce.number().optional(),
  provider: ConnectorTypeSchema,
  name: z.string().min(1).max(120),
  identifier: z.string().max(120).nullable().optional(),
  api_endpoint: z.string().url().nullable().optional(),
  api_token: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  is_active: z.boolean().optional(),
  status: EntityStatusSchema.optional(),
});

/**
 * Search payload for connectors
 */
export const ConnectorSearchSchema = z.object({
  provider: ConnectorTypeSchema.optional(),
  status: EntityStatusSchema.optional(),
  is_active: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
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
// FILE UPLOAD RESPONSE SCHEMAS - Express.Multer.File upload and media handling
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
  file: z.custom<Express.Multer.File>(),
});

/**
 * User prompt data schema for TaskPilot
 */
export const UserPromptDataSchema = z.object({
  user_id: z.number(),
  connection_id: z.number(),
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
// TASKPILOT SCHEMAS - TaskPilot-specific types
// ============================================================================

/**
 * TaskPilot prompt metadata schema
 */
export const TaskPilotPromptMetadataSchema = z.object({
  step_number: z.number().optional(),
  duration: z.string().optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * TaskPilot prompt schema
 */
export const TaskPilotPromptSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  created_at: z.string(),
  user_id: z.string(),
  user: z.object({
    email: z.string().optional(),
    name: z.string().optional(),
  }),
  prompt_text: z.string().optional(),
  response_text: z.string().optional(),
  status: z.string().optional(),
  createdAt: z.string().optional(),
  metadata: TaskPilotPromptMetadataSchema.optional(),
  taskpilotUser: z
    .object({
      name: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
  question: z.string().optional(),
  response: z.string().optional(),
});

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
  api_version: z.string().nullable().optional(),
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
  connectedApps: UsageMetricSchema,
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
export type ChatStatus = z.infer<typeof ChatRoleSchema>;
export type ChatSource = z.infer<typeof ChatSourceSchema>;
export type InstructionType = z.infer<typeof InstructionTypeSchema>;
export type ApplicationType = z.infer<typeof ApplicationTypeSchema>;
export type WidgetType = z.infer<typeof WidgetTypeSchema>;
export type ConnectorType = z.infer<typeof ConnectorTypeSchema>;
export type ActionLogType = z.infer<typeof ActionLogTypeSchema>;

/**
 * File and upload types
 */
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
export type AgentVideoGenerateRequest = z.infer<typeof AgentVideoGenerateRequestSchema>;
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
export type SimulationStepMetadataData = z.infer<typeof SimulationStepMetadataSchema>;
export type SimulationActionData = z.infer<typeof SimulationActionSchema>;
export type BrowserTabData = z.infer<typeof BrowserTabSchema>;
export type InteractedElementData = z.infer<typeof InteractedElementSchema>;
export type TaskPilotPromptMetadataData = z.infer<typeof TaskPilotPromptMetadataSchema>;
export type TaskPilotPromptData = z.infer<typeof TaskPilotPromptSchema>;
export type TourData = z.infer<typeof TourEntitySchema>;
export type TourAnswerData = z.infer<typeof TourAnswerSchema>;
export type TourStepData = z.infer<typeof TourStepSchema>;
export type ChatData = z.infer<typeof ChatEntitySchema>;
export type ConnectorData = z.infer<typeof ConnectorEntitySchema>;
export type ConnectorUpsertData = z.infer<typeof ConnectorUpsertSchema>;
export type ConnectorSearchData = z.infer<typeof ConnectorSearchSchema>;
export type UserQuotaData = z.infer<typeof UserQuotaSchema>;
export type SubscriptionUsageData = z.infer<typeof SubscriptionUsageSchema>;
export type SimulationProgressData = z.infer<typeof SimulationProgressEntitySchema>;
export type MindMapEdgeData = z.infer<typeof MindMapEdgeSchema>;
export type MindMapNodeData = z.infer<typeof MindMapNodeSchema>;
export type MindMapData = z.infer<typeof MindMapSchema>;
export type SessionData = z.infer<typeof SessionEntitySchema>;
export type SessionUpsertData = z.infer<typeof SessionUpsertSchema>;
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
  connection_id: z.number().nullable().optional(),
  agent_id: z.number().nullable().optional(),
  simulation_id: z.number().nullable().optional(),
  chat_id: z.string(),
  chat_content: z.string().nullable().optional(),
  chat_history: z.array(PreviewVideoChatMessageSchema).nullable().optional(),
  chat_output: z.string().nullable().optional(),
  preview_video_url: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const PreviewVideoChatUpsertSchema = z.object({
  connection_id: z.number().nullable().optional(),
  agent_id: z.number().nullable().optional(),
  simulation_id: z.number().nullable().optional(),
  chat_id: z.string(),
  chat_content: z.string().nullable().optional(),
  chat_history: z.array(PreviewVideoChatMessageSchema).nullable().optional(),
  chat_output: z.string().nullable().optional(),
  preview_video_url: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
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
