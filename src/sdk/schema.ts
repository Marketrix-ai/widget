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
export const EntityStatusSchema = z.enum(['created', 'active', 'suspended']);
export const TenantPackageSchema = z.enum(['free', 'starter', 'pro', 'enterprise']);
export const AgentTypeSchema = z.enum(['human', 'ai']);
export const AgentVoiceSchema = z.enum(['male', 'female']);
export const KnowledgeTypeSchema = z.enum(['document', 'video']);
export const MeetingStatusSchema = z.enum(['not_started', 'in_progress', 'ended', 'cancelled']);
export const ChatRoleSchema = z.enum(['user', 'agent']);
export const ChatSourceSchema = z.enum(['taskpilot', 'widget', 'app']);
export const InstructionTypeSchema = z.enum(['tell', 'show', 'do']);
export const TargetTypeSchema = z.enum(['live', 'app']);
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
  file: z.instanceof(File),
  connection_id: z.coerce.number().optional(),
});

// ============================================================================
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
  logo_url: z.string().optional(),
  vector_store_id: z.string().optional(),
  tenant: TenantEntitySchema.optional(),
  user: UserEntitySchema.optional(),
  knowledge: z.array(KnowledgeEntitySchema).optional(),
});

const KnowledgeIdsSchema = z
  .string()
  .transform((str) => JSON.parse(str))
  .pipe(z.array(z.number()));

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
  file: z.instanceof(File),
  knowledge_ids: KnowledgeIdsSchema,
});

/**
 * Agent update schema
 */
export const AgentUpdateSchema = AgentEntitySchema.partial().extend({
  file: z.instanceof(File),
  knowledge_ids: KnowledgeIdsSchema,
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
});

/**
 * Connection creation schema
 */
export const ConnectionCreateSchema = ConnectionEntitySchema.partial().extend({
  type: ConnectionTypeSchema,
  name: z.string().min(1),
  url: z.string(),
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
 * Zod schema for widget settings - All fields are mandatory
 */
export const WidgetSettingsDataSchema = z.object({
  widget_enabled: z.boolean(),
  widget_appearance: z.enum(['default', 'compact', 'full']),
  widget_position: z.enum(['bottom-left', 'bottom-right']),
  widget_device: z.enum(['desktop', 'mobile', 'desktop_mobile']),
  widget_header: z.string().min(1, "Widget header is required"),
  widget_body: z.string().min(1, "Widget body is required"),
  widget_greeting: z.string().min(1, "Widget greeting is required"),
  widget_feature_tell: z.boolean(),
  widget_feature_show: z.boolean(),
  widget_feature_do: z.boolean(),
  widget_feature_request_human: z.boolean(),
  widget_background_color: z.string().min(1, "Widget background color is required"),
  widget_text_color: z.string().min(1, "Widget text color is required"),
  widget_border_color: z.string().min(1, "Widget border color is required"),
  widget_accent_color: z.string().min(1, "Widget accent color is required"),
  widget_secondary_color: z.string().min(1, "Widget secondary color is required"),
  widget_border_radius: z.string().min(1, "Widget border radius is required"),
  widget_font_size: z.string().min(1, "Widget font size is required"),
  widget_width: z.string().min(1, "Widget width is required"),
  widget_height: z.string().min(1, "Widget height is required"),
  widget_shadow: z.string().min(1, "Widget shadow is required"),
  widget_animation_duration: z.string().min(1, "Widget animation duration is required"),
  widget_fade_duration: z.string().min(1, "Widget fade duration is required"),
  widget_bounce_effect: z.boolean(),
  widget_chips: z.array(WidgetChipSchema).min(0, "Widget chips array is required"),
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
 * Integration creation schema
 */
export const IntegrationCreateSchema = IntegrationEntitySchema.partial().extend({
  connection_id: z.number().positive(),
  type: IntegrationTypeSchema,
  settings: z.union([WidgetSettingsDataSchema, SlackSettingsDataSchema]).optional(),
});

/**
 * Integration update schema
 */
export const IntegrationUpdateSchema = IntegrationEntitySchema.partial();

// ============================================================================
// SIMULATION SCHEMAS - Application simulation and testing
// ============================================================================

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
});

/**
 * Simulation creation schema
 */
export const SimulationCreateSchema = SimulationEntitySchema.partial().extend({
  connection_id: z.number(),
  agent_id: z.number(),
  instructions: z.string(),
});

/**
 * Simulation update schema
 */
export const SimulationUpdateSchema = z.object({
  status: z.string(),
  status_message: z.string(),
});

// ============================================================================
// TOUR SCHEMAS - Interactive tour and guidance system
// ============================================================================

export const TourStepSchema = z.object({
  step_number: z.number(),
  description: z.string(),
  action: z.string(),
  element: z.string(),
  id: z.string().optional(),
  class: z.string().optional(),
  style: z.string().optional(),
  xpath: z.string().optional(),
});

export const TourAnswerSchema = z.object({
  steps: z.array(TourStepSchema),
});

/**
 * Tour entity schema
 */
export const TourEntitySchema = BaseEntitySchema.extend({
  connection_id: z.number(),
  question: z.string(),
  answer: TourAnswerSchema,
  target: TargetTypeSchema,
});

/**
 * Tour creation schema
 */
export const TourCreateSchema = TourEntitySchema.partial().extend({
  question: z.string().min(1),
  answer: TourAnswerSchema,
  target: TargetTypeSchema,
});

// ============================================================================
// CHAT SCHEMAS - AI-powered chat and conversation management
// ============================================================================

/**
 * Chat request schema
 */
export const ChatRequestSchema = z.object({
  integration_id: z.string(),
  chat_id: z.string(),
  content: z.string(),
});

/**
 * Chat response entity schema
 */
export const ChatResponseSchema = z.object({
  text: z.string(),
  audio: z.string().url(),
});

// ============================================================================
// ACTIVITY LOG SCHEMAS - System activity tracking and auditing
// ============================================================================

/**
 * Action log entity schema
 */
export const ActionLogEntitySchema = z.object({
  tenant_id: z.number(),
  user_id: z.number(),
  type: ActionLogTypeSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Action log creation schema
 */
export const ActionLogCreateSchema = ActionLogEntitySchema.partial().extend({
  type: ActionLogTypeSchema,
});

// ============================================================================
// INSTRUCTION SCHEMAS - Business rule and automation rule management
// ============================================================================

/**
 * Instruction entity schema
 */
export const InstructionEntitySchema = BaseEntitySchema.extend({
  type: InstructionTypeSchema,
  message: z.string(),
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
  file: z.instanceof(File),
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
  metadata: z.record(z.string(), z.unknown()).optional(),
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
  context: z.record(z.string(), z.unknown()),
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
export type KnowledgeType = z.infer<typeof KnowledgeTypeSchema>;
export type MeetingStatus = z.infer<typeof MeetingStatusSchema>;
export type ChatStatus = z.infer<typeof ChatRoleSchema>;
export type ChatSource = z.infer<typeof ChatSourceSchema>;
export type InstructionType = z.infer<typeof InstructionTypeSchema>;
export type TargetType = z.infer<typeof TargetTypeSchema>;
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
export type AgentData = z.infer<typeof AgentEntitySchema>;
export type MeetingData = z.infer<typeof MeetingEntitySchema>;
export type KnowledgeData = z.infer<typeof KnowledgeEntitySchema>;
export type ConnectionData = z.infer<typeof ConnectionEntitySchema>;
export type ConnectionCreateData = z.infer<typeof ConnectionCreateSchema>;
export type ConnectionUpdateData = z.infer<typeof ConnectionUpdateSchema>;
export type IntegrationData = z.infer<typeof IntegrationEntitySchema>;
export type IntegrationCreateData = z.infer<typeof IntegrationCreateSchema>;
export type IntegrationUpdateData = z.infer<typeof IntegrationUpdateSchema>;
export type WidgetSettingsData = z.infer<typeof WidgetSettingsDataSchema>;
export type SlackSettingsData = z.infer<typeof SlackSettingsDataSchema>;
export type WidgetSettingsKey = keyof z.infer<typeof WidgetSettingsDataSchema>;
export type SlackSettingsKey = keyof z.infer<typeof SlackSettingsDataSchema>;
export type SimulationData = z.infer<typeof SimulationEntitySchema>;
export type TourData = z.infer<typeof TourEntitySchema>;
export type TourAnswerData = z.infer<typeof TourAnswerSchema>;
export type TourStepData = z.infer<typeof TourStepSchema>;
export type InstructionData = z.infer<typeof InstructionEntitySchema>;
export type PasswordResetData = z.infer<typeof PasswordResetEntitySchema>;
export type ChatData = z.infer<typeof ChatEntitySchema>;
export type UsageStatsData = z.infer<typeof UsageStatsSchema>;
