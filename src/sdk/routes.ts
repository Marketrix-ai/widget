/**
 * API Routes Contract Definition
 *
 * This file defines the Marketrix API contract, using oRPC for type safety and documentation.
 * It includes all endpoints grouped by functionality, with useful descriptions.
 *
 * Route Categories:
 * - Root: System health and index endpoints
 * - Auth: User authentication and OAuth
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

import { oc } from '@orpc/contract';
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
  IntegrationWithAgentSchema,
  KnowledgeEntitySchema,
  KnowledgeTypeSchema,
  MeetingCreateSchema,
  MeetingEntitySchema,
  MeetingJoinRequestSchema,
  MeetingUpdateSchema,
  MigrationPrepareSchema,
  MigrationRunSchema,
  MindMapSchema,
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
  UserQuotaSchema,
  UserUpdateSchema,
  WidgetSettingsDataSchema,
} from './schema';

// Main contract with all routes
const contract = {
  // ============================================================================
  // ROOT ROUTES - Basic system endpoints
  // ============================================================================

  getIndex: oc
    .route({
      method: 'GET',
      tags: ['Root'],
      path: '/',
      summary: 'Get API index information and basic system details',
      description: 'Returns general API information, version, and available endpoints',
    })
    .output(IndexResponseSchema),

  getHealth: oc
    .route({
      method: 'GET',
      tags: ['Root'],
      path: '/health',
      summary: 'Health check endpoint for monitoring system status',
      description: 'Returns current system health, database connectivity, and service status',
    })
    .output(HealthResponseSchema),

  getPublicConfig: oc
    .route({
      method: 'GET',
      tags: ['Root'],
      path: '/config/public',
      summary: 'Get public client configuration',
      description: 'Returns widget key and widget ID. No auth. Values are stored in backend env only.',
    })
    .output(PublicConfigSchema),

  // ============================================================================
  // AUTHENTICATION ROUTES - User authentication and authorization
  // ============================================================================

  authMe: oc
    .route({
      method: 'GET',
      tags: ['Auth'],
      path: '/auth/me',
      summary: 'Get current authenticated user and tenant information',
      description: 'Returns user profile and tenant data based on session cookie',
    })
    .output(
      z.object({
        user: UserEntitySchema,
        tenant: TenantEntitySchema.nullable(),
      }),
    ),

  // ============================================================================
  // ONBOARDING ROUTES - User and tenant onboarding
  // ============================================================================

  onboard: oc
    .route({
      method: 'POST',
      tags: ['Onboarding'],
      path: '/onboard',
      summary: 'Complete user onboarding in one atomic operation',
      description: 'Creates tenant, updates user status, and invites team members',
    })
    .input(
      z.object({
        name: z.string().min(1).max(45),
        domain: z.string().min(1).max(200),
        team_emails: z.array(z.string().email()).optional().default([]),
      }),
    )
    .output(z.object({ tenant: TenantEntitySchema })),

  // ============================================================================
  // MEETING ROUTES - Video meeting management and operations
  // ============================================================================

  meetingCreate: oc
    .route({
      method: 'POST',
      tags: ['Meeting'],
      path: '/meeting',
      summary: 'Create a new video meeting session',
      description: 'Creates meeting room with specified settings and returns meeting details',
    })
    .input(MeetingCreateSchema)
    .output(MeetingEntitySchema),

  meetingSearch: oc
    .route({
      method: 'GET',
      tags: ['Meeting'],
      path: '/meeting',
      summary: 'Search and filter meetings by various criteria',
      description: 'Returns list of meetings matching search parameters (tenant, client, user)',
    })
    .input(
      z.object({
        tenant_id: z.coerce.number().optional(),
        client_id: z.coerce.number().optional(),
        user_id: z.coerce.number().optional(),
      }),
    )
    .output(z.array(MeetingEntitySchema)),

  meetingCount: oc
    .route({
      method: 'GET',
      tags: ['Meeting'],
      path: '/meeting/count',
      summary: 'Get total count of meetings for a tenant',
      description: 'Returns number of meetings associated with specified tenant',
    })
    .input(z.object({ tenant_id: z.coerce.number().optional() }))
    .output(z.number()),

  meetingGet: oc
    .route({
      method: 'GET',
      tags: ['Meeting'],
      path: '/meeting/{meeting_id}',
      summary: 'Get specific meeting details by ID',
      description: 'Returns complete meeting information including participants and settings',
    })
    .input(z.object({ meeting_id: z.string() }))
    .output(MeetingEntitySchema),

  meetingUpdate: oc
    .route({
      method: 'PUT',
      tags: ['Meeting'],
      path: '/meeting/{meeting_id}',
      summary: 'Update meeting settings and configuration',
      description: 'Modifies meeting properties like title, duration, or participant settings',
    })
    .input(MeetingUpdateSchema.extend({ meeting_id: z.string() }))
    .output(MeetingEntitySchema),

  meetingDelete: oc
    .route({
      method: 'DELETE',
      tags: ['Meeting'],
      path: '/meeting/{meeting_id}',
      summary: 'Delete a meeting and clean up associated resources',
      description: 'Removes meeting from system and cancels any scheduled sessions',
    })
    .input(z.object({ meeting_id: z.string() }))
    .output(z.void()),

  meetingJoin: oc
    .route({
      method: 'POST',
      tags: ['Meeting'],
      path: '/meeting/{meeting_id}/join',
      summary: 'Join an existing meeting session',
      description: 'Authenticates user and provides meeting access credentials',
    })
    .input(MeetingJoinRequestSchema.extend({ meeting_id: z.string() }))
    .output(TokenSchema),

  meetingEnd: oc
    .route({
      method: 'POST',
      tags: ['Meeting'],
      path: '/meeting/{meeting_id}/end',
      summary: 'End an active meeting session',
      description: 'Terminates meeting and updates participant status',
    })
    .input(z.object({ meeting_id: z.string() }))
    .output(z.void()),

  // ============================================================================
  // TENANT ROUTES - Organization and workspace management
  // ============================================================================

  tenantCreate: oc
    .route({
      method: 'POST',
      tags: ['Tenant'],
      path: '/tenant',
      summary: 'Create a new tenant organization',
      description: 'Creates new tenant with specified settings and returns tenant entity',
    })
    .input(TenantCreateSchema)
    .output(TenantEntitySchema),

  tenantSearch: oc
    .route({
      method: 'GET',
      tags: ['Tenant'],
      path: '/tenant',
      summary: 'Search and filter tenants by various criteria',
      description: 'Returns list of tenants matching search parameters (name, domain, email, etc.)',
    })
    .input(
      z.object({
        name: z.string().optional(),
        domain: z.string().optional(),
        email: z.string().email().optional(),
        app_id: z.coerce.number().optional(),
        tenant_id: z.coerce.number().optional(),
        user_id: z.coerce.number().optional(),
      }),
    )
    .output(z.array(TenantEntitySchema)),

  tenantGet: oc
    .route({
      method: 'GET',
      tags: ['Tenant'],
      path: '/tenant/{tenant_id}',
      summary: 'Get specific tenant details by ID',
      description: 'Returns complete tenant information including settings and configuration',
    })
    .input(z.object({ tenant_id: z.coerce.number() }))
    .output(TenantEntitySchema),

  tenantUpdate: oc
    .route({
      method: 'PUT',
      tags: ['Tenant'],
      path: '/tenant/{tenant_id}',
      summary: 'Update tenant settings and configuration',
      description: 'Modifies tenant properties like name, domain, or feature settings',
    })
    .input(TenantUpdateSchema.extend({ tenant_id: z.coerce.number() }))
    .output(TenantEntitySchema),

  tenantDelete: oc
    .route({
      method: 'DELETE',
      tags: ['Tenant'],
      path: '/tenant/{tenant_id}',
      summary: 'Delete tenant and all associated data',
      description: 'Removes tenant from system and cleans up all related resources',
    })
    .input(z.object({ tenant_id: z.coerce.number() }))
    .output(z.void()),

  // ============================================================================
  // CONNECTION ROUTES - App and website connection management
  // ============================================================================

  connectionCreate: oc
    .route({
      method: 'POST',
      tags: ['Connection'],
      path: '/connection',
      summary: 'Create a new connection',
      description: 'Creates a new app or website connection for a tenant',
    })
    .input(ConnectionCreateSchema)
    .output(ConnectionEntitySchema),

  connectionSearch: oc
    .route({
      method: 'GET',
      path: '/connections',
      summary: 'Search connections for tenant',
      description:
        'Returns connections for the authenticated tenant, optionally filtered by type, always includes integrations',
    })
    .input(
      z.object({
        type: ConnectionTypeSchema.optional(),
      }),
    )
    .output(
      z.array(
        ConnectionEntitySchema.extend({
          integrations: z.array(IntegrationEntitySchema),
        }),
      ),
    ),

  connectionGet: oc
    .route({
      method: 'GET',
      tags: ['Connection'],
      path: '/connection/{connection_id}',
      summary: 'Get connection by ID',
      description: 'Returns specific connection details by connection ID, always includes integrations',
    })
    .input(z.object({ connection_id: z.coerce.number() }))
    .output(
      ConnectionEntitySchema.extend({
        integrations: z.array(IntegrationEntitySchema),
      }),
    ),

  connectionUpdate: oc
    .route({
      method: 'PUT',
      tags: ['Connection'],
      path: '/connection/{connection_id}',
      summary: 'Update connection',
      description: 'Updates connection details and configuration',
    })
    .input(ConnectionUpdateSchema.extend({ connection_id: z.coerce.number() }))
    .output(ConnectionEntitySchema),

  connectionDelete: oc
    .route({
      method: 'DELETE',
      tags: ['Connection'],
      path: '/connection/{connection_id}',
      summary: 'Delete connection',
      description: 'Removes a connection and all associated integrations',
    })
    .input(z.object({ connection_id: z.coerce.number() }))
    .output(z.void()),

  // ============================================================================
  // INTEGRATION ROUTES - Widget, Slack, and other integration management
  // ============================================================================

  integrationCreate: oc
    .route({
      method: 'POST',
      tags: ['Integration'],
      path: '/integration',
      summary: 'Create a new integration',
      description: 'Creates a new integration (widget, slack, etc.) for a connection',
    })
    .input(IntegrationCreateSchema)
    .output(IntegrationEntitySchema),

  integrationSearch: oc
    .route({
      method: 'GET',
      tags: ['Integration'],
      path: '/integration',
      summary: 'Search integrations for tenant',
      description: 'Search integrations by type, connection, marketrix_id, or marketrix_key',
    })
    .input(
      z.object({
        type: IntegrationTypeSchema.optional(),
        connection_id: z.coerce.number().optional(),
        marketrix_id: z.string().optional(),
        marketrix_key: z.string().optional(),
      }),
    )
    .output(z.array(IntegrationWithAgentSchema)),

  integrationGetDefaults: oc
    .route({
      method: 'GET',
      path: '/integration/defaults/{type}',
      summary: 'Get default settings for integration type',
      description: 'Returns default settings for the specified integration type (widget or slack)',
    })
    .input(z.object({ type: IntegrationTypeSchema }))
    .output(z.union([WidgetSettingsDataSchema, SlackSettingsDataSchema])),

  integrationGet: oc
    .route({
      method: 'GET',
      tags: ['Integration'],
      path: '/integration/{integration_id}',
      summary: 'Get integration by ID',
      description: 'Returns specific integration details by integration ID including snippet code',
    })
    .input(z.object({ integration_id: z.coerce.number() }))
    .output(IntegrationEntitySchema),

  integrationUpdate: oc
    .route({
      method: 'PUT',
      tags: ['Integration'],
      path: '/integration/{integration_id}',
      summary: 'Update integration',
      description: 'Updates integration settings and configuration',
    })
    .input(IntegrationUpdateSchema.extend({ integration_id: z.coerce.number() }))
    .output(IntegrationEntitySchema),

  integrationDelete: oc
    .route({
      method: 'DELETE',
      tags: ['Integration'],
      path: '/integration/{integration_id}',
      summary: 'Delete integration',
      description: 'Removes an integration from a connection',
    })
    .input(z.object({ integration_id: z.coerce.number() }))
    .output(z.void()),

  // ============================================================================
  // CHAT ROUTES - AI-powered chat and conversation management
  // ============================================================================

  chatCreate: oc
    .route({
      method: 'POST',
      tags: ['Chat'],
      path: '/chat',
      summary: 'Create a new chat thread',
      description: 'Initializes new chat thread and returns session ID',
    })
    .output(z.string()),

  chatSearch: oc
    .route({
      method: 'GET',
      tags: ['Chat'],
      path: '/chat',
      summary: 'Search chats by user',
      description: 'Returns chat list and quota for the specified user',
    })
    .input(
      z.object({
        user_id: z.coerce.number().optional(),
        chat_id: z.coerce.number().optional(),
      }),
    )
    .output(UserQuotaSchema),

  chatTell: oc
    .route({
      method: 'POST',
      path: '/chat/{chat_id}/tell',
      summary: 'Request tell mode response for given content',
      description: 'Processes explanation request and returns AI response (voice+text) as a data URL',
    })
    .input(ChatRequestSchema.and(z.object({ chat_id: z.string() })))
    .output(ChatResponseSchema),

  chatShow: oc
    .route({
      method: 'POST',
      path: '/chat/{chat_id}/show',
      summary: 'Request show mode response for given content',
      description: 'Processes user introduction and returns AI response (voice+text) as a data URL',
    })
    .input(ChatRequestSchema.and(z.object({ chat_id: z.string() })))
    .output(ChatResponseSchema),

  chatDo: oc
    .route({
      method: 'POST',
      path: '/chat/{chat_id}/do',
      summary: 'Request do mode response for given content',
      description: 'Processes action request and returns AI response (voice+text) as a data URL',
    })
    .input(ChatRequestSchema.and(z.object({ chat_id: z.string() })))
    .output(ChatResponseSchema),

  chatStop: oc
    .route({
      method: 'POST',
      path: '/chat/{chat_id}/stop',
      summary: 'Stop a running show/do mode task',
      description: 'Stops an ongoing task for the given chat_id',
    })
    .input(
      z.object({
        chat_id: z.string(),
        task_id: z.string().optional(),
      }),
    )
    .output(z.object({ status: z.string(), message: z.string() })),

  // ============================================================================
  // USER ROUTES - User account management and operations
  // ============================================================================

  userSearch: oc
    .route({
      method: 'GET',
      tags: ['User'],
      path: '/user',
      summary: 'Search and filter users by tenant',
      description: 'Returns list of users associated with specified tenant',
    })
    .input(
      z.object({
        tenant_id: z.coerce.number().optional(),
        status: EntityStatusSchema.optional(),
      }),
    )
    .output(z.array(UserEntitySchema)),

  userCreateBatch: oc
    .route({
      method: 'POST',
      tags: ['User'],
      path: '/user/batch',
      summary: 'Create multiple users in batch operation',
      description: 'Processes bulk user creation and returns results for each user',
    })
    .input(BatchUserCreateSchema)
    .output(z.array(BatchUserCreateResultSchema)),

  userGet: oc
    .route({
      method: 'GET',
      tags: ['User'],
      path: '/user/{user_id}',
      summary: 'Get specific user details by ID',
      description: 'Returns complete user information including profile and settings',
    })
    .input(z.object({ user_id: z.coerce.number() }))
    .output(UserEntitySchema),

  userUpdate: oc
    .route({
      method: 'PUT',
      tags: ['User'],
      path: '/user/{user_id}',
      summary: 'Update user profile and settings',
      description: 'Modifies user properties like name, email, or preferences',
    })
    .input(UserUpdateSchema.extend({ user_id: z.coerce.number() }))
    .output(UserEntitySchema),

  userUpdateImage: oc
    .route({
      method: 'PUT',
      path: '/user/{user_id}/image',
      summary: 'Upload and update user profile image',
      description: 'Handles file upload for user avatar and returns upload response',
    })
    .input(FileSchema.extend({ user_id: z.coerce.number() }))
    .output(FileUploadResponseSchema),

  userDelete: oc
    .route({
      method: 'DELETE',
      tags: ['User'],
      path: '/user/{user_id}',
      summary: 'Delete user account and all associated data',
      description: 'Removes user from system and cleans up all related resources',
    })
    .input(z.object({ user_id: z.coerce.number() }))
    .output(z.void()),

  userDeactivate: oc
    .route({
      method: 'POST',
      tags: ['User'],
      path: '/user/{user_id}/deactivate',
      summary: 'Deactivate user account without deletion',
      description: 'Deactivates user access while preserving data for potential reactivation',
    })
    .input(z.object({ user_id: z.coerce.number(), reason: z.string().optional() }))
    .output(z.void()),

  // ============================================================================
  // AGENT ROUTES - AI agent creation and management
  // ============================================================================

  agentCreate: oc
    .route({
      method: 'POST',
      tags: ['Agent'],
      path: '/agent',
      summary: 'Create new AI agent with configuration',
      description: 'Creates agent with specified settings, prompts, and returns agent entity',
    })
    .input(AgentCreateSchema)
    .output(AgentEntitySchema),

  agentSearch: oc
    .route({
      method: 'GET',
      tags: ['Agent'],
      path: '/agent',
      summary: 'Search and filter agents by tenant or user',
      description: 'Returns list of agents matching search parameters',
    })
    .input(
      z.object({
        tenant_id: z.coerce.number().optional(),
        user_id: z.coerce.number().optional(),
        connection_id: z.coerce.number().optional(),
      }),
    )
    .output(z.array(AgentEntitySchema)),

  agentGet: oc
    .route({
      method: 'GET',
      tags: ['Agent'],
      path: '/agent/{agent_id}',
      summary: 'Get specific agent details by ID',
      description: 'Returns complete agent information including configuration and settings',
    })
    .input(z.object({ agent_id: z.coerce.number() }))
    .output(AgentEntitySchema),

  agentMindmap: oc
    .route({
      method: 'GET',
      tags: ['Agent'],
      path: '/agent/{agent_id}/mindmap',
      summary: 'Get agent mindmap by ID',
      description: 'Returns the mindmap knowledge graph for the specified agent',
    })
    .input(z.object({ agent_id: z.coerce.number() }))
    .output(MindMapSchema),

  agentUpdate: oc
    .route({
      method: 'PUT',
      tags: ['Agent'],
      path: '/agent/{agent_id}',
      summary: 'Update agent configuration and settings',
      description: 'Modifies agent properties like prompts, behavior, or appearance',
    })
    .input(
      AgentUpdateSchema.extend({ agent_id: z.coerce.number(), force_reset_learning: z.coerce.boolean().optional() }),
    )
    .output(AgentEntitySchema),

  agentDelete: oc
    .route({
      method: 'DELETE',
      tags: ['Agent'],
      path: '/agent/{agent_id}',
      summary: 'Delete agent and all associated data',
      description: 'Removes agent from system and cleans up all related resources',
    })
    .input(z.object({ agent_id: z.coerce.number() }))
    .output(z.void()),

  agentIndexSimulation: oc
    .route({
      method: 'POST',
      path: '/agent/{agent_id}/index',
      summary: 'Index simulation document into agent knowledge base',
      description: "Adds a simulation document to an agent's knowledge base and refreshes the search index",
    })
    .input(AgentSimulationIndexRequestSchema.extend({ agent_id: z.coerce.number() }))
    .output(AgentSimulationIndexResponseSchema),

  agentIndexCallback: oc
    .route({
      method: 'POST',
      tags: ['Agent'],
      path: '/agent/index/callback',
      summary: 'Callback endpoint for agent index creation completion',
      description: 'Called by agent service when index creation completes (vector_index or graph_index)',
    })
    .input(AgentIndexCallbackRequestSchema)
    .output(AgentIndexCallbackResponseSchema),

  agentResetLearning: oc
    .route({
      method: 'POST',
      tags: ['Agent'],
      path: '/agent/{agent_id}/reset-learning',
      summary: 'Force reset agent from stuck learning state',
      description:
        'Resets an agent that is stuck in learning state, setting it to error status with a message explaining the reset',
    })
    .input(z.object({ agent_id: z.coerce.number() }))
    .output(AgentEntitySchema),

  agentVideoGenerate: oc
    .route({
      method: 'POST',
      tags: ['Agent'],
      path: '/agent/{agent_id}/video',
      summary: 'Generate video for agent from its last simulation',
      description: 'Generates a walkthrough video from agent simulation screenshots',
    })
    .input(AgentVideoGenerateRequestSchema.extend({ agent_id: z.coerce.number() }))
    .output(z.object({ video_url: z.string() })),

  // ============================================================================
  // ACTIVITY LOG ROUTES - System activity tracking and auditing
  // ============================================================================

  activityLogCreate: oc
    .route({
      method: 'POST',
      path: '/log',
      summary: 'Create new activity log entry',
      description: 'Records user or system action for auditing and tracking purposes',
    })
    .input(ActionLogCreateSchema)
    .output(ActionLogEntitySchema),

  activityLogSearch: oc
    .route({
      method: 'GET',
      path: '/log',
      summary: 'Search and filter activity logs',
      description: 'Returns list of activity logs matching search parameters (tenant, type)',
    })
    .input(
      z.object({
        tenant_id: z.coerce.number().optional(),
        type: ActionLogTypeSchema.optional(),
      }),
    )
    .output(z.array(ActionLogEntitySchema)),

  // ============================================================================
  // TOUR ROUTES - Interactive tour and guidance system
  // ============================================================================

  tourQuery: oc
    .route({
      method: 'GET',
      tags: ['Tour'],
      path: '/tour/query',
      summary: 'Get tour information based on question and tenant',
      description: 'Returns relevant tour steps and guidance for user query',
    })
    .input(
      z.object({
        connection_id: z.coerce.number().optional(),
        question: z.string().min(1),
      }),
    )
    .output(TourEntitySchema),

  tourSearch: oc
    .route({
      method: 'GET',
      tags: ['Tour'],
      path: '/tour',
      summary: 'Search and filter tours by tenant',
      description: 'Returns list of available tours for specified tenant',
    })
    .input(
      z.object({
        tenant_id: z.coerce.number().optional(),
        connection_id: z.coerce.number().optional(),
      }),
    )
    .output(z.array(TourEntitySchema)),

  tourCreate: oc
    .route({
      method: 'POST',
      tags: ['Tour'],
      path: '/tour',
      summary: 'Create new interactive tour',
      description: 'Creates tour with specified steps and configuration',
    })
    .input(TourEntitySchema)
    .output(TourEntitySchema),

  tourShow: oc
    .route({
      method: 'POST',
      tags: ['Tour'],
      path: '/tour/show',
      summary: 'Show tour spotlight and description',
      description: 'Triggers tour spotlight for a specific step and element',
    })
    .input(
      z.object({
        step: TourStepSchema,
        element_selector: z.string().optional(),
      }),
    )
    .output(
      z.object({
        success: z.boolean(),
        message: z.string(),
        spotlight_created: z.boolean(),
        description_created: z.boolean(),
        step_id: z.number(),
        element_found: z.boolean(),
      }),
    ),

  // ============================================================================
  // URL GUIDE ROUTES - URL-based guidance messages for widget
  // ============================================================================

  urlGuideSearch: oc
    .route({
      method: 'GET',
      tags: ['URL Guide'],
      path: '/url-guide',
      summary: 'Search URL guides by integration',
      description: 'Returns list of URL guides for specified integration',
    })
    .input(
      z.object({
        integration_id: z.coerce.number(),
      }),
    )
    .output(z.array(UrlGuideEntitySchema)),

  urlGuideCreate: oc
    .route({
      method: 'POST',
      tags: ['URL Guide'],
      path: '/url-guide',
      summary: 'Create new URL guide',
      description: 'Creates URL guide with pattern and message',
    })
    .input(UrlGuideCreateSchema)
    .output(UrlGuideEntitySchema),

  urlGuideGet: oc
    .route({
      method: 'GET',
      tags: ['URL Guide'],
      path: '/url-guide/{id}',
      summary: 'Get URL guide by ID',
      description: 'Returns URL guide details',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(UrlGuideEntitySchema),

  urlGuideUpdate: oc
    .route({
      method: 'PUT',
      tags: ['URL Guide'],
      path: '/url-guide/{id}',
      summary: 'Update URL guide',
      description: 'Updates URL guide properties',
    })
    .input(UrlGuideUpdateSchema.extend({ id: z.coerce.number() }))
    .output(UrlGuideEntitySchema),

  urlGuideDelete: oc
    .route({
      method: 'DELETE',
      tags: ['URL Guide'],
      path: '/url-guide/{id}',
      summary: 'Delete URL guide',
      description: 'Removes URL guide from system',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(z.void()),

  urlGuideMatch: oc
    .route({
      method: 'GET',
      tags: ['URL Guide'],
      path: '/url-guide/match',
      summary: 'Find matching URL guide for current URL',
      description: 'Returns matching URL guide for a given URL pattern',
    })
    .input(
      z.object({
        integration_id: z.coerce.number(),
        url: z.string(),
      }),
    )
    .output(UrlGuideEntitySchema.nullable()),

  // ============================================================================
  // SIMULATION ROUTES - Application simulation and testing
  // ============================================================================

  simulationSearch: oc
    .route({
      method: 'GET',
      tags: ['Simulation'],
      path: '/simulation',
      summary: 'Search and filter simulations by tenant',
      description:
        'Returns list of simulations associated with specified tenant. Use connection_id, agent_id, or pinned to filter.',
    })
    .input(
      z.object({
        tenant_id: z.coerce.number().optional(),
        connection_id: z.coerce.number().optional(),
        agent_id: z.coerce.number().optional(),
        pinned: z.any().transform(val => (String(val) === 'true' ? true : String(val) === 'false' ? false : undefined)),
        limit: z.coerce.number().optional(),
        offset: z.coerce.number().optional(),
      }),
    )
    .output(z.array(SimulationEntitySchema)),

  simulationUsers: oc
    .route({
      method: 'GET',
      path: '/simulation/logging-users',
      summary: 'Get users who participated in simulations',
      description: 'Returns users who have started at least one simulation',
    })
    .input(
      z.object({
        tenant_id: z.coerce.number().optional(),
      }),
    )
    .output(z.array(SimulationLoggingUserSchema)),

  simulationStart: oc
    .route({
      method: 'POST',
      tags: ['Simulation'],
      path: '/simulation/start',
      summary: 'Start new application simulation',
      description: 'Creates and initializes simulation with specified parameters',
    })
    .input(SimulationCreateSchema)
    .output(SimulationEntitySchema),

  simulationUpdate: oc
    .route({
      method: 'PUT',
      tags: ['Simulation'],
      path: '/simulation/{simulation_id}',
      summary: 'Update simulation configuration and status',
      description: 'Modifies simulation parameters and updates execution state',
    })
    .input(SimulationUpdateSchema.extend({ simulation_id: z.coerce.number() }))
    .output(SimulationEntitySchema),

  simulationProgress: oc
    .route({
      method: 'GET',
      tags: ['Simulation'],
      path: '/simulation/{simulation_id}/progress',
      summary: 'Get simulation progress history as chat transcript',
      description: 'Returns all progress updates for a simulation ordered chronologically',
    })
    .input(z.object({ simulation_id: z.coerce.number() }))
    .output(z.array(SimulationProgressEntitySchema)),

  simulationLiveView: oc
    .route({
      method: 'GET',
      tags: ['Simulation'],
      path: '/simulation/{simulation_id}/live-view',
      summary: 'Get live view URL for simulation session',
      description: 'Returns Browserbase live view URL for embedding in iframe',
    })
    .input(z.object({ simulation_id: z.coerce.number() }))
    .output(
      z.object({
        job_id: z.string(),
        live_view_url: z.string(),
        status: z.string(),
      }),
    ),

  simulationHistory: oc
    .route({
      method: 'GET',
      tags: ['Simulation'],
      path: '/simulation/{simulation_id}/history',
      summary: 'Get simulation history by ID',
      description: 'Returns the history array for the specified simulation',
    })
    .input(z.object({ simulation_id: z.coerce.number() }))
    .output(z.object({ history: z.array(SimulationStepSchema) })),

  simulationSteps: oc
    .route({
      method: 'GET',
      tags: ['Simulation'],
      path: '/simulation/{simulation_id}/steps',
      summary: 'Get all simulation steps with topic and screenshot link as JSON',
      description:
        'Returns each step with step_number, topic, screenshot_url, and optional title/url for the simulation',
    })
    .input(z.object({ simulation_id: z.coerce.number() }))
    .output(z.array(SimulationStepSummarySchema)),

  simulationMindmap: oc
    .route({
      method: 'GET',
      tags: ['Simulation'],
      path: '/simulation/{simulation_id}/mindmap',
      summary: 'Get simulation mindmap by ID',
      description: 'Returns the mindmap knowledge graph for the specified simulation',
    })
    .input(z.object({ simulation_id: z.coerce.number() }))
    .output(MindMapSchema),

  simulationStop: oc
    .route({
      method: 'POST',
      tags: ['Simulation'],
      path: '/simulation/{simulation_id}/stop',
      summary: 'Stop running simulation',
      description: 'Terminates the simulation session',
    })
    .input(z.object({ simulation_id: z.coerce.number() }))
    .output(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
    ),

  simulationAnswer: oc
    .route({
      method: 'POST',
      tags: ['Simulation'],
      path: '/simulation/{simulation_id}/answer',
      summary: 'Submit answer to simulation question',
      description: 'Submits an answer to a pending question from the simulation agent',
    })
    .input(SimulationAnswerSchema.extend({ simulation_id: z.coerce.number() }))
    .output(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
    ),

  simulationDelete: oc
    .route({
      method: 'DELETE',
      tags: ['Simulation'],
      path: '/simulation/{simulation_id}',
      summary: 'Delete simulation',
      description: 'Removes a simulation and all associated data',
    })
    .input(z.object({ simulation_id: z.coerce.number() }))
    .output(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
    ),

  // ============================================================================
  // RRWEB SESSION ROUTES - RRWeb session recording management
  // ============================================================================

  rrwebSessionUpsert: oc
    .route({
      method: 'POST',
      tags: ['Session'],
      path: '/rrweb-session',
      summary: 'Create or update RRWeb session',
      description: 'Creates a new session or updates an existing one',
    })
    .input(RrwebSessionUpsertSchema)
    .output(RrwebSessionEntitySchema),

  rrwebSessionGet: oc
    .route({
      method: 'GET',
      tags: ['Session'],
      path: '/rrweb-session/{session_id}',
      summary: 'Get RRWeb session by session ID',
      description: 'Retrieves a session by its session_id',
    })
    .input(z.object({ session_id: z.string() }))
    .output(RrwebSessionEntitySchema.nullable()),

  rrwebSessionGetByChat: oc
    .route({
      method: 'GET',
      tags: ['Session'],
      path: '/rrweb-session/chat/{marketrix_chat_id}',
      summary: 'Get RRWeb sessions by marketrix chat ID',
      description: 'Retrieves all sessions for a given marketrix_chat_id',
    })
    .input(z.object({ marketrix_chat_id: z.string() }))
    .output(z.array(RrwebSessionEntitySchema)),

  rrwebSessionSearch: oc
    .route({
      method: 'GET',
      tags: ['Session'],
      path: '/rrweb-session',
      summary: 'Get all RRWeb sessions',
      description: 'Retrieves all sessions ordered by creation date, optionally filtered by connection and date range',
    })
    .input(
      z.object({
        connection_id: z.coerce.number().optional(),
        start_date: z.string().optional(),
        end_date: z.string().optional(),
      }),
    )
    .output(z.array(RrwebSessionEntitySchema)),

  rrwebSessionEvents: oc
    .route({
      method: 'GET',
      tags: ['Session'],
      path: '/rrweb-session/{session_id}/events',
      summary: 'Get RRWeb session events',
      description: 'Fetches all batches from folder, combines them in correct order, and returns events array',
    })
    .input(z.object({ session_id: z.string() }))
    .output(
      z.array(
        z.object({
          type: z.number(),
          timestamp: z.number(),
          data: z.unknown(),
        }),
      ),
    ),

  browserSessionCreate: oc
    .route({
      method: 'POST',
      path: '/browser-session/create',
      summary: 'Create browser session for connection',
      description: 'Creates a browser session and navigates to the connection URL',
    })
    .input(
      z.object({
        connection_id: z.number(),
        agent_id: z.number(),
        connection_url: z.string().nullish(),
      }),
    )
    .output(
      z.object({
        session_id: z.string(),
        live_view_url: z.string(),
      }),
    ),

  browserSessionStopTasks: oc
    .route({
      method: 'POST',
      tags: ['Session'],
      path: '/browser-session/{session_id}/stop-tasks',
      summary: 'Stop all tasks for browser session',
      description: 'Stops all active tasks for widgets connected to the browser session',
    })
    .input(z.object({ session_id: z.string() }))
    .output(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
    ),

  browserSessionStop: oc
    .route({
      method: 'POST',
      tags: ['Session'],
      path: '/browser-session/{session_id}/stop',
      summary: 'Stop browser session',
      description: 'Terminates the browser session',
    })
    .input(z.object({ session_id: z.string() }))
    .output(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
    ),

  // ============================================================================
  // KNOWLEDGE ROUTES - Knowledge base and document management
  // ============================================================================

  knowledgeSearch: oc
    .route({
      method: 'GET',
      tags: ['Knowledge'],
      path: '/knowledge',
      summary: 'Search and filter knowledge base documents',
      description: 'Returns list of knowledge documents matching search parameters',
    })
    .input(
      z.object({
        tenant_id: z.coerce.number().optional(),
        type: KnowledgeTypeSchema.optional(),
        connection_id: z.coerce.number().optional(),
      }),
    )
    .output(z.array(KnowledgeEntitySchema)),

  knowledgeCreate: oc
    .route({
      method: 'POST',
      tags: ['Knowledge'],
      path: '/knowledge',
      summary: 'Upload new knowledge base document',
      description: 'Processes file upload or URL and creates knowledge entry for AI training',
    })
    .input(
      z.object({
        file: z.custom<Express.Multer.File>().optional(),
        connection_id: z.coerce.number(),
        document_url: z.string().url().optional(),
        document_name: z.string().optional(),
        video_url: z.string().url().optional(),
        video_name: z.string().optional(),
      }),
    )
    .output(KnowledgeEntitySchema),

  knowledgeGet: oc
    .route({
      method: 'GET',
      tags: ['Knowledge'],
      path: '/knowledge/{id}',
      summary: 'Get specific knowledge document by ID',
      description: 'Returns complete knowledge document information and content',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(KnowledgeEntitySchema),

  knowledgeDelete: oc
    .route({
      method: 'DELETE',
      tags: ['Knowledge'],
      path: '/knowledge/{id}',
      summary: 'Delete knowledge document',
      description: 'Removes a knowledge document from the database',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(z.void()),

  knowledgeRefresh: oc
    .route({
      method: 'POST',
      tags: ['Knowledge'],
      path: '/knowledge/{id}/refresh',
      summary: 'Refresh knowledge document',
      description: 'Re-fetches HTML content from source URL and updates the document',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(KnowledgeEntitySchema),

  // ============================================================================
  // QA DOCUMENT ROUTES - QA document upload and test result management
  // ============================================================================

  qaDocumentCreate: oc
    .route({
      method: 'POST',
      tags: ['QA'],
      path: '/qa/document',
      summary: 'Upload QA document (file or text)',
      description: 'Uploads a PDF/text file or text content for QA test generation',
    })
    .input(QADocumentCreateSchema)
    .output(QADocumentEntitySchema),

  qaDocumentProcess: oc
    .route({
      method: 'POST',
      tags: ['QA'],
      path: '/qa/document/{id}/process',
      summary: 'Process QA document and generate test cases',
      description:
        'Starts async processing (returns 202). Poll GET /qa/document/:id for status and processing_step until completed/failed.',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(z.object({ document: QADocumentEntitySchema })),

  qaDocumentRefine: oc
    .route({
      method: 'POST',
      tags: ['QA'],
      path: '/qa/document/{id}/refine',
      summary: 'Refine existing QA test cases',
      description: 'Refines existing test cases with a refinement prompt via AI agent API',
    })
    .input(
      z.object({
        id: z.coerce.number(),
        refinementPrompt: z.string().min(5).max(2000),
      }),
    )
    .output(QADocumentProcessingResponseSchema),

  qaDocumentGet: oc
    .route({
      method: 'GET',
      tags: ['QA'],
      path: '/qa/document/{id}',
      summary: 'Get QA document by ID',
      description: 'Retrieves a QA document by its ID',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(QADocumentEntitySchema),

  qaDocumentSearch: oc
    .route({
      method: 'GET',
      tags: ['QA'],
      path: '/qa/document',
      summary: 'List QA documents',
      description: 'Gets all QA documents with run_count and display_title',
    })
    .input(
      z.object({
        connection_id: z.coerce.number().optional(),
      }),
    )
    .output(
      z.array(
        QADocumentEntitySchema.extend({
          run_count: z.number(),
          display_title: z.string(),
          total_failed: z.number(),
          pass_rate: z.number().nullable(),
        }),
      ),
    ),

  qaDocumentUpdate: oc
    .route({
      method: 'PUT',
      tags: ['QA'],
      path: '/qa/document/{id}',
      summary: 'Update QA document status',
      description: 'Updates the status of a QA document',
    })
    .input(
      z.object({
        id: z.coerce.number(),
        status: QADocumentStatusSchema,
      }),
    )
    .output(QADocumentEntitySchema),

  qaDocumentRuns: oc
    .route({
      method: 'GET',
      tags: ['QA'],
      path: '/qa/document/{id}/runs',
      summary: 'List runs for a QA document',
      description: 'Returns all runs for a document with total/passed/failed counts',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(
      z.array(
        QARunEntitySchema.extend({
          total_tests: z.number(),
          passed: z.number(),
          failed: z.number(),
        }),
      ),
    ),

  qaRunGet: oc
    .route({
      method: 'GET',
      tags: ['QA'],
      path: '/qa/run/{id}',
      summary: 'Get a QA run by ID',
      description: 'Returns run details with test results',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(
      QARunEntitySchema.extend({
        test_results: z.array(QATestResultEntitySchema),
      }),
    ),

  qaDocumentRun: oc
    .route({
      method: 'POST',
      tags: ['QA'],
      path: '/qa/document/{id}/run',
      summary: 'Create and start a new QA run',
      description:
        'Creates a new run (clones test cases) and starts execution. Returns 202; poll test-results by run_id.',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(
      z.object({
        run: QARunEntitySchema,
        simulations: z.array(SimulationEntitySchema),
      }),
    ),

  qaTestResultList: oc
    .route({
      method: 'GET',
      path: '/qa/document/{id}/test-results',
      summary: 'Get test results for a QA document',
      description: 'Retrieves test results; optional run_id scopes to that run',
    })
    .input(z.object({ id: z.coerce.number(), run_id: z.coerce.number().optional() }))
    .output(z.array(QATestResultEntitySchema)),

  qaTestResultUpdate: oc
    .route({
      method: 'PUT',
      path: '/qa/test-result/{id}',
      summary: 'Update test result status and progress',
      description: 'Updates a test result with status, progress log, and screenshot',
    })
    .input(
      z.object({
        id: z.coerce.number(),
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
    )
    .output(QATestResultEntitySchema),

  // Execute all tests for a document (creates a run and executes; returns run + simulations)
  qaDocumentExecuteTests: oc
    .route({
      method: 'POST',
      tags: ['QA'],
      path: '/qa/document/{id}/execute',
      summary: 'Create a run and execute all pending tests for a QA document as simulations',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(
      z.object({
        run: QARunEntitySchema,
        simulations: z.array(SimulationEntitySchema),
      }),
    ),

  // Execute a single test
  qaTestResultExecute: oc
    .route({
      method: 'POST',
      path: '/qa/test-result/{id}/execute',
      summary: 'Execute a single test as a simulation',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(
      z.object({
        simulation: SimulationEntitySchema,
      }),
    ),

  // Get simulation linked to test result
  qaTestResultSimulation: oc
    .route({
      method: 'GET',
      path: '/qa/test-result/{id}/simulation',
      summary: 'Get the simulation linked to a test result',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(
      z.object({
        simulation: SimulationEntitySchema.nullable(),
      }),
    ),

  // QA Test Version routes
  qaTestVersionList: oc
    .route({
      method: 'GET',
      path: '/qa/test-result/{id}/versions',
      summary: 'Get version history for a test',
      description: 'Returns all versions of a test case with change history',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(z.array(QATestVersionEntitySchema)),

  qaTestVersionGet: oc
    .route({
      method: 'GET',
      path: '/qa/test-result/{id}/versions/{version}',
      summary: 'Get specific test version',
      description: 'Returns a specific version of a test case',
    })
    .input(z.object({ id: z.coerce.number(), version: z.coerce.number() }))
    .output(QATestVersionEntitySchema),

  qaTestVersionRollback: oc
    .route({
      method: 'POST',
      path: '/qa/test-result/{id}/versions/{version}/rollback',
      summary: 'Rollback to specific version',
      description: 'Restores test to a previous version and creates new version record',
    })
    .input(z.object({ id: z.coerce.number(), version: z.coerce.number() }))
    .output(QATestVersionEntitySchema),

  qaTestVersionCompare: oc
    .route({
      method: 'GET',
      path: '/qa/test-result/{id}/versions/compare',
      summary: 'Compare two versions',
      description: 'Returns differences between two test versions',
    })
    .input(z.object({ id: z.coerce.number(), version1: z.coerce.number(), version2: z.coerce.number() }))
    .output(
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

  // QA Self-Healing routes
  qaHealingAttemptList: oc
    .route({
      method: 'GET',
      path: '/qa/test-result/{id}/healing-attempts',
      summary: 'Get healing attempts for a test',
      description: 'Returns all healing attempts for a specific test result',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(z.array(QAHealingAttemptEntitySchema)),

  qaHealingAttemptApprove: oc
    .route({
      method: 'POST',
      path: '/qa/test-result/{id}/healing-attempts/{attemptId}/approve',
      summary: 'Approve a healing attempt',
      description: 'Applies the repair from a validated healing attempt',
    })
    .input(z.object({ id: z.coerce.number(), attemptId: z.coerce.number() }))
    .output(z.object({ success: z.boolean() })),

  qaHealingAttemptReject: oc
    .route({
      method: 'POST',
      path: '/qa/test-result/{id}/healing-attempts/{attemptId}/reject',
      summary: 'Reject a healing attempt',
      description: 'Marks a healing attempt as rejected',
    })
    .input(z.object({ id: z.coerce.number(), attemptId: z.coerce.number() }))
    .output(z.object({ success: z.boolean() })),

  qaHealingTrigger: oc
    .route({
      method: 'POST',
      path: '/qa/test-result/{id}/heal',
      summary: 'Trigger self-healing for a failed test',
      description: 'Initiates the self-healing workflow for a test result',
    })
    .input(
      z.object({
        id: z.coerce.number(),
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
    )
    .output(
      z.object({
        healed: z.boolean(),
        attemptId: z.number().nullable(),
        analysis: FailureAnalysisSchema.nullable(),
        confidence: z.number().nullable(),
      }),
    ),

  // QA Cross-Browser routes
  qaCrossBrowserRun: oc
    .route({
      method: 'POST',
      path: '/qa/document/{id}/run-cross-browser',
      summary: 'Execute cross-browser tests',
      description: 'Runs tests across multiple browsers (chromium, firefox, webkit)',
    })
    .input(BrowserConfigSchema.extend({ id: z.coerce.number() }))
    .output(
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

  qaCrossBrowserComparison: oc
    .route({
      method: 'GET',
      path: '/qa/document/{id}/cross-browser-comparison',
      summary: 'Get cross-browser comparison',
      description: 'Returns test results comparison across different browsers',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(
      z.object({
        byTest: z.record(
          z.string(),
          z.record(
            z.string(),
            z.object({
              status: z.string(),
              runId: z.number(),
            }),
          ),
        ),
        byBrowser: z.record(
          z.string(),
          z.object({
            passed: z.number(),
            failed: z.number(),
            total: z.number(),
          }),
        ),
      }),
    ),

  qaBrowserConfigUpdate: oc
    .route({
      method: 'PUT',
      path: '/qa/document/{id}/browser-config',
      summary: 'Update browser configuration',
      description: 'Updates the default browser configuration for a QA document',
    })
    .input(BrowserConfigSchema.extend({ id: z.coerce.number() }))
    .output(z.object({ success: z.boolean() })),

  // ============================================================================
  // MIGRATION ROUTES - Database migration and system updates
  // ============================================================================

  migratePrepare: oc
    .route({
      method: 'POST',
      tags: ['Migration'],
      path: '/migrate/prepare',
      summary: 'Prepare database migration',
      description: 'Validates migration requirements and prepares system for migration',
    })
    .input(MigrationPrepareSchema)
    .output(z.object({ message: z.string(), status: z.string(), data: MigrationPrepareSchema })),

  migrateRun: oc
    .route({
      method: 'POST',
      tags: ['Migration'],
      path: '/migrate/run',
      summary: 'Execute database migration',
      description: 'Runs migration scripts and updates database schema',
    })
    .input(MigrationRunSchema)
    .output(z.object({ message: z.string(), status: z.string(), data: MigrationRunSchema })),

  // ============================================================================
  // STRIPE ROUTES - Subscription and payment management
  // ============================================================================

  stripeCreateTrial: oc
    .route({
      method: 'POST',
      tags: ['Stripe'],
      path: '/stripe/trial',
      summary: 'Create a trial subscription',
      description: 'Creates a trial subscription for the authenticated tenant. The trial period is 30 days by default.',
    })
    .input(StripeTrialSchema)
    .output(TrialSubscriptionSchema),

  stripeCreateCheckout: oc
    .route({
      method: 'POST',
      tags: ['Stripe'],
      path: '/stripe/checkout',
      summary: 'Create a checkout session for subscription purchase',
      description:
        'Creates a Stripe checkout session for purchasing a subscription. Returns a session URL for redirect.',
    })
    .input(StripeCheckoutSchema)
    .output(CheckoutSessionSchema),

  stripeCreatePortal: oc
    .route({
      method: 'POST',
      tags: ['Stripe'],
      path: '/stripe/portal',
      summary: 'Create a customer portal session',
      description: 'Creates a Stripe billing portal session for managing subscription, payment methods, and invoices.',
    })
    .input(StripePortalSchema)
    .output(PortalSessionSchema),

  stripeConfirmDowngrade: oc
    .route({
      method: 'POST',
      tags: ['Stripe'],
      path: '/stripe/downgrade',
      summary: 'Confirm and process a subscription downgrade',
      description: 'Processes a confirmed subscription downgrade to a lower tier plan. No payment required.',
    })
    .input(StripeDowngradeSchema)
    .output(StripeDowngradeResponseSchema),

  stripeCancelSubscription: oc
    .route({
      method: 'POST',
      tags: ['Stripe'],
      path: '/stripe/cancel',
      summary: 'Cancel subscription at period end',
      description: 'Cancels the subscription at the end of the current billing period.',
    })
    .input(z.object({ subscriptionId: z.string() }))
    .output(z.object({ subscriptionId: z.string(), cancelAtPeriodEnd: z.boolean() })),

  stripeGetPlan: oc
    .route({
      method: 'GET',
      tags: ['Stripe'],
      path: '/stripe/plan',
      summary: 'Get current plan information',
      description: 'Returns current subscription plan and usage information for authenticated tenant.',
    })
    .output(PlanInfoSchema),

  stripeGetUsage: oc
    .route({
      method: 'GET',
      tags: ['Stripe'],
      path: '/stripe/usage',
      summary: 'Get current usage statistics',
      description: 'Returns actual usage counts for agents, knowledge sources, meetings, storage, and team members.',
    })
    .output(SubscriptionUsageSchema),

  stripeGetPricing: oc
    .route({
      method: 'GET',
      tags: ['Stripe'],
      path: '/stripe/pricing',
      summary: 'Get pricing information for all plans',
      description: 'Returns actual pricing from Stripe for all plans. Ensures frontend displays match Stripe charges.',
    })
    .output(StripePricingSchema),

  stripeGetConfig: oc
    .route({
      method: 'GET',
      tags: ['Stripe'],
      path: '/stripe/config',
      summary: 'Get Stripe configuration for frontend',
      description: 'Returns Stripe publishable key, price IDs, and trial days configuration for frontend use.',
    })
    .output(StripeConfigSchema),

  stripeGetPlans: oc
    .route({
      method: 'GET',
      tags: ['Stripe'],
      path: '/stripe/plans',
      summary: 'Get plan catalog (metadata for display)',
      description: 'Returns plan names, descriptions, features, CTA and styling. No auth required.',
    })
    .output(PlanCatalogSchema),

  stripeWebhook: oc
    .route({
      method: 'POST',
      tags: ['Stripe'],
      path: '/stripe/webhook',
      summary: 'Handle Stripe webhook events',
      description: 'Receives and processes Stripe webhook events for subscription changes, payments, and other events.',
    })
    .input(StripeWebhookEventSchema)
    .output(z.object({ received: z.literal(true) })),
};

export { contract };
