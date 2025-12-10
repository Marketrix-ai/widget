/**
 * Marketrix API Schema Definitions
 *
 * This file defines all Zod schemas for the Marketrix API, organized by functional areas
 * to match the route structure. It provides type-safe validation for requests, responses,
 * and internal data structures.
 *
 * Schema Categories:
 * - Base Types: Core enums and common schemas
 * - Authentication: User auth, OAuth, password management
 * - Meeting: Video meeting management and operations
 * - Tenant: Organization and workspace management
 * - Integration: Management and configuration of integrations (widget, slack, etc.)
 * - Chat: AI-powered chat and conversation management
 * - User: User account management and operations
 * - Agent: AI agent creation and management
 * - Activity Log: System activity tracking and auditing
 * - App Config: In-app configuration management
 * - Tour: Interactive tour and guidance system
 * - Simulation: Application simulation and testing
 * - Knowledge: Knowledge base and document management
 * - TaskPilot: AI prompt management and automation
 * - Rule: Business rule and automation rule management
 * - Migration: Database migration and system updates
 */

import { z } from 'zod';

// ============================================================================
// BASE TYPES & ENUMS - Core system enums and common schemas
// ============================================================================

/**
 * Core system enums for user roles, plans, and statuses
 */
export const UserRoleSchema = z.enum(['user', 'admin', 'super']);
export const UserPlanSchema = z.enum(['free', 'pro', 'enterprise']);
export const EntityStatusSchema = z.enum(['created', 'active', 'suspended', 'pending_approval']);
export const TenantPackageSchema = z.enum(['free', 'starter', 'pro', 'enterprise']);
export const AgentTypeSchema = z.enum(['human', 'ai']);
export const AgentVoiceSchema = z.enum(['male', 'female']);
export const AgentStatusSchema = z.enum(['active', 'learning', 'error']);
export const KnowledgeTypeSchema = z.enum(['document', 'video']);
export const MeetingStatusSchema = z.enum(['not_started', 'in_progress', 'ended', 'cancelled']);
export const ChatRoleSchema = z.enum(['user', 'agent']);
export const ChatSourceSchema = z.enum(['taskpilot', 'widget', 'app']);
export const InstructionTypeSchema = z.enum(['tell', 'show', 'do']);
export const ConnectionTypeSchema = z.enum(['app', 'website']);
export const IntegrationTypeSchema = z.enum(['widget', 'slack']);
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
]);

/**
 * Common response schemas used across all API endpoints
 */
export const ServiceResponseSchema = <T extends z.ZodTypeAny>(success: boolean, schema: T) =>
  z.object({
    success: z.literal(success),
    data: schema,
    error: z.string().optional(),
    message: z.string().optional(),
  });

// Common response patterns for compression
export const R = {
  success: <T extends z.ZodTypeAny>(schema: T) => ServiceResponseSchema(true, schema),
  error: ServiceResponseSchema(false, z.void()),
  void: z.void(),
};

/**
 * Base entity schema with common fields for all database entities
 */
export const BaseEntitySchema = z.object({
  id: z.number().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
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
});

/**
 * API index response schema
 */
export const IndexResponseSchema = z.object({
  name: z.string(),
  version: z.string(),
  status: z.string(),
  timestamp: z.string(),
});

// ============================================================================
// USER SCHEMAS - User account management and operations
// ============================================================================

/**
 * Complete user entity schema
 */
export const UserEntitySchema = BaseEntitySchema.extend({
  tenant_id: z.number().optional(),
  status: EntityStatusSchema,
  role: UserRoleSchema,
  email: z.string().email(),
  google_id: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  password: z.string().optional(),
  image_url: z.string().optional(),
  plan: UserPlanSchema,
  prompt_limit: z.number().optional(),
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
 * CAPTCHA verification schema
 */
export const VerifyCaptchaSchema = z.object({
  token: z.string().min(1, 'Captcha token is required'),
});

/**
 * User login credentials schema
 */
export const UserLoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const PasswordResetEntitySchema = BaseEntitySchema.extend({
  user_id: z.number(),
  token: z.string(),
  expiry_date: z.string().datetime(),
});

/**
 * User registration schema
 */
export const UserRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  first_name: z.string(),
  last_name: z.string(),
});

/**
 * Password reset request schema
 */
export const PasswordResetRequestSchema = z.object({
  email: z.string().email(),
});

/**
 * Password update schema using reset token
 */
export const PasswordUpdateSchema = z.object({
  token: z.string(),
  password: z.string(),
});

/**
 * Google OAuth callback schema
 */
export const GoogleLoginCallbackSchema = z.object({
  code: z.string().optional(),
  error: z.string().optional(),
  state: z.string().optional(),
});

/**
 * Login schema with authentication token
 */
export const TokenSchema = z.object({
  token: z.string(),
});

// ============================================================================
// TENANT SCHEMAS - Organization and workspace management
// ============================================================================

/**
 * Complete tenant entity schema
 */
export const TenantEntitySchema = BaseEntitySchema.extend({
  name: z.string(),
  domain: z.string().optional(),
  status: EntityStatusSchema,
  package: TenantPackageSchema,
  ending_date: z.string().datetime().optional(),
});

/**
 * Tenant creation schema
 */
export const TenantCreateSchema = TenantEntitySchema.partial().extend({
  name: z.string().min(1),
  domain: z.string().min(1),
});

/**
 * Tenant update schema
 */
export const TenantUpdateSchema = TenantEntitySchema.partial();

/**
 * Tenant plan entity schema - tracks plan/subscription for each tenant
 */
export const TenantPlanEntitySchema = BaseEntitySchema.extend({
  tenant_id: z.number(),
  package: TenantPackageSchema,
  ending_date: z.string().datetime().optional(),
});

/**
 * Tenant plan creation schema
 */
export const TenantPlanCreateSchema = TenantPlanEntitySchema.partial().extend({
  tenant_id: z.number(),
  package: TenantPackageSchema,
});

/**
 * Tenant plan update schema
 */
export const TenantPlanUpdateSchema = TenantPlanEntitySchema.partial();

// ============================================================================
// MEETING SCHEMAS - Video meeting management and operations
// ============================================================================

/**
 * Meeting entity schema
 */
export const MeetingSchema = BaseEntitySchema.extend({
  tenant_id: z.number(),
  user_id: z.number(),
  meeting_id: z.string(),
  meeting_token: z.string().optional(),
  start_time: z.string(),
  minutes: z.string(),
  meeting_status: MeetingStatusSchema,
});

/**
 * Meeting creation schema
 */
export const MeetingCreateSchema = MeetingSchema.partial().extend({
  start_time: z.string().datetime(),
});

/**
 * Meeting update schema
 */
export const MeetingUpdateSchema = MeetingSchema.partial();

/**
 * Meeting response schema
 */
export const MeetingEntitySchema = BaseEntitySchema.extend({
  user_id: z.number(),
  tenant_id: z.number(),
  meeting_id: z.string(),
  meeting_token: z.string().optional(),
  start_time: z.string(),
  minutes: z.string(),
  meeting_status: z.string(),
});

/**
 * Meeting join request schema
 */
export const MeetingJoinRequestSchema = z.object({
  client: z.object({
    id: z.number(),
    password: z.string().optional(),
  }),
  guest: z.object({
    name: z.string(),
    email: z.string().email().optional(),
    password: z.string().optional(),
  }),
  token: z.string().optional(),
});

// ============================================================================
// KNOWLEDGE SCHEMAS - Knowledge base and document management
// ============================================================================

/**
 * Knowledge base document schema
 */
export const KnowledgeEntitySchema = BaseEntitySchema.extend({
  tenant_id: z.number(),
  connection_id: z.number().optional(),
  file_name: z.string(),
  file_size: z.number(),
  file_type: KnowledgeTypeSchema,
  file_url: z.string(),
  file_id: z.string().optional(),
});

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
    index: z.number(),
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
 * Union schema for all possible simulation actions
 */
export const SimulationActionSchema = z.union([
  GoToUrlActionSchema,
  ClickElementByIndexActionSchema,
  InputTextActionSchema,
  WriteFileActionSchema,
  GetOtpActionSchema,
  DoneActionSchema,
  WaitActionSchema,
  ReloadPageActionSchema,
  OpenNewTabActionSchema,
  NavigateToUrlActionSchema,
]);

/**
 * Model output schema for simulation step
 */
export const SimulationModelOutputSchema = z.object({
  evaluation_previous_goal: z.string().optional(),
  memory: z.string().optional(),
  next_goal: z.string().optional(),
  action: z.array(SimulationActionSchema).optional(),
  thinking: z.string().optional(),
});

/**
 * Result schema for simulation step
 */
export const SimulationResultSchema = z.object({
  is_done: z.boolean(),
  success: z.boolean().optional(),
  long_term_memory: z.string().optional(),
  extracted_content: z.string().optional(),
  include_extracted_content_only_once: z.boolean().optional(),
  include_in_memory: z.boolean().optional(),
  error: z.string().optional(),
  metadata: z
    .object({
      click_x: z.number().optional(),
      click_y: z.number().optional(),
      new_tab_opened: z.boolean().optional(),
      input_x: z.number().optional(),
      input_y: z.number().optional(),
    })
    .optional(),
});

/**
 * Browser tab schema
 */
export const BrowserTabSchema = z.object({
  url: z.string(),
  title: z.string(),
  target_id: z.string(),
  parent_target_id: z.string().nullable(),
});

/**
 * Interacted element schema
 */
export const InteractedElementSchema = z.object({
  node_id: z.number(),
  backend_node_id: z.number(),
  frame_id: z.string().nullable(),
  node_type: z.number(),
  node_value: z.string(),
  node_name: z.string(),
  attributes: z.record(z.string()),
  x_path: z.string(),
  element_hash: z.number(),
  bounds: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
});

/**
 * Browser state schema for simulation step
 */
export const SimulationStateSchema = z.object({
  tabs: z.array(BrowserTabSchema),
  screenshot_path: z.string().nullable(),
  interacted_element: z.array(InteractedElementSchema.nullable()),
  url: z.string(),
  title: z.string(),
});

/**
 * Metadata schema for simulation step
 */
export const SimulationStepMetadataSchema = z.object({
  step_start_time: z.number(),
  step_end_time: z.number(),
  step_number: z.number(),
});

/**
 * Individual simulation step schema
 */
export const SimulationStepSchema = z.object({
  model_output: SimulationModelOutputSchema.nullable(),
  result: z.array(SimulationResultSchema),
  state: SimulationStateSchema,
  metadata: SimulationStepMetadataSchema,
});

/**
 * Complete simulation history schema
 */
export const SimulationHistorySchema = z.object({
  history: z.array(SimulationStepSchema),
});

/**
 * App simulation schema
 */
export const SimulationEntitySchema = BaseEntitySchema.extend({
  connection_id: z.number(),
  agent_id: z.number(),
  job_id: z.string(),
  status: z.string(),
  status_message: z.string(),
  path: z.string(),
  instructions: z.string(),
  num_steps: z.number().int().nonnegative(),
  agent_name: z.string().optional(),
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
  status: z.string(),
  status_message: z.string(),
  num_steps: z.number().int().nonnegative().optional(),
});

/**
 * Simulation answer submission schema
 */
export const SimulationAnswerSchema = z.object({
  answer: z.string().min(1),
});

/**
 * Simulation progress entry schema
 */
export const SimulationProgressEntitySchema = z.object({
  id: z.number(),
  simulation_id: z.number(),
  status: z.string(),
  status_message: z.string().nullable(),
  num_steps: z.number().int().nonnegative().nullable(),
  created_at: z.string(),
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
  tenant_id: z.number(),
  user_id: z.number(),
  connection_id: z.number(),
  agent_name: z.string(),
  agent_type: AgentTypeSchema,
  agent_voice: AgentVoiceSchema,
  agent_description: z.string(),
  instructions: z.string().optional(),
  image_url: z.string().optional(),
  vector_store_id: z.string().optional(),
  pdf_search_index_id: z.string().optional(),
  json_search_index_id: z.string().optional(),
  node_index_id: z.string().optional(),
  edge_index_id: z.string().optional(),
  status: AgentStatusSchema,
  status_message: z.string().optional(),
  tenant: TenantEntitySchema.optional(),
  user: UserEntitySchema.optional(),
  knowledge: z.array(KnowledgeEntitySchema).optional(),
  simulations: z.array(SimulationEntitySchema).optional(),
});

const KnowledgeIdsSchema = z
  .string()
  .transform((str) => JSON.parse(str) as number[])
  .pipe(z.array(z.coerce.number()));

const SimulationIdsSchema = z
  .string()
  .transform((str) => JSON.parse(str) as number[])
  .pipe(z.array(z.coerce.number()));

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
  highlights: z.record(z.array(z.string())).optional(),
});

/**
 * Agent knowledge search request schema
 */
export const AgentKnowledgeSearchRequestSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  searchConfig: AgentSearchConfigSchema.optional(),
});

/**
 * Agent knowledge search response schema
 */
export const AgentKnowledgeSearchResponseSchema = z.object({
  results: z.array(SearchResultSchema),
  totalCount: z.number(),
  query: z.string(),
  searchConfig: AgentSearchConfigSchema.optional(),
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
  pdf_search_index_id: z.string().optional(),
  json_search_index_id: z.string().optional(),
  message: z.string(),
});

/**
 * Agent index callback request schema
 */
export const AgentIndexCallbackRequestSchema = z.object({
  agent_id: z.coerce.number().positive('Agent ID must be a positive number'),
  index_name: z.string().min(1, 'Index name is required'),
  index_type: z.enum(['pdf', 'json'], { message: 'Index type must be pdf or json' as const }),
  status: z.enum(['success', 'failed'], { message: 'Status must be success or failed' }),
  status_message: z.string().optional(),
});

/**
 * Agent index callback response schema
 */
export const AgentIndexCallbackResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// ============================================================================
// CONNECTION SCHEMAS - Connection management (apps and websites)
// ============================================================================

/**
 * Connection entity schema
 */
export const ConnectionEntitySchema = BaseEntitySchema.extend({
  tenant_id: z.number(),
  name: z.string(),
  type: ConnectionTypeSchema,
  url: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  allowed_domains: z.array(z.string()).optional().default([]),
});

/**
 * Connection creation schema
 */
export const ConnectionCreateSchema = ConnectionEntitySchema.partial().extend({
  type: ConnectionTypeSchema,
  name: z.string().min(1),
  url: z.string(),
  allowed_domains: z.array(z.string()).optional().default([]),
});

/**
 * Connection update schema
 */
export const ConnectionUpdateSchema = ConnectionEntitySchema.partial();

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
  widget_position: z.enum(['bottom_left', 'bottom_right']),
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
export const IntegrationEntitySchema = BaseEntitySchema.extend({
  connection_id: z.number(),
  agent_id: z.number(),
  type: IntegrationTypeSchema,
  settings: z.union([WidgetSettingsDataSchema, SlackSettingsDataSchema]),
  status: EntityStatusSchema,
  marketrix_id: z.string(),
  marketrix_key: z.string(),
  snippet: z.string().optional(),
});

/**
 * Integration information schema
 */
export const IntegrationInfoSchema = IntegrationEntitySchema.extend({
  connection: ConnectionEntitySchema.partial(),
  tenant: TenantEntitySchema.partial(),
  user: UserEntitySchema.partial(),
  agent: AgentEntitySchema.partial(),
});

/**
 * Connection with integrations schema - matches API response structure
 */
export const ConnectionWithIntegrationsSchema = ConnectionEntitySchema.extend({
  integrations: z.array(IntegrationEntitySchema),
  agents: z.array(AgentEntitySchema).optional(),
});

/**
 * Integration creation schema
 */
export const IntegrationCreateSchema = IntegrationEntitySchema.partial().extend({
  connection_id: z.number().positive(),
  agent_id: z.number().positive(),
  type: IntegrationTypeSchema,
  settings: z.union([WidgetSettingsDataSchema, SlackSettingsDataSchema]).optional(),
});

/**
 * Integration update schema
 */
export const IntegrationUpdateSchema = IntegrationEntitySchema.partial();

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
  .refine(
    (data) => (data.marketrix_id && data.marketrix_key) ?? (data.agent_id && data.connection_id),
    {
      message:
        'Either marketrix_id + marketrix_key or both agent_id + connection_id must be provided',
    }
  );

/**
 * Chat response entity schema
 */
export const ChatResponseSchema = z.object({
  text: z.string(),
});

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
    tenant_name: z.string().optional(),
    tenant_domain: z.string().optional(),
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
  tenant_id: z.number(),
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
 * Meeting creation data schema for services
 */
export const MeetingCreationDataSchema = z.object({
  start_time: z.string(),
  minutes: z.string(),
  tenant_id: z.number(),
  user_id: z.number(),
});

/**
 * Meeting end data schema for services
 */
export const MeetingEndDataSchema = z.object({
  meeting_id: z.string(),
});

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
 * Usage stats response schema
 */
export const UsageStatsSchema = z.object({
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
  tenant_id: z.number(),
  chat_count: z.number(),
  prompt_text: z.string(),
  metadata: z.record(z.string(), z.string()).optional(),
});

/**
 * State auth payload schema
 */
export const StateAuthPayloadSchema = z.object({
  ts: z.number(),
  redirect_uri: z.string(),
});

/**
 * State auth result schema
 */
export const StateAuthResultSchema = z.object({
  redirect_uri: z.string(),
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

/**
 * Meeting email data schema
 */
export const MeetingEmailDataSchema = MailOptionsDataSchema;

// ============================================================================
// CONSTANTS - System-wide constants and configuration values
// ============================================================================

/**
 * Initial tenant ID for system setup
 */
export const INITIAL_TENANT_ID = 1;

/**
 * Initial prompt limit for new users
 */
export const INITIAL_PROMPT_LIMIT = 50;

/**
 * OAuth authentication scopes
 */
export const AUTH_SCOPES = ['openid', 'email', 'profile'];

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
// TYPE EXPORTS - Essential TypeScript types for external use
// ============================================================================

/**
 * Core enum types
 */
export type UserRole = z.infer<typeof UserRoleSchema>;
export type UserPlan = z.infer<typeof UserPlanSchema>;
export type EntityStatus = z.infer<typeof EntityStatusSchema>;
export type TenantPackage = z.infer<typeof TenantPackageSchema>;
export type AgentType = z.infer<typeof AgentTypeSchema>;
export type AgentVoice = z.infer<typeof AgentVoiceSchema>;
export type AgentStatus = z.infer<typeof AgentStatusSchema>;
export type KnowledgeType = z.infer<typeof KnowledgeTypeSchema>;
export type MeetingStatus = z.infer<typeof MeetingStatusSchema>;
export type ChatStatus = z.infer<typeof ChatRoleSchema>;
export type ChatSource = z.infer<typeof ChatSourceSchema>;
export type InstructionType = z.infer<typeof InstructionTypeSchema>;
export type ConnectionType = z.infer<typeof ConnectionTypeSchema>;
export type IntegrationType = z.infer<typeof IntegrationTypeSchema>;
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
export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;
export type PasswordUpdateData = z.infer<typeof PasswordUpdateSchema>;
export type GoogleLoginCallbackData = z.infer<typeof GoogleLoginCallbackSchema>;
export type StateAuthPayload = z.infer<typeof StateAuthPayloadSchema>;
export type StateAuthResult = z.infer<typeof StateAuthResultSchema>;
export type UploadUserLogoData = z.infer<typeof UploadUserLogoDataSchema>;
export type TenantReadData = z.infer<typeof TenantCreateSchema>;
export type TenantUpdateData = z.infer<typeof TenantUpdateSchema>;
export type IntegrationInfoData = z.infer<typeof IntegrationInfoSchema>;
export type MeetingCreationData = z.infer<typeof MeetingCreationDataSchema>;
export type MeetingEndData = z.infer<typeof MeetingEndDataSchema>;
export type MeetingUpdateData = z.infer<typeof MeetingUpdateSchema>;
export type AgentCreationData = z.infer<typeof AgentCreateSchema>;
export type AgentUpdateData = z.infer<typeof AgentUpdateSchema>;
export type AgentSearchConfig = z.infer<typeof AgentSearchConfigSchema>;
export type SearchDocument = z.infer<typeof SearchDocumentSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type AgentKnowledgeSearchRequest = z.infer<typeof AgentKnowledgeSearchRequestSchema>;
export type AgentKnowledgeSearchResponse = z.infer<typeof AgentKnowledgeSearchResponseSchema>;
export type AgentSimulationIndexRequest = z.infer<typeof AgentSimulationIndexRequestSchema>;
export type AgentSimulationIndexResponse = z.infer<typeof AgentSimulationIndexResponseSchema>;
export type AgentIndexCallbackRequest = z.infer<typeof AgentIndexCallbackRequestSchema>;
export type AgentIndexCallbackResponse = z.infer<typeof AgentIndexCallbackResponseSchema>;
export type FileUploadResponse = z.infer<typeof FileUploadResponseSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatResponseData = z.infer<typeof ChatResponseSchema>;
export type MailOptionsData = z.infer<typeof MailOptionsDataSchema>;
export type MeetingEmailData = z.infer<typeof MeetingEmailDataSchema>;

// ============================================================================
// MODEL ATTRIBUTES - TypeScript interfaces for Sequelize models
// ============================================================================

/**
 * Model attribute types for Sequelize models
 */
export type UserData = z.infer<typeof UserEntitySchema>;
export type TenantData = z.infer<typeof TenantEntitySchema>;
export type TenantPlanData = z.infer<typeof TenantPlanEntitySchema>;
export type AgentData = z.infer<typeof AgentEntitySchema>;
export type MeetingData = z.infer<typeof MeetingEntitySchema>;
export type KnowledgeData = z.infer<typeof KnowledgeEntitySchema>;
export type ConnectionData = z.infer<typeof ConnectionEntitySchema>;
export type ConnectionCreateData = z.infer<typeof ConnectionCreateSchema>;
export type ConnectionUpdateData = z.infer<typeof ConnectionUpdateSchema>;
export type ConnectionWithIntegrationsData = z.infer<typeof ConnectionWithIntegrationsSchema>;
export type IntegrationData = z.infer<typeof IntegrationEntitySchema>;
export type IntegrationCreateData = z.infer<typeof IntegrationCreateSchema>;
export type IntegrationUpdateData = z.infer<typeof IntegrationUpdateSchema>;
export type WidgetSettingsData = z.infer<typeof WidgetSettingsDataSchema>;
export type SlackSettingsData = z.infer<typeof SlackSettingsDataSchema>;
export type WidgetSettingsKey = keyof z.infer<typeof WidgetSettingsDataSchema>;
export type WidgetChip = z.infer<typeof WidgetChipSchema>;
export type SlackSettingsKey = keyof z.infer<typeof SlackSettingsDataSchema>;
export type SimulationData = z.infer<typeof SimulationEntitySchema>;
export type SimulationStepData = z.infer<typeof SimulationStepSchema>;
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
export type PasswordResetData = z.infer<typeof PasswordResetEntitySchema>;
export type ChatData = z.infer<typeof ChatEntitySchema>;
export type UsageStatsData = z.infer<typeof UsageStatsSchema>;
export type SimulationProgressData = z.infer<typeof SimulationProgressEntitySchema>;
export type MindMapEdgeData = z.infer<typeof MindMapEdgeSchema>;
export type MindMapNodeData = z.infer<typeof MindMapNodeSchema>;
export type MindMapData = z.infer<typeof MindMapSchema>;
