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
  AgentKnowledgeSearchRequestSchema,
  AgentKnowledgeSearchResponseSchema,
  AgentSimulationIndexRequestSchema,
  AgentSimulationIndexResponseSchema,
  AgentUpdateSchema,
  BatchUserCreateResultSchema,
  BatchUserCreateSchema,
  ChatRequestSchema,
  ChatResponseSchema,
  ConnectionCreateSchema,
  ConnectionEntitySchema,
  ConnectionTypeSchema,
  ConnectionUpdateSchema,
  EntityStatusSchema,
  FileSchema,
  FileUploadResponseSchema,
  GoogleLoginCallbackSchema,
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
  R,
  SimulationAnswerSchema,
  SimulationCreateSchema,
  SimulationEntitySchema,
  SimulationProgressEntitySchema,
  SimulationStepSchema,
  SimulationUpdateSchema,
  TenantCreateSchema,
  TenantEntitySchema,
  TenantUpdateSchema,
  TokenSchema,
  TourEntitySchema,
  TourStepSchema,
  UsageStatsSchema,
  UserEntitySchema,
  UserLoginSchema,
  UserRegisterSchema,
  UserUpdateSchema,
  VerifyCaptchaSchema,
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

  // ============================================================================
  // AUTHENTICATION ROUTES - User authentication and authorization
  // ============================================================================

  authCaptcha: {
    method: 'POST' as const,
    summary: 'Verify CAPTCHA challenge to prevent automated abuse',
    description: 'Validates user-submitted CAPTCHA response against challenge',
    path: '/auth/captcha',
    body: VerifyCaptchaSchema,
    responses: { 200: R.success(z.boolean()), 400: R.error, 500: R.error },
  },

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

  authGoogleLoginByToken: {
    method: 'POST' as const,
    summary: 'Authenticate user with Google OAuth token',
    description: 'Validates Google OAuth token and returns authentication data',
    path: '/auth/google/token',
    body: TokenSchema,
    responses: { 200: R.success(TokenSchema), 400: R.error, 401: R.error, 500: R.error },
  },

  authGoogleLoginByRedirect: {
    method: 'GET' as const,
    summary: 'Redirect to Google OAuth authorization page',
    description: "Initiates OAuth flow by redirecting user to Google's consent screen",
    path: '/auth/google/redirect',
    query: z.object({ callback: z.string() }),
    responses: { 302: R.void, 400: R.error, 500: R.error },
  },

  authGoogleLoginCallback: {
    method: 'GET' as const,
    summary: 'Handle Google OAuth callback',
    description: 'Processes OAuth callback from Google and completes authentication',
    path: '/auth/google/callback',
    query: GoogleLoginCallbackSchema,
    responses: { 302: R.void, 400: R.error, 500: R.error },
  },

  authRefreshToken: {
    method: 'GET' as const,
    summary: 'Refresh current authentication token',
    description: 'Checks if provided token is valid and returns a new token',
    path: '/auth/refresh',
    responses: { 200: R.success(TokenSchema), 400: R.error, 401: R.error, 500: R.error },
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
    responses: {
      200: R.success(MeetingEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
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
    responses: {
      200: R.success(z.array(MeetingEntitySchema)),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  meetingCount: {
    method: 'GET' as const,
    summary: 'Get total count of meetings for a tenant',
    description: 'Returns number of meetings associated with specified tenant',
    path: '/meeting/count',
    query: z.object({ tenant_id: z.coerce.number().optional() }),
    responses: {
      200: R.success(z.number()),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  meetingGet: {
    method: 'GET' as const,
    summary: 'Get specific meeting details by ID',
    description: 'Returns complete meeting information including participants and settings',
    path: '/meeting/:meeting_id',
    pathParams: z.object({ meeting_id: z.string() }),
    responses: {
      200: R.success(MeetingEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  meetingUpdate: {
    method: 'PUT' as const,
    summary: 'Update meeting settings and configuration',
    description: 'Modifies meeting properties like title, duration, or participant settings',
    path: '/meeting/:meeting_id',
    pathParams: z.object({ meeting_id: z.string() }),
    body: MeetingUpdateSchema,
    responses: {
      200: R.success(MeetingEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
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
    responses: {
      200: R.success(TokenSchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
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
    responses: {
      200: R.success(TenantEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
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
    responses: {
      200: R.success(z.array(TenantEntitySchema)),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  tenantGet: {
    method: 'GET' as const,
    summary: 'Get specific tenant details by ID',
    description: 'Returns complete tenant information including settings and configuration',
    path: '/tenant/:tenant_id',
    pathParams: z.object({ tenant_id: z.coerce.number() }),
    responses: {
      200: R.success(TenantEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  tenantUpdate: {
    method: 'PUT' as const,
    summary: 'Update tenant settings and configuration',
    description: 'Modifies tenant properties like name, domain, or feature settings',
    path: '/tenant/:tenant_id',
    pathParams: z.object({ tenant_id: z.coerce.number() }),
    body: TenantUpdateSchema,
    responses: {
      200: R.success(TenantEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
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
    responses: {
      200: R.success(ConnectionEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
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
          })
        )
      ),
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  connectionGet: {
    method: 'GET' as const,
    summary: 'Get connection by ID',
    description:
      'Returns specific connection details by connection ID, always includes integrations',
    path: '/connection/:connection_id',
    pathParams: z.object({ connection_id: z.coerce.number() }),
    responses: {
      200: R.success(
        ConnectionEntitySchema.extend({
          integrations: z.array(IntegrationEntitySchema),
        })
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
    responses: {
      200: R.success(IntegrationEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
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
    responses: {
      200: R.success(z.array(IntegrationEntitySchema)),
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  integrationGet: {
    method: 'GET' as const,
    summary: 'Get integration by ID',
    description: 'Returns specific integration details by integration ID including snippet code',
    path: '/integration/:integration_id',
    pathParams: z.object({ integration_id: z.coerce.number() }),
    responses: {
      200: R.success(IntegrationEntitySchema),
      404: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
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
    responses: {
      200: R.success(z.string()),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  chatSearch: {
    method: 'GET' as const,
    summary: 'Search chat submitted by the user',
    description: 'Returns list of chats submitted by the user',
    path: '/chat',
    query: z.object({
      user_id: z.coerce.number().optional(),
      chat_id: z.coerce.number().optional(),
    }),
    responses: {
      200: R.success(UsageStatsSchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  chatTell: {
    method: 'POST' as const,
    summary: 'Request tell mode response for given content',
    description: 'Processes explanation request and returns AI response (voice+text) as a data url',
    path: '/chat/:chat_id/tell',
    body: ChatRequestSchema,
    pathParams: z.object({ chat_id: z.string() }),
    responses: {
      200: R.success(ChatResponseSchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  chatShow: {
    method: 'POST' as const,
    summary: 'Request show mode response for given content',
    description: 'Processes user introduction and returns AI response (voice+text) as a data url',
    path: '/chat/:chat_id/show',
    body: ChatRequestSchema,
    pathParams: z.object({ chat_id: z.string() }),
    responses: {
      200: R.success(ChatResponseSchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  chatDo: {
    method: 'POST' as const,
    summary: 'Request do mode response for given content',
    description: 'Creates prompt with specified configuration and returns creation response',
    path: '/chat/:chat_id/do',
    body: ChatRequestSchema,
    pathParams: z.object({ chat_id: z.string() }),
    responses: {
      200: R.success(UsageStatsSchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
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
    responses: {
      200: R.success(z.array(UserEntitySchema)),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
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
    responses: {
      200: R.success(UserEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  userUpdate: {
    method: 'PUT' as const,
    summary: 'Update user profile and settings',
    description: 'Modifies user properties like name, email, or preferences',
    path: '/user/:user_id',
    pathParams: z.object({ user_id: z.coerce.number() }),
    body: UserUpdateSchema,
    responses: {
      200: R.success(UserEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  userUpdateImage: {
    method: 'PUT' as const,
    summary: 'Upload and update user profile image',
    description: 'Handles file upload for user avatar and returns upload response',
    path: '/user/:user_id/image',
    pathParams: z.object({ user_id: z.coerce.number() }),
    contentType: 'multipart/form-data' as const,
    body: FileSchema,
    responses: {
      200: R.success(FileUploadResponseSchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
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
    responses: {
      200: R.success(AgentEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
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
    responses: {
      200: R.success(z.array(AgentEntitySchema)),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  agentGet: {
    method: 'GET' as const,
    summary: 'Get specific agent details by ID',
    description: 'Returns complete agent information including configuration and settings',
    path: '/agent/:agent_id',
    pathParams: z.object({ agent_id: z.coerce.number() }),
    responses: {
      200: R.success(AgentEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
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
    contentType: 'multipart/form-data' as const,
    body: AgentUpdateSchema,
    responses: {
      200: R.success(AgentEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  agentDelete: {
    method: 'DELETE' as const,
    summary: 'Delete agent and all associated data',
    description: 'Removes agent from system and cleans up all related resources',
    path: '/agent/:agent_id',
    pathParams: z.object({ agent_id: z.coerce.number() }),
    responses: { 200: R.success(z.void()), 400: R.error, 401: R.error, 403: R.error, 500: R.error },
  },

  agentSearchKnowledge: {
    method: 'POST' as const,
    summary: 'Search agent knowledge base',
    description: "Searches the agent's knowledge base with configurable options",
    path: '/agent/:agent_id/search',
    pathParams: z.object({ agent_id: z.coerce.number() }),
    body: AgentKnowledgeSearchRequestSchema,
    responses: {
      200: R.success(AgentKnowledgeSearchResponseSchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  agentIndexSimulation: {
    method: 'POST' as const,
    summary: 'Index simulation document into agent knowledge base',
    description:
      "Adds a simulation document to an agent's knowledge base and refreshes the search index",
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
    description:
      'Called by agent service when index creation completes (PDF, JSON, node_index, edge_index, or mindmap)',
    path: '/agent/index/callback',
    body: AgentIndexCallbackRequestSchema,
    responses: {
      200: R.success(AgentIndexCallbackResponseSchema),
      400: R.error,
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
    responses: {
      200: R.success(ActionLogEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
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
    responses: {
      200: R.success(TourEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
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
    responses: {
      200: R.success(z.array(TourEntitySchema)),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  tourCreate: {
    method: 'POST' as const,
    summary: 'Create new interactive tour',
    description: 'Creates tour with specified steps and configuration',
    path: '/tour',
    body: TourEntitySchema,
    responses: {
      200: R.success(TourEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
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
        })
      ),
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
    description: 'Returns list of simulations associated with specified tenant',
    path: '/simulation',
    query: z.object({
      tenant_id: z.coerce.number().optional(),
      connection_id: z.coerce.number().optional(),
    }),
    responses: {
      200: R.success(z.array(SimulationEntitySchema)),
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
    responses: {
      200: R.success(SimulationEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  simulationUpdate: {
    method: 'POST' as const,
    summary: 'Update simulation configuration and status',
    description: 'Modifies simulation parameters and updates execution state',
    path: '/simulation/:simulation_id',
    pathParams: z.object({ simulation_id: z.coerce.number() }),
    body: SimulationUpdateSchema,
    responses: {
      200: R.success(SimulationEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
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
        })
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
        })
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
        })
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
        })
      ),
      400: R.error,
      401: R.error,
      403: R.error,
      404: R.error,
      500: R.error,
    },
  },

  browserSessionCreate: {
    method: 'POST' as const,
    summary: 'Create browser session for connection',
    description: 'Creates a browser session and navigates to the connection URL',
    path: '/browser-session/create',
    body: z
      .object({
        connection_id: z.number().optional(),
        agent_id: z.number().optional(),
        connection_url: z.string().nullish(),
        marketrix_id: z.string().optional(),
        marketrix_key: z.string().optional(),
      })
      .refine(
        (data) =>
          (data.connection_id !== undefined && data.agent_id !== undefined) ||
          (data.marketrix_id !== undefined && data.marketrix_key !== undefined),
        {
          message: 'Provide either connection_id+agent_id or marketrix_id+marketrix_key.',
          path: ['connection_id'],
        }
      ),
    responses: {
      200: R.success(
        z.object({
          session_id: z.string(),
          live_view_url: z.string(),
        })
      ),
      400: R.error,
      401: R.error,
      403: R.error,
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
        })
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
    body: FileSchema.extend({
      connection_id: z.coerce.number(),
      document_url: z.string().url().optional(),
      document_name: z.string().optional(),
    }),
    responses: {
      200: R.success(KnowledgeEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
  },

  knowledgeGet: {
    method: 'GET' as const,
    summary: 'Get specific knowledge document by ID',
    description: 'Returns complete knowledge document information and content',
    path: '/knowledge/:id',
    pathParams: z.object({ id: z.coerce.number() }),
    responses: {
      200: R.success(KnowledgeEntitySchema),
      400: R.error,
      401: R.error,
      403: R.error,
      500: R.error,
    },
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
});

export { contract };
