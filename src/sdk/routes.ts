/**
 * API Routes Contract Definition
 *
 * This file defines the Marketrix API contract, using ts-rest for type safety and documentation.
 * It includes all endpoints grouped by functionality, with useful descriptions.
 *
 * Route Categories:
 * - Root: System health and index endpoints
 * - Auth: User authentication, OAuth, and password management
 * - User: User account management and operations
 * - Tenant: Organization and workspace management
 * - Agent: AI agent creation, management, and operations
 * - Meeting: Video meeting scheduling, joining, and management
 * - Chat: AI-powered chat and conversation management
 * - Knowledge: Knowledge base and document management
 * - Integration: Third-party integrations (e.g., Slack, widgets)
 * - Connection: External service connection management
 * - Simulation: Application simulation and testing
 * - Tour: Interactive tour and guidance system
 * - Activity Log: System activity tracking and auditing
 * - App Config: In-app configuration management
 * - TaskPilot: AI prompt and automation management
 * - Rule: Business rule and automation rule management
 * - Migration: Database migration and system updates
 * - File: File upload and management
 *
 * All routes include proper HTTP status codes:
 * - 200: Success
 * - 400: Bad Request
 * - 401: Unauthorized (authentication required)
 * - 403: Forbidden (insufficient permissions)
 * - 500: Internal Server Error
 */

import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import {
  ActionLogCreateSchema,
  ActionLogEntitySchema,
  ActionLogTypeSchema,
  AgentCreateSchema,
  AgentEntitySchema,
  AgentIndexCallbackRequestSchema,
  AgentIndexCallbackResponseSchema,
  AgentSimulationIndexRequestSchema,
  AgentSimulationIndexResponseSchema,
  AgentUpdateSchema,
  AgentVideoGenerateRequestSchema,
  BatchUserCreateResultSchema,
  BatchUserCreateSchema,
  BrowserConfigSchema,
  BrowserTypeSchema,
  ChatRequestSchema,
  ChatResponseSchema,
  CheckoutSessionSchema,
  ConnectionCreateSchema,
  ConnectionEntitySchema,
  ConnectionTypeSchema,
  ConnectionUpdateSchema,
  EntityStatusSchema,
  FailureAnalysisSchema,
  FileSchema,
  FileUploadResponseSchema,
  HealthResponseSchema,
  IndexResponseSchema,
  IntegrationCreateSchema,
  IntegrationEntitySchema,
  IntegrationTypeSchema,
  IntegrationUpdateSchema,
  KnowledgeEntitySchema,
  KnowledgeTypeSchema,
  MeetingCreateSchema,
  MeetingEntitySchema,
  MeetingJoinRequestSchema,
  MeetingUpdateSchema,
  MigrationPrepareSchema,
  MigrationRunSchema,
  MindMapSchema,
  PasswordResetRequestSchema,
  PasswordUpdateSchema,
  PlanCatalogSchema,
  PlanInfoSchema,
  PortalSessionSchema,
  PublicConfigSchema,
  QADocumentCreateSchema,
  QADocumentEntitySchema,
  QADocumentProcessingResponseSchema,
  QADocumentStatusSchema,
  QAHealingAttemptEntitySchema,
  QARunEntitySchema,
  QATestResultEntitySchema,
  QATestVersionEntitySchema,
  R,
  RrwebSessionEntitySchema,
  RrwebSessionUpsertSchema,
  SimulationAnswerSchema,
  SimulationCreateSchema,
  SimulationEntitySchema,
  SimulationLoggingUserSchema,
  SimulationProgressEntitySchema,
  SimulationStepSchema,
  SimulationStepSummarySchema,
  SimulationUpdateSchema,
  SlackSettingsDataSchema,
  StripeCheckoutSchema,
  StripeConfigSchema,
  StripeDowngradeResponseSchema,
  StripeDowngradeSchema,
  StripePortalSchema,
  StripePricingSchema,
  StripeTrialSchema,
  StripeWebhookEventSchema,
  SubscriptionUsageSchema,
  TenantCreateSchema,
  TenantEntitySchema,
  TenantUpdateSchema,
  TokenSchema,
  TourEntitySchema,
  TourStepSchema,
  TrialSubscriptionSchema,
  UrlGuideCreateSchema,
  UrlGuideEntitySchema,
  UrlGuideUpdateSchema,
  UserEntitySchema,
  UserLoginSchema,
  UserQuotaSchema,
  UserRegisterSchema,
  UserUpdateSchema,
  WidgetSettingsDataSchema,
} from './schema';

// Initialize the contract
const c = initContract();

// Main contract with all routes
const contract = c.router({
  // ============================================================================
  // ROOT ROUTES - Basic system endpoints
  // ============================================================================

  getIndex: {
    method: 'GET' as const,
    summary: 'Get API index information and basic system details',
    description: 'Returns general API information, version, and available endpoints',
    path: '/',
    responses: { 200: R.success(IndexResponseSchema) },
  },

  getHealth: {
    method: 'GET' as const,
    summary: 'Health check endpoint for monitoring system status',
    description: 'Returns current system health, database connectivity, and service status',
    path: '/health',
    responses: { 200: R.success(HealthResponseSchema) },
  },

  getPublicConfig: {
    method: 'GET' as const,
    summary: 'Get public client configuration',
    description: 'Returns widget key and widget ID. No auth. Values are stored in backend env only.',
    path: '/config/public',
    responses: { 200: R.success(PublicConfigSchema), 500: R.error },
  },

  // ============================================================================
  // AUTHENTICATION ROUTES - User authentication and authorization
  // ============================================================================

  authPwRegister: {
    method: 'POST' as const,
    summary: 'Register new user account with email and password',
    description: 'Creates new user account and returns user entity with authentication token',
    path: '/auth/pw/register',
    body: UserRegisterSchema,
    responses: { 200: R.success(UserEntitySchema), 400: R.error, 500: R.error },
  },

  authPwLogin: {
    method: 'POST' as const,
    summary: 'Authenticate user with email and password credentials',
    description: 'Validates credentials and returns authentication token and user data',
    path: '/auth/pw/login',
    body: UserLoginSchema,
    responses: { 200: R.success(TokenSchema), 400: R.error, 401: R.error, 500: R.error },
  },

  authPwReset: {
    method: 'POST' as const,
    summary: 'Initiate password reset process',
    description: "Sends password reset email to user's registered email address",
    path: '/auth/pw/reset',
    body: PasswordResetRequestSchema,
    responses: { 200: R.success(z.void()), 400: R.error, 500: R.error },
  },

  authPwUpdate: {
    method: 'PUT' as const,
    summary: 'Update user password using reset token',
    description: 'Allows user to set new password after receiving reset token',
    path: '/auth/pw/reset',
    body: PasswordUpdateSchema,
    responses: { 200: R.success(z.void()), 400: R.error, 401: R.error, 500: R.error },
  },

  authRefreshToken: {
    method: 'GET' as const,
    summary: 'Refresh current authentication token',
    description: 'Checks if provided token is valid and returns a new token',
    path: '/auth/refresh',
    responses: { 200: R.success(TokenSchema), 400: R.error, 401: R.error, 500: R.error },
  },

  authMe: {
    method: 'GET' as const,
    summary: 'Get current authenticated user and tenant information',
    description: 'Returns user profile and tenant data based on JWT token',
    path: '/auth/me',
    responses: {
      200: R.success(
        z.object({
          user: UserEntitySchema,
          tenant: TenantEntitySchema.nullable(),
        }),
      ),
      401: R.error,
      500: R.error,
    },
  },

  // ============================================================================
  // ONBOARDING ROUTES - User and tenant onboarding
  // ============================================================================

  onboard: {
    method: 'POST' as const,
    summary: 'Complete user onboarding in one atomic operation',
    description:
      'Creates tenant, updates user status, invites team members, and returns fresh token with updated claims',
    path: '/onboard',
    body: z.object({
      name: z.string().min(1).max(45),
      domain: z.string().min(1).max(200),
      team_emails: z.array(z.string().email()).optional().default([]),
    }),
    responses: {
      200: R.success(
        z.object({
          token: z.string(),
          tenant: TenantEntitySchema,
        }),
      ),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  // ============================================================================
  // MEETING ROUTES - Video meeting management and operations
  // ============================================================================

  meetingCreate: {
    method: 'POST' as const,
    summary: 'Create a new video meeting session',
    description: 'Creates meeting room with specified settings and returns meeting details',
    path: '/meeting',
    body: MeetingCreateSchema,
    responses: { 200: R.success(MeetingEntitySchema), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  meetingSearch: {
    method: 'GET' as const,
    summary: 'Search and filter meetings by various criteria',
    description: 'Returns list of meetings matching search parameters (tenant, client, user)',
    path: '/meeting',
    query: z.object({
      tenant_id: z.coerce.number().optional(),
      client_id: z.coerce.number().optional(),
      user_id: z.coerce.number().optional(),
    }),
    responses: { 200: R.success(z.array(MeetingEntitySchema)), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  meetingCount: {
    method: 'GET' as const,
    summary: 'Get total count of meetings for a tenant',
    description: 'Returns number of meetings associated with specified tenant',
    path: '/meeting/count',
    query: z.object({ tenant_id: z.coerce.number().optional() }),
    responses: { 200: R.success(z.number()), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  meetingGet: {
    method: 'GET' as const,
    summary: 'Get specific meeting details by ID',
    description: 'Returns complete meeting information including participants and settings',
    path: '/meeting/:meeting_id',
    pathParams: z.object({ meeting_id: z.string() }),
    responses: { 200: R.success(MeetingEntitySchema), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  meetingUpdate: {
    method: 'PUT' as const,
    summary: 'Update meeting settings and configuration',
    description: 'Modifies meeting properties like title, duration, or participant settings',
    path: '/meeting/:meeting_id',
    pathParams: z.object({ meeting_id: z.string() }),
    body: MeetingUpdateSchema,
    responses: { 200: R.success(MeetingEntitySchema), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  meetingDelete: {
    method: 'DELETE' as const,
    summary: 'Delete a meeting and clean up associated resources',
    description: 'Removes meeting from system and cancels any scheduled sessions',
    path: '/meeting/:meeting_id',
    pathParams: z.object({ meeting_id: z.string() }),
    responses: { 200: R.success(z.void()), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  meetingJoin: {
    method: 'POST' as const,
    summary: 'Join an existing meeting session',
    description: 'Authenticates user and provides meeting access credentials',
    path: '/meeting/:meeting_id/join',
    pathParams: z.object({ meeting_id: z.string() }),
    body: MeetingJoinRequestSchema,
    responses: { 200: R.success(TokenSchema), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  meetingEnd: {
    method: 'POST' as const,
    summary: 'End an active meeting session',
    description: 'Terminates meeting and updates participant status',
    path: '/meeting/:meeting_id/end',
    pathParams: z.object({ meeting_id: z.string() }),
    body: z.void(),
    responses: { 200: R.success(z.void()), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  // ============================================================================
  // TENANT ROUTES - Organization and workspace management
  // ============================================================================

  tenantCreate: {
    method: 'POST' as const,
    summary: 'Create a new tenant organization',
    description: 'Creates new tenant with specified settings and returns tenant entity',
    path: '/tenant',
    body: TenantCreateSchema,
    responses: { 200: R.success(TenantEntitySchema), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  tenantSearch: {
    method: 'GET' as const,
    summary: 'Search and filter tenants by various criteria',
    description: 'Returns list of tenants matching search parameters (name, domain, email, etc.)',
    path: '/tenant',
    query: z.object({
      name: z.string().optional(),
      domain: z.string().optional(),
      email: z.string().email().optional(),
      app_id: z.coerce.number().optional(),
      tenant_id: z.coerce.number().optional(),
      user_id: z.coerce.number().optional(),
    }),
    responses: { 200: R.success(z.array(TenantEntitySchema)), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  tenantGet: {
    method: 'GET' as const,
    summary: 'Get specific tenant details by ID',
    description: 'Returns complete tenant information including settings and configuration',
    path: '/tenant/:tenant_id',
    pathParams: z.object({ tenant_id: z.coerce.number() }),
    responses: { 200: R.success(TenantEntitySchema), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  tenantUpdate: {
    method: 'PUT' as const,
    summary: 'Update tenant settings and configuration',
    description: 'Modifies tenant properties like name, domain, or feature settings',
    path: '/tenant/:tenant_id',
    pathParams: z.object({ tenant_id: z.coerce.number() }),
    body: TenantUpdateSchema,
    responses: { 200: R.success(TenantEntitySchema), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  tenantDelete: {
    method: 'DELETE' as const,
    summary: 'Delete tenant and all associated data',
    description: 'Removes tenant from system and cleans up all related resources',
    path: '/tenant/:tenant_id',
    pathParams: z.object({ tenant_id: z.coerce.number() }),
    responses: { 200: R.success(z.void()), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  // ============================================================================
  // CONNECTION ROUTES - App and website connection management
  // ============================================================================

  connectionCreate: {
    method: 'POST' as const,
    summary: 'Create a new connection',
    description: 'Creates a new app or website connection for a tenant',
    path: '/connection',
    body: ConnectionCreateSchema,
    responses: { 200: R.success(ConnectionEntitySchema), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  connectionSearch: {
    method: 'GET' as const,
    summary: 'Search connections for tenant',
    description:
      'Returns connections for the authenticated tenant, optionally filtered by type, always includes integrations',
    path: '/connections',
    query: z.object({
      type: ConnectionTypeSchema.optional(),
    }),
    responses: {
      200: R.success(
        z.array(
          ConnectionEntitySchema.extend({
            integrations: z.array(IntegrationEntitySchema),
          }),
        ),
      ),
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  connectionGet: {
    method: 'GET' as const,
    summary: 'Get connection by ID',
    description: 'Returns specific connection details by connection ID, always includes integrations',
    path: '/connection/:connection_id',
    pathParams: z.object({ connection_id: z.coerce.number() }),
    responses: {
      200: R.success(
        ConnectionEntitySchema.extend({
          integrations: z.array(IntegrationEntitySchema),
        }),
      ),
      404: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  connectionUpdate: {
    method: 'PUT' as const,
    summary: 'Update connection',
    description: 'Updates connection details and configuration',
    path: '/connection/:connection_id',
    pathParams: z.object({ connection_id: z.coerce.number() }),
    body: ConnectionUpdateSchema,
    responses: {
      200: R.success(ConnectionEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      404: R.error,
      500: R.error,
    },
  },

  connectionDelete: {
    method: 'DELETE' as const,
    summary: 'Delete connection',
    description: 'Removes a connection and all associated integrations',
    path: '/connection/:connection_id',
    pathParams: z.object({ connection_id: z.coerce.number() }),
    responses: { 200: R.success(z.void()), 401: R.error, 403: R.error, 404: R.error, 500: R.error },
  },

  // ============================================================================
  // INTEGRATION ROUTES - Widget, Slack, and other integration management
  // ============================================================================

  integrationCreate: {
    method: 'POST' as const,
    summary: 'Create a new integration',
    description: 'Creates a new integration (widget, slack, etc.) for a connection',
    path: '/integration',
    body: IntegrationCreateSchema,
    responses: { 200: R.success(IntegrationEntitySchema), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  integrationSearch: {
    method: 'GET' as const,
    summary: 'Search integrations for tenant',
    description: 'Search integrations by type, connection, marketrix_id, or marketrix_key',
    path: '/integration',
    query: z.object({
      type: IntegrationTypeSchema.optional(),
      connection_id: z.coerce.number().optional(),
      marketrix_id: z.string().optional(),
      marketrix_key: z.string().optional(),
    }),
    responses: { 200: R.success(z.array(IntegrationEntitySchema)), 401: R.error, 403: R.error, 500: R.error },
  },

  integrationGetDefaults: {
    method: 'GET' as const,
    summary: 'Get default settings for integration type',
    description: 'Returns default settings for the specified integration type (widget or slack)',
    path: '/integration/defaults/:type',
    pathParams: z.object({ type: IntegrationTypeSchema }),
    responses: {
      200: R.success(z.union([WidgetSettingsDataSchema, SlackSettingsDataSchema])),
      400: R.error,
      500: R.error,
    },
  },

  integrationGet: {
    method: 'GET' as const,
    summary: 'Get integration by ID',
    description: 'Returns specific integration details by integration ID including snippet code',
    path: '/integration/:integration_id',
    pathParams: z.object({ integration_id: z.coerce.number() }),
    responses: { 200: R.success(IntegrationEntitySchema), 404: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  integrationUpdate: {
    method: 'PUT' as const,
    summary: 'Update integration',
    description: 'Updates integration settings and configuration',
    path: '/integration/:integration_id',
    pathParams: z.object({ integration_id: z.coerce.number() }),
    body: IntegrationUpdateSchema,
    responses: {
      200: R.success(IntegrationEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      404: R.error,
      500: R.error,
    },
  },

  integrationDelete: {
    method: 'DELETE' as const,
    summary: 'Delete integration',
    description: 'Removes an integration from a connection',
    path: '/integration/:integration_id',
    pathParams: z.object({ integration_id: z.coerce.number() }),
    responses: { 200: R.success(z.void()), 401: R.error, 403: R.error, 404: R.error, 500: R.error },
  },

  // ============================================================================
  // CHAT ROUTES - AI-powered chat and conversation management
  // ============================================================================

  chatCreate: {
    method: 'POST' as const,
    summary: 'Create a new chat thread',
    description: 'Initializes new chat thread and returns session id',
    path: '/chat',
    body: z.void(),
    responses: { 200: R.success(z.string()), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  chatSearch: {
    method: 'GET' as const,
    summary: 'Search chat submitted by user',
    description: 'Returns list of chats submitted by user',
    path: '/chat',
    query: z.object({
      user_id: z.coerce.number().optional(),
      chat_id: z.coerce.number().optional(),
    }),
    responses: { 200: R.success(UserQuotaSchema), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  chatTell: {
    method: 'POST' as const,
    summary: 'Request tell mode response for given content',
    description: 'Processes explanation request and returns AI response (voice+text) as a data url',
    path: '/chat/:chat_id/tell',
    body: ChatRequestSchema,
    pathParams: z.object({ chat_id: z.string() }),
    responses: { 200: R.success(ChatResponseSchema), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  chatShow: {
    method: 'POST' as const,
    summary: 'Request show mode response for given content',
    description: 'Processes user introduction and returns AI response (voice+text) as a data url',
    path: '/chat/:chat_id/show',
    body: ChatRequestSchema,
    pathParams: z.object({ chat_id: z.string() }),
    responses: { 200: R.success(ChatResponseSchema), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  chatDo: {
    method: 'POST' as const,
    summary: 'Request do mode response for given content',
    description: 'Creates prompt with specified configuration and returns creation response',
    path: '/chat/:chat_id/do',
    body: ChatRequestSchema,
    pathParams: z.object({ chat_id: z.string() }),
    responses: { 200: R.success(UserQuotaSchema), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  chatStop: {
    method: 'POST' as const,
    summary: 'Stop a running show/do mode task',
    description: 'Stops an ongoing task for the given chat_id',
    path: '/chat/:chat_id/stop',
    body: z.object({
      task_id: z.string().optional(),
    }),
    pathParams: z.object({ chat_id: z.string() }),
    responses: {
      200: R.success(z.object({ status: z.string(), message: z.string() })),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  // ============================================================================
  // USER ROUTES - User account management and operations
  // ============================================================================

  userSearch: {
    method: 'GET' as const,
    summary: 'Search and filter users by tenant',
    description: 'Returns list of users associated with specified tenant',
    path: '/user',
    query: z.object({
      tenant_id: z.coerce.number().optional(),
      status: EntityStatusSchema.optional(),
    }),
    responses: { 200: R.success(z.array(UserEntitySchema)), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  userCreateBatch: {
    method: 'POST' as const,
    summary: 'Create multiple users in batch operation',
    description: 'Processes bulk user creation and returns results for each user',
    path: '/user/batch',
    body: BatchUserCreateSchema,
    responses: {
      200: R.success(z.array(BatchUserCreateResultSchema)),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  userGet: {
    method: 'GET' as const,
    summary: 'Get specific user details by ID',
    description: 'Returns complete user information including profile and settings',
    path: '/user/:user_id',
    pathParams: z.object({ user_id: z.coerce.number() }),
    responses: { 200: R.success(UserEntitySchema), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  userUpdate: {
    method: 'PUT' as const,
    summary: 'Update user profile and settings',
    description: 'Modifies user properties like name, email, or preferences',
    path: '/user/:user_id',
    pathParams: z.object({ user_id: z.coerce.number() }),
    body: UserUpdateSchema,
    responses: { 200: R.success(UserEntitySchema), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  userUpdateImage: {
    method: 'PUT' as const,
    summary: 'Upload and update user profile image',
    description: 'Handles file upload for user avatar and returns upload response',
    path: '/user/:user_id/image',
    pathParams: z.object({ user_id: z.coerce.number() }),
    contentType: 'multipart/form-data' as const,
    body: FileSchema,
    responses: { 200: R.success(FileUploadResponseSchema), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  userDelete: {
    method: 'DELETE' as const,
    summary: 'Delete user account and all associated data',
    description: 'Removes user from system and cleans up all related resources',
    path: '/user/:user_id',
    pathParams: z.object({ user_id: z.coerce.number() }),
    responses: { 200: R.success(z.void()), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  userDisable: {
    method: 'POST' as const,
    summary: 'Deactivate user account without deletion',
    description: 'Disables user access while preserving data for potential reactivation',
    path: '/user/:user_id/deactivate',
    pathParams: z.object({ user_id: z.coerce.number() }),
    body: z.object({
      reason: z.string().optional(),
    }),
    responses: { 200: R.success(z.void()), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  // ============================================================================
  // AGENT ROUTES - AI agent creation and management
  // ============================================================================

  agentCreate: {
    method: 'POST' as const,
    summary: 'Create new AI agent with configuration',
    description: 'Creates agent with specified settings, prompts, and returns agent entity',
    path: '/agent',
    contentType: 'multipart/form-data' as const,
    body: AgentCreateSchema,
    responses: { 200: R.success(AgentEntitySchema), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  agentSearch: {
    method: 'GET' as const,
    summary: 'Search and filter agents by tenant or user',
    description: 'Returns list of agents matching search parameters',
    path: '/agent',
    query: z.object({
      tenant_id: z.coerce.number().optional(),
      user_id: z.coerce.number().optional(),
      connection_id: z.coerce.number().optional(),
    }),
    responses: { 200: R.success(z.array(AgentEntitySchema)), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  agentGet: {
    method: 'GET' as const,
    summary: 'Get specific agent details by ID',
    description: 'Returns complete agent information including configuration and settings',
    path: '/agent/:agent_id',
    pathParams: z.object({ agent_id: z.coerce.number() }),
    responses: { 200: R.success(AgentEntitySchema), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  agentMindmap: {
    method: 'GET' as const,
    summary: 'Get agent mindmap by ID',
    description: 'Returns the mindmap knowledge graph for the specified agent',
    path: '/agent/:agent_id/mindmap',
    pathParams: z.object({ agent_id: z.coerce.number() }),
    responses: {
      200: R.success(MindMapSchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  agentUpdate: {
    method: 'PUT' as const,
    summary: 'Update agent configuration and settings',
    description: 'Modifies agent properties like prompts, behavior, or appearance',
    path: '/agent/:agent_id',
    pathParams: z.object({ agent_id: z.coerce.number() }),
    query: z.object({
      force_reset_learning: z.coerce.boolean().optional(),
    }),
    contentType: 'multipart/form-data' as const,
    body: AgentUpdateSchema,
    responses: { 200: R.success(AgentEntitySchema), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  agentDelete: {
    method: 'DELETE' as const,
    summary: 'Delete agent and all associated data',
    description: 'Removes agent from system and cleans up all related resources',
    path: '/agent/:agent_id',
    pathParams: z.object({ agent_id: z.coerce.number() }),
    responses: { 200: R.success(z.void()), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  agentIndexSimulation: {
    method: 'POST' as const,
    summary: 'Index simulation document into agent knowledge base',
    description: "Adds a simulation document to an agent's knowledge base and refreshes the search index",
    path: '/agent/:agent_id/index',
    pathParams: z.object({ agent_id: z.coerce.number() }),
    body: AgentSimulationIndexRequestSchema,
    responses: {
      200: R.success(AgentSimulationIndexResponseSchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  agentIndexCallback: {
    method: 'POST' as const,
    summary: 'Callback endpoint for agent index creation completion',
    description: 'Called by agent service when index creation completes (vector_index or graph_index)',
    path: '/agent/index/callback',
    body: AgentIndexCallbackRequestSchema,
    responses: {
      200: R.success(AgentIndexCallbackResponseSchema),
      400: R.error,
      500: R.error,
    },
  },

  agentResetLearning: {
    method: 'POST' as const,
    summary: 'Force reset agent from stuck learning state',
    description:
      'Resets an agent that is stuck in learning state, setting it to error status with a message explaining the reset',
    path: '/agent/:agent_id/reset-learning',
    pathParams: z.object({ agent_id: z.coerce.number() }),
    body: z.void(),
    responses: {
      200: R.success(AgentEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  agentVideoGenerate: {
    method: 'POST' as const,
    summary: 'Generate video for agent from its last simulation',
    description: 'Generates a walkthrough video from agent simulation screenshots',
    path: '/agent/:agent_id/video',
    pathParams: z.object({ agent_id: z.coerce.number() }),
    body: AgentVideoGenerateRequestSchema,
    responses: {
      200: R.success(z.object({ video_url: z.string() })),
      400: R.error,
      401: R.error,
      403: R.error,
      404: R.error,
      500: R.error,
    },
  },

  // ============================================================================
  // ACTIVITY LOG ROUTES - System activity tracking and auditing
  // ============================================================================

  logCreate: {
    method: 'POST' as const,
    summary: 'Create new activity log entry',
    description: 'Records user or system action for auditing and tracking purposes',
    path: '/log',
    body: ActionLogCreateSchema,
    responses: { 200: R.success(ActionLogEntitySchema), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  logSearch: {
    method: 'GET' as const,
    summary: 'Search and filter activity logs',
    description: 'Returns list of activity logs matching search parameters (tenant, type)',
    path: '/log',
    query: z.object({
      tenant_id: z.coerce.number().optional(),
      type: ActionLogTypeSchema.optional(),
    }),
    responses: {
      200: R.success(z.array(ActionLogEntitySchema)),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  // ============================================================================
  // TOUR ROUTES - Interactive tour and guidance system
  // ============================================================================

  tourGet: {
    method: 'GET' as const,
    summary: 'Get tour information based on question and tenant',
    description: 'Returns relevant tour steps and guidance for user query',
    path: '/tour',
    query: z.object({
      connection_id: z.coerce.number().optional(),
      question: z.string().min(1),
    }),
    responses: { 200: R.success(TourEntitySchema), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  tourSearch: {
    method: 'GET' as const,
    summary: 'Search and filter tours by tenant',
    description: 'Returns list of available tours for specified tenant',
    path: '/tour',
    query: z.object({
      tenant_id: z.coerce.number().optional(),
      connection_id: z.coerce.number().optional(),
    }),
    responses: { 200: R.success(z.array(TourEntitySchema)), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  tourCreate: {
    method: 'POST' as const,
    summary: 'Create new interactive tour',
    description: 'Creates tour with specified steps and configuration',
    path: '/tour',
    body: TourEntitySchema,
    responses: { 200: R.success(TourEntitySchema), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  tourShow: {
    method: 'POST' as const,
    summary: 'Show tour spotlight and description',
    description: 'Triggers tour spotlight for a specific step and element',
    path: '/tour/show',
    body: z.object({
      step: TourStepSchema,
      element_selector: z.string().optional(),
    }),
    responses: {
      200: R.success(
        z.object({
          success: z.boolean(),
          message: z.string(),
          spotlight_created: z.boolean(),
          description_created: z.boolean(),
          step_id: z.number(),
          element_found: z.boolean(),
        }),
      ),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  // ============================================================================
  // URL GUIDE ROUTES - URL-based guidance messages for widget
  // ============================================================================

  urlGuideSearch: {
    method: 'GET' as const,
    summary: 'Search URL guides by integration',
    description: 'Returns list of URL guides for specified integration',
    path: '/url-guide',
    query: z.object({
      integration_id: z.coerce.number(),
    }),
    responses: {
      200: R.success(z.array(UrlGuideEntitySchema)),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  urlGuideCreate: {
    method: 'POST' as const,
    summary: 'Create new URL guide',
    description: 'Creates URL guide with pattern and message',
    path: '/url-guide',
    body: UrlGuideCreateSchema,
    responses: {
      200: R.success(UrlGuideEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  urlGuideGet: {
    method: 'GET' as const,
    summary: 'Get URL guide by ID',
    description: 'Returns URL guide details',
    path: '/url-guide/:id',
    pathParams: z.object({ id: z.coerce.number() }),
    responses: {
      200: R.success(UrlGuideEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  urlGuideUpdate: {
    method: 'PUT' as const,
    summary: 'Update URL guide',
    description: 'Updates URL guide properties',
    path: '/url-guide/:id',
    pathParams: z.object({ id: z.coerce.number() }),
    body: UrlGuideUpdateSchema,
    responses: {
      200: R.success(UrlGuideEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  urlGuideDelete: {
    method: 'DELETE' as const,
    summary: 'Delete URL guide',
    description: 'Removes URL guide from system',
    path: '/url-guide/:id',
    pathParams: z.object({ id: z.coerce.number() }),
    responses: {
      200: R.success(z.void()),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  urlGuideMatch: {
    method: 'GET' as const,
    summary: 'Find matching URL guide for current URL',
    description: 'Returns matching URL guide for a given URL pattern',
    path: '/url-guide/match',
    query: z.object({
      integration_id: z.coerce.number(),
      url: z.string(),
    }),
    responses: {
      200: R.success(UrlGuideEntitySchema.nullable()),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  // ============================================================================
  // SIMULATION ROUTES - Application simulation and testing
  // ============================================================================

  simulationSearch: {
    method: 'GET' as const,
    summary: 'Search and filter simulations by tenant',
    description:
      'Returns list of simulations associated with specified tenant as JSON. Use connection_id, agent_id, or pinned to filter.',
    path: '/simulation',
    query: z.object({
      tenant_id: z.coerce.number().optional(),
      connection_id: z.coerce.number().optional(),
      agent_id: z.coerce.number().optional(),
      pinned: z.any().transform(val => (String(val) === 'true' ? true : String(val) === 'false' ? false : undefined)),
      limit: z.coerce.number().optional(),
      offset: z.coerce.number().optional(),
    }),
    responses: {
      200: R.success(z.array(SimulationEntitySchema)),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  simulationLoggingUsers: {
    method: 'GET' as const,
    summary: 'Get users who have started simulations',
    description: 'Returns list of users who have logged simulation starts (started at least one simulation) as JSON.',
    path: '/simulation/logging-users',
    query: z.object({
      tenant_id: z.coerce.number().optional(),
    }),
    responses: {
      200: R.success(z.array(SimulationLoggingUserSchema)),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  simulationStart: {
    method: 'POST' as const,
    summary: 'Start new application simulation',
    description: 'Creates and initializes simulation with specified parameters',
    path: '/simulation/start',
    body: SimulationCreateSchema,
    responses: { 200: R.success(SimulationEntitySchema), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  simulationUpdate: {
    method: 'POST' as const,
    summary: 'Update simulation configuration and status',
    description: 'Modifies simulation parameters and updates execution state',
    path: '/simulation/:simulation_id',
    pathParams: z.object({ simulation_id: z.coerce.number() }),
    body: SimulationUpdateSchema,
    responses: { 200: R.success(SimulationEntitySchema), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  simulationProgress: {
    method: 'GET' as const,
    summary: 'Get simulation progress history as chat transcript',
    description: 'Returns all progress updates for a simulation ordered chronologically',
    path: '/simulation/:simulation_id/progress',
    pathParams: z.object({ simulation_id: z.coerce.number() }),
    responses: {
      200: R.success(z.array(SimulationProgressEntitySchema)),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  simulationLiveView: {
    method: 'GET' as const,
    summary: 'Get live view URL for simulation session',
    description: 'Returns Browserbase live view URL for embedding in iframe',
    path: '/simulation/:simulation_id/live-view',
    pathParams: z.object({ simulation_id: z.coerce.number() }),
    responses: {
      200: R.success(
        z.object({
          job_id: z.string(),
          live_view_url: z.string(),
          status: z.string(),
        }),
      ),
      400: R.error,
      401: R.error,
      403: R.error,
      404: R.error,
      500: R.error,
    },
  },

  simulationHistory: {
    method: 'GET' as const,
    summary: 'Get simulation history by ID',
    description: 'Returns the history array for the specified simulation',
    path: '/simulation/:simulation_id/history',
    pathParams: z.object({ simulation_id: z.coerce.number() }),
    responses: {
      200: R.success(z.object({ history: z.array(SimulationStepSchema) })),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  simulationSteps: {
    method: 'GET' as const,
    summary: 'Get all simulation steps with topic and screenshot link as JSON',
    description: 'Returns each step with step_number, topic, screenshot_url, and optional title/url for the simulation',
    path: '/simulation/:simulation_id/steps',
    pathParams: z.object({ simulation_id: z.coerce.number() }),
    responses: {
      200: R.success(z.array(SimulationStepSummarySchema)),
      400: R.error,
      401: R.error,
      403: R.error,
      404: R.error,
      500: R.error,
    },
  },

  simulationMindmap: {
    method: 'GET' as const,
    summary: 'Get simulation mindmap by ID',
    description: 'Returns the mindmap knowledge graph for the specified simulation',
    path: '/simulation/:simulation_id/mindmap',
    pathParams: z.object({ simulation_id: z.coerce.number() }),
    responses: {
      200: R.success(MindMapSchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  simulationStop: {
    method: 'POST' as const,
    summary: 'Stop running simulation',
    description: 'Terminates the simulation session',
    path: '/simulation/:simulation_id/stop',
    pathParams: z.object({ simulation_id: z.coerce.number() }),
    body: z.object({}),
    responses: {
      200: R.success(
        z.object({
          success: z.boolean(),
          message: z.string(),
        }),
      ),
      400: R.error,
      401: R.error,
      403: R.error,
      404: R.error,
      500: R.error,
    },
  },

  simulationAnswer: {
    method: 'POST' as const,
    summary: 'Submit answer to simulation question',
    description: 'Submits an answer to a pending question from the simulation agent',
    path: '/simulation/:simulation_id/answer',
    pathParams: z.object({ simulation_id: z.coerce.number() }),
    body: SimulationAnswerSchema,
    responses: {
      200: R.success(
        z.object({
          success: z.boolean(),
          message: z.string(),
        }),
      ),
      400: R.error,
      401: R.error,
      403: R.error,
      404: R.error,
      500: R.error,
    },
  },

  simulationDelete: {
    method: 'DELETE' as const,
    summary: 'Delete simulation',
    description: 'Removes a simulation and all associated data',
    path: '/simulation/:simulation_id',
    pathParams: z.object({ simulation_id: z.coerce.number() }),
    responses: {
      200: R.success(
        z.object({
          success: z.boolean(),
          message: z.string(),
        }),
      ),
      400: R.error,
      401: R.error,
      403: R.error,
      404: R.error,
      500: R.error,
    },
  },

  // ============================================================================
  // RRWEB SESSION ROUTES - RRWeb session recording management
  // ============================================================================

  rrwebSessionUpsert: {
    method: 'POST' as const,
    summary: 'Create or update RRWeb session',
    description: 'Creates a new session or updates an existing one',
    path: '/rrweb-session',
    body: RrwebSessionUpsertSchema,
    responses: {
      200: R.success(RrwebSessionEntitySchema),
      400: R.error,
      500: R.error,
    },
  },

  rrwebSessionGetById: {
    method: 'GET' as const,
    summary: 'Get RRWeb session by session ID',
    description: 'Retrieves a session by its session_id',
    path: '/rrweb-session/:session_id',
    pathParams: z.object({ session_id: z.string() }),
    responses: {
      200: R.success(RrwebSessionEntitySchema.nullable()),
      400: R.error,
      404: R.error,
      500: R.error,
    },
  },

  rrwebSessionGetByChatId: {
    method: 'GET' as const,
    summary: 'Get RRWeb sessions by marketrix chat ID',
    description: 'Retrieves all sessions for a given marketrix_chat_id',
    path: '/rrweb-session/chat/:marketrix_chat_id',
    pathParams: z.object({ marketrix_chat_id: z.string() }),
    responses: {
      200: R.success(z.array(RrwebSessionEntitySchema)),
      400: R.error,
      500: R.error,
    },
  },

  rrwebSessionGetAll: {
    method: 'GET' as const,
    summary: 'Get all RRWeb sessions',
    description: 'Retrieves all sessions ordered by creation date, optionally filtered by connection and date range',
    path: '/rrweb-session',
    query: z.object({
      connection_id: z.coerce.number().optional(),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
    }),
    responses: {
      200: R.success(z.array(RrwebSessionEntitySchema)),
      500: R.error,
    },
  },

  rrwebSessionGetEvents: {
    method: 'GET' as const,
    summary: 'Get RRWeb session events',
    description: 'Fetches all batches from folder, combines them in correct order, and returns events array',
    path: '/rrweb-session/:session_id/events',
    pathParams: z.object({ session_id: z.string() }),
    responses: {
      200: R.success(z.array(z.any())), // RRWebEvent array
      400: R.error,
      404: R.error,
      500: R.error,
    },
  },

  browserSessionCreate: {
    method: 'POST' as const,
    summary: 'Create browser session for connection',
    description: 'Creates a browser session and navigates to the connection URL',
    path: '/browser-session/create',
    body: z.object({
      connection_id: z.number(),
      agent_id: z.number(),
      connection_url: z.string().nullish(),
    }),
    responses: {
      200: R.success(
        z.object({
          session_id: z.string(),
          live_view_url: z.string(),
        }),
      ),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  browserSessionStopTasks: {
    method: 'POST' as const,
    summary: 'Stop all tasks for browser session',
    description: 'Stops all active tasks for widgets connected to the browser session',
    path: '/browser-session/:session_id/stop-tasks',
    pathParams: z.object({ session_id: z.string() }),
    body: z.object({}),
    responses: {
      200: R.success(
        z.object({
          success: z.boolean(),
          message: z.string(),
        }),
      ),
      400: R.error,
      401: R.error,
      403: R.error,
      404: R.error,
      500: R.error,
    },
  },

  browserSessionStop: {
    method: 'POST' as const,
    summary: 'Stop browser session',
    description: 'Terminates the browser session',
    path: '/browser-session/:session_id/stop',
    pathParams: z.object({ session_id: z.string() }),
    body: z.object({}),
    responses: {
      200: R.success(
        z.object({
          success: z.boolean(),
          message: z.string(),
        }),
      ),
      400: R.error,
      401: R.error,
      403: R.error,
      404: R.error,
      500: R.error,
    },
  },

  // ============================================================================
  // KNOWLEDGE ROUTES - Knowledge base and document management
  // ============================================================================

  knowledgeSearch: {
    method: 'GET' as const,
    summary: 'Search and filter knowledge base documents',
    description: 'Returns list of knowledge documents matching search parameters',
    path: '/knowledge',
    query: z.object({
      tenant_id: z.coerce.number().optional(),
      type: KnowledgeTypeSchema.optional(),
      connection_id: z.coerce.number().optional(),
    }),
    responses: {
      200: R.success(z.array(KnowledgeEntitySchema)),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  knowledgeCreate: {
    method: 'POST' as const,
    summary: 'Upload new knowledge base document',
    description: 'Processes file upload or URL and creates knowledge entry for AI training',
    path: '/knowledge',
    contentType: 'multipart/form-data' as const,
    body: z.object({
      file: z.custom<Express.Multer.File>().optional(),
      connection_id: z.coerce.number(),
      document_url: z.string().url().optional(),
      document_name: z.string().optional(),
      video_url: z.string().url().optional(),
      video_name: z.string().optional(),
    }),
    responses: { 200: R.success(KnowledgeEntitySchema), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  knowledgeGet: {
    method: 'GET' as const,
    summary: 'Get specific knowledge document by ID',
    description: 'Returns complete knowledge document information and content',
    path: '/knowledge/:id',
    pathParams: z.object({ id: z.coerce.number() }),
    responses: { 200: R.success(KnowledgeEntitySchema), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  knowledgeDelete: {
    method: 'DELETE' as const,
    summary: 'Delete knowledge document',
    description: 'Removes a knowledge document from the database',
    path: '/knowledge/:id',
    pathParams: z.object({ id: z.coerce.number() }),
    responses: {
      200: R.success(z.void()),
      400: R.error,
      401: R.error,
      403: R.error,
      404: R.error,
      500: R.error,
    },
  },

  knowledgeRefresh: {
    method: 'POST' as const,
    summary: 'Refresh knowledge document',
    description: 'Re-fetches HTML content from source URL and updates the document',
    path: '/knowledge/:id/refresh',
    pathParams: z.object({ id: z.coerce.number() }),
    body: z.void(),
    responses: {
      200: R.success(KnowledgeEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      404: R.error,
      500: R.error,
    },
  },

  // ============================================================================
  // QA DOCUMENT ROUTES - QA document upload and test result management
  // ============================================================================

  qaDocumentUpload: {
    method: 'POST' as const,
    summary: 'Upload QA document (file or text)',
    description: 'Uploads a PDF/text file or text content for QA test generation',
    path: '/qa/document',
    contentType: 'multipart/form-data' as const,
    body: QADocumentCreateSchema,
    responses: {
      200: R.success(QADocumentEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  qaDocumentProcess: {
    method: 'POST' as const,
    summary: 'Process QA document and generate test cases',
    description:
      'Starts async processing (returns 202). Poll GET /qa/document/:id for status and processing_step until completed/failed.',
    path: '/qa/document/:id/process',
    pathParams: z.object({ id: z.coerce.number() }),
    body: z.void(),
    responses: {
      202: R.success(z.object({ document: QADocumentEntitySchema })),
      400: R.error,
      401: R.error,
      403: R.error,
      404: R.error,
      500: R.error,
    },
  },

  qaDocumentRefine: {
    method: 'POST' as const,
    summary: 'Refine existing QA test cases',
    description: 'Refines existing test cases with a refinement prompt via AI agent API',
    path: '/qa/document/:id/refine',
    pathParams: z.object({ id: z.coerce.number() }),
    body: z.object({
      refinementPrompt: z.string().min(5).max(2000),
    }),
    responses: {
      200: R.success(QADocumentProcessingResponseSchema),
      400: R.error,
      401: R.error,
      403: R.error,
      404: R.error,
      500: R.error,
    },
  },

  qaDocumentGet: {
    method: 'GET' as const,
    summary: 'Get QA document by ID',
    description: 'Retrieves a QA document by its ID',
    path: '/qa/document/:id',
    pathParams: z.object({ id: z.coerce.number() }),
    responses: {
      200: R.success(QADocumentEntitySchema),
      400: R.error,
      401: R.error,
      404: R.error,
      500: R.error,
    },
  },

  qaDocumentList: {
    method: 'GET' as const,
    summary: 'List QA documents',
    description: 'Gets all QA documents with run_count and display_title',
    path: '/qa/document',
    query: z.object({
      connection_id: z.coerce.number().optional(),
    }),
    responses: {
      200: R.success(
        z.array(
          QADocumentEntitySchema.extend({
            run_count: z.number(),
            display_title: z.string(),
            total_failed: z.number(),
            pass_rate: z.number().nullable(),
          }),
        ),
      ),
      400: R.error,
      401: R.error,
      500: R.error,
    },
  },

  qaDocumentUpdate: {
    method: 'PUT' as const,
    summary: 'Update QA document status',
    description: 'Updates the status of a QA document',
    path: '/qa/document/:id',
    pathParams: z.object({ id: z.coerce.number() }),
    body: z.object({
      status: QADocumentStatusSchema,
    }),
    responses: {
      200: R.success(QADocumentEntitySchema),
      400: R.error,
      401: R.error,
      404: R.error,
      500: R.error,
    },
  },

  qaDocumentRuns: {
    method: 'GET' as const,
    summary: 'List runs for a QA document',
    description: 'Returns all runs for a document with total/passed/failed counts',
    path: '/qa/document/:id/runs',
    pathParams: z.object({ id: z.coerce.number() }),
    responses: {
      200: R.success(
        z.array(
          QARunEntitySchema.extend({
            total_tests: z.number(),
            passed: z.number(),
            failed: z.number(),
          }),
        ),
      ),
      400: R.error,
      401: R.error,
      404: R.error,
      500: R.error,
    },
  },

  qaRunGet: {
    method: 'GET' as const,
    summary: 'Get a QA run by ID',
    description: 'Returns run details with test results',
    path: '/qa/run/:id',
    pathParams: z.object({ id: z.coerce.number() }),
    responses: {
      200: R.success(
        QARunEntitySchema.extend({
          test_results: z.array(QATestResultEntitySchema),
        }),
      ),
      400: R.error,
      401: R.error,
      404: R.error,
      500: R.error,
    },
  },

  qaDocumentRun: {
    method: 'POST' as const,
    summary: 'Create and start a new QA run',
    description:
      'Creates a new run (clones test cases) and starts execution. Returns 202; poll test-results by run_id.',
    path: '/qa/document/:id/run',
    pathParams: z.object({ id: z.coerce.number() }),
    body: z.void(),
    responses: {
      202: R.success(
        z.object({
          run: QARunEntitySchema,
          simulations: z.array(SimulationEntitySchema),
        }),
      ),
      400: R.error,
      401: R.error,
      404: R.error,
      500: R.error,
    },
  },

  qaTestResultList: {
    method: 'GET' as const,
    summary: 'Get test results for a QA document',
    description: 'Retrieves test results; optional run_id scopes to that run',
    path: '/qa/document/:id/test-results',
    pathParams: z.object({ id: z.coerce.number() }),
    query: z.object({ run_id: z.coerce.number().optional() }),
    responses: {
      200: R.success(z.array(QATestResultEntitySchema)),
      400: R.error,
      401: R.error,
      404: R.error,
      500: R.error,
    },
  },

  qaTestResultUpdate: {
    method: 'PUT' as const,
    summary: 'Update test result status and progress',
    description: 'Updates a test result with status, progress log, and screenshot',
    path: '/qa/test-result/:id',
    pathParams: z.object({ id: z.coerce.number() }),
    body: z.object({
      status: z.enum(['pending', 'running', 'completed', 'failed']).optional(),
      progress_log: z
        .array(
          z.object({
            step: z.number(),
            message: z.string(),
            timestamp: z.string(),
            status: z.enum(['success', 'error', 'info']),
          }),
        )
        .optional(),
      screenshot_url: z.string().nullable().optional(),
    }),
    responses: {
      200: R.success(QATestResultEntitySchema),
      400: R.error,
      401: R.error,
      404: R.error,
      500: R.error,
    },
  },

  // Execute all tests for a document (creates a run and executes; returns run + simulations)
  qaDocumentExecuteTests: {
    method: 'POST' as const,
    path: '/qa/document/:id/execute',
    pathParams: z.object({ id: z.coerce.number() }),
    body: z.void(),
    responses: {
      200: R.success(
        z.object({
          run: QARunEntitySchema,
          simulations: z.array(SimulationEntitySchema),
        }),
      ),
      404: R.error,
      500: R.error,
    },
    summary: 'Create a run and execute all pending tests for a QA document as simulations',
  },

  // Execute a single test
  qaTestResultExecute: {
    method: 'POST' as const,
    path: '/qa/test-result/:id/execute',
    pathParams: z.object({ id: z.coerce.number() }),
    body: z.void(),
    responses: {
      200: R.success(
        z.object({
          simulation: SimulationEntitySchema,
        }),
      ),
      404: R.error,
      500: R.error,
    },
    summary: 'Execute a single test as a simulation',
  },

  // Get simulation linked to test result
  qaTestResultSimulation: {
    method: 'GET' as const,
    path: '/qa/test-result/:id/simulation',
    pathParams: z.object({ id: z.coerce.number() }),
    responses: {
      200: R.success(
        z.object({
          simulation: SimulationEntitySchema.nullable(),
        }),
      ),
      404: R.error,
      500: R.error,
    },
    summary: 'Get the simulation linked to a test result',
  },

  // QA Test Version routes
  qaTestVersionList: {
    method: 'GET' as const,
    summary: 'Get version history for a test',
    description: 'Returns all versions of a test case with change history',
    path: '/qa/test-result/:id/versions',
    pathParams: z.object({ id: z.coerce.number() }),
    responses: {
      200: R.success(z.array(QATestVersionEntitySchema)),
      401: R.error,
      404: R.error,
    },
  },
  qaTestVersionGet: {
    method: 'GET' as const,
    summary: 'Get specific test version',
    description: 'Returns a specific version of a test case',
    path: '/qa/test-result/:id/versions/:version',
    pathParams: z.object({ id: z.coerce.number(), version: z.coerce.number() }),
    responses: {
      200: R.success(QATestVersionEntitySchema),
      401: R.error,
      404: R.error,
    },
  },
  qaTestVersionRollback: {
    method: 'POST' as const,
    summary: 'Rollback to specific version',
    description: 'Restores test to a previous version and creates new version record',
    path: '/qa/test-result/:id/versions/:version/rollback',
    pathParams: z.object({ id: z.coerce.number(), version: z.coerce.number() }),
    body: z.object({}),
    responses: {
      200: R.success(QATestVersionEntitySchema),
      401: R.error,
      404: R.error,
    },
  },
  qaTestVersionCompare: {
    method: 'GET' as const,
    summary: 'Compare two versions',
    description: 'Returns differences between two test versions',
    path: '/qa/test-result/:id/versions/compare',
    pathParams: z.object({ id: z.coerce.number() }),
    query: z.object({
      version1: z.coerce.number(),
      version2: z.coerce.number(),
    }),
    responses: {
      200: R.success(
        z.object({
          version1: QATestVersionEntitySchema,
          version2: QATestVersionEntitySchema,
          diff: z.array(
            z.object({
              field: z.string(),
              oldValue: z.unknown(),
              newValue: z.unknown(),
            }),
          ),
        }),
      ),
      401: R.error,
      404: R.error,
    },
  },

  // QA Self-Healing routes
  qaHealingAttemptList: {
    method: 'GET' as const,
    summary: 'Get healing attempts for a test',
    description: 'Returns all healing attempts for a specific test result',
    path: '/qa/test-result/:id/healing-attempts',
    pathParams: z.object({ id: z.coerce.number() }),
    responses: {
      200: R.success(z.array(QAHealingAttemptEntitySchema)),
      401: R.error,
      404: R.error,
    },
  },
  qaHealingAttemptApprove: {
    method: 'POST' as const,
    summary: 'Approve a healing attempt',
    description: 'Applies the repair from a validated healing attempt',
    path: '/qa/test-result/:id/healing-attempts/:attemptId/approve',
    pathParams: z.object({ id: z.coerce.number(), attemptId: z.coerce.number() }),
    body: z.object({}),
    responses: {
      200: R.success(z.object({ success: z.boolean() })),
      401: R.error,
      404: R.error,
    },
  },
  qaHealingAttemptReject: {
    method: 'POST' as const,
    summary: 'Reject a healing attempt',
    description: 'Marks a healing attempt as rejected',
    path: '/qa/test-result/:id/healing-attempts/:attemptId/reject',
    pathParams: z.object({ id: z.coerce.number(), attemptId: z.coerce.number() }),
    body: z.object({}),
    responses: {
      200: R.success(z.object({ success: z.boolean() })),
      401: R.error,
      404: R.error,
    },
  },
  qaHealingTrigger: {
    method: 'POST' as const,
    summary: 'Trigger self-healing for a failed test',
    description: 'Initiates the self-healing workflow for a test result',
    path: '/qa/test-result/:id/heal',
    pathParams: z.object({ id: z.coerce.number() }),
    body: z.object({
      simulation_id: z.number(),
      config: z
        .object({
          enabled: z.boolean().optional(),
          autoApply: z.boolean().optional(),
          minConfidenceThreshold: z.number().min(0).max(1).optional(),
          maxHealingAttempts: z.number().int().min(1).max(5).optional(),
        })
        .optional(),
    }),
    responses: {
      200: R.success(
        z.object({
          healed: z.boolean(),
          attemptId: z.number().nullable(),
          analysis: FailureAnalysisSchema.nullable(),
          confidence: z.number().nullable(),
        }),
      ),
      401: R.error,
      404: R.error,
    },
  },

  // QA Cross-Browser routes
  qaCrossBrowserRun: {
    method: 'POST' as const,
    summary: 'Execute cross-browser tests',
    description: 'Runs tests across multiple browsers (chromium, firefox, webkit)',
    path: '/qa/document/:id/run-cross-browser',
    pathParams: z.object({ id: z.coerce.number() }),
    body: BrowserConfigSchema,
    responses: {
      200: R.success(
        z.object({
          runs: z.array(
            z.object({
              browserType: BrowserTypeSchema,
              runId: z.number(),
              status: z.enum(['completed', 'failed', 'skipped']),
              passedTests: z.number(),
              failedTests: z.number(),
              totalTests: z.number(),
            }),
          ),
          summary: z.object({
            totalRuns: z.number(),
            completedRuns: z.number(),
            failedRuns: z.number(),
            overallPassed: z.number(),
            overallFailed: z.number(),
          }),
        }),
      ),
      401: R.error,
      404: R.error,
    },
  },
  qaCrossBrowserComparison: {
    method: 'GET' as const,
    summary: 'Get cross-browser comparison',
    description: 'Returns test results comparison across different browsers',
    path: '/qa/document/:id/cross-browser-comparison',
    pathParams: z.object({ id: z.coerce.number() }),
    responses: {
      200: R.success(
        z.object({
          byTest: z.record(
            z.record(
              z.object({
                status: z.string(),
                runId: z.number(),
              }),
            ),
          ),
          byBrowser: z.record(
            z.object({
              passed: z.number(),
              failed: z.number(),
              total: z.number(),
            }),
          ),
        }),
      ),
      401: R.error,
      404: R.error,
    },
  },
  qaBrowserConfigUpdate: {
    method: 'PUT' as const,
    summary: 'Update browser configuration',
    description: 'Updates the default browser configuration for a QA document',
    path: '/qa/document/:id/browser-config',
    pathParams: z.object({ id: z.coerce.number() }),
    body: BrowserConfigSchema,
    responses: {
      200: R.success(z.object({ success: z.boolean() })),
      401: R.error,
      404: R.error,
    },
  },

  // ============================================================================
  // MIGRATION ROUTES - Database migration and system updates
  // ============================================================================

  migratePrepare: {
    method: 'POST' as const,
    summary: 'Prepare database migration',
    description: 'Validates migration requirements and prepares system for migration',
    path: '/migrate/prepare',
    body: MigrationPrepareSchema,
    responses: { 200: R.success(z.void()), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  migrateRun: {
    method: 'POST' as const,
    summary: 'Execute database migration',
    description: 'Runs migration scripts and updates database schema',
    path: '/migrate/run',
    body: MigrationRunSchema,
    responses: { 200: R.success(z.void()), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  // ============================================================================
  // STRIPE ROUTES - Subscription and payment management
  // ============================================================================

  stripeCreateTrial: {
    method: 'POST' as const,
    summary: 'Create a trial subscription',
    description: 'Creates a trial subscription for the authenticated tenant. The trial period is 30 days by default.',
    path: '/stripe/trial',
    body: StripeTrialSchema,
    responses: {
      200: R.success(TrialSubscriptionSchema),
      400: R.error,
      401: R.error,
      500: R.error,
    },
  },

  stripeCreateCheckout: {
    method: 'POST' as const,
    summary: 'Create a checkout session for subscription purchase',
    description: 'Creates a Stripe checkout session for purchasing a subscription. Returns a session URL for redirect.',
    path: '/stripe/checkout',
    body: StripeCheckoutSchema,
    responses: {
      200: R.success(CheckoutSessionSchema),
      400: R.error,
      401: R.error,
      500: R.error,
    },
  },

  stripeCreatePortal: {
    method: 'POST' as const,
    summary: 'Create a customer portal session',
    description: 'Creates a Stripe billing portal session for managing subscription, payment methods, and invoices.',
    path: '/stripe/portal',
    body: StripePortalSchema,
    responses: {
      200: R.success(PortalSessionSchema),
      400: R.error,
      401: R.error,
      500: R.error,
    },
  },

  stripeConfirmDowngrade: {
    method: 'POST' as const,
    summary: 'Confirm and process a subscription downgrade',
    description: 'Processes a confirmed subscription downgrade to a lower tier plan. No payment required.',
    path: '/stripe/downgrade',
    body: StripeDowngradeSchema,
    responses: {
      200: R.success(StripeDowngradeResponseSchema),
      400: R.error,
      401: R.error,
      500: R.error,
    },
  },

  stripeCancelSubscription: {
    method: 'POST' as const,
    summary: 'Cancel subscription at period end',
    description: 'Cancels the subscription at the end of the current billing period.',
    path: '/stripe/cancel',
    body: z.object({ subscriptionId: z.string() }),
    responses: {
      200: R.success(z.object({ subscriptionId: z.string(), cancelAtPeriodEnd: z.boolean() })),
      400: R.error,
      401: R.error,
      500: R.error,
    },
  },

  stripeGetPlan: {
    method: 'GET' as const,
    summary: 'Get current plan information',
    description: 'Returns current subscription plan and usage information for authenticated tenant.',
    path: '/stripe/plan',
    responses: {
      200: R.success(PlanInfoSchema),
      401: R.error,
      500: R.error,
    },
  },

  stripeGetUsage: {
    method: 'GET' as const,
    summary: 'Get current usage statistics',
    description: 'Returns actual usage counts for agents, knowledge sources, meetings, storage, and team members.',
    path: '/stripe/usage',
    responses: {
      200: R.success(SubscriptionUsageSchema),
      401: R.error,
      500: R.error,
    },
  },

  stripeGetPricing: {
    method: 'GET' as const,
    summary: 'Get pricing information for all plans',
    description: 'Returns actual pricing from Stripe for all plans. Ensures frontend displays match Stripe charges.',
    path: '/stripe/pricing',
    responses: {
      200: R.success(StripePricingSchema),
      500: R.error,
    },
  },

  stripeGetConfig: {
    method: 'GET' as const,
    summary: 'Get Stripe configuration for frontend',
    description: 'Returns Stripe publishable key, price IDs, and trial days configuration for frontend use.',
    path: '/stripe/config',
    responses: {
      200: R.success(StripeConfigSchema),
      500: R.error,
    },
  },

  stripeGetPlans: {
    method: 'GET' as const,
    summary: 'Get plan catalog (metadata for display)',
    description: 'Returns plan names, descriptions, features, CTA and styling. No auth required.',
    path: '/stripe/plans',
    responses: {
      200: R.success(PlanCatalogSchema),
      500: R.error,
    },
  },

  stripeWebhook: {
    method: 'POST' as const,
    summary: 'Handle Stripe webhook events',
    description: 'Receives and processes Stripe webhook events for subscription changes, payments, and other events.',
    path: '/stripe/webhook',
    contentType: 'application/json' as const,
    body: StripeWebhookEventSchema,
    responses: {
      200: R.success(z.object({ received: z.literal(true) })),
      400: R.error,
      500: R.error,
    },
  },
});

export { contract };
