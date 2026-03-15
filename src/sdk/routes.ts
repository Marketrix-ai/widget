/**
 * API Routes Contract Definition
 *
 * This file defines the Marketrix API contract, using oRPC for type safety and documentation.
 * It includes all endpoints grouped by functionality, with useful descriptions.
 *
 * Route Categories (code name → user-facing name):
 * - Root: System health and index endpoints
 * - Auth: User authentication and OAuth
 * - User: User account management
 * - Workspace: Organization and workspace management
 * - Agent: AI agent creation and management
 * - Application: Application management
 * - Knowledge: Knowledge base and document management
 * - Simulation: Simulation runs and results
 * - QA: QA Flows, runs, and test cases
 * - Widget: Widget configuration
 * - Connector: Automation triggers (user-facing: "Connectors")
 * - Chat: AI-powered chat and conversation management
 * - Tour: Guide system (user-facing: "Guides")
 * - Activity Log: System activity tracking and auditing
 * - App Config: In-app configuration management
 * - Rule: Business rule management
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

import { eventIterator, oc } from '@orpc/contract';
import { z } from 'zod';

import {
  ActionLogCreateSchema,
  ActionLogEntitySchema,
  ActionLogTypeSchema,
  AgentCreateSchema,
  AgentEntitySchema,
  AgentSimulationIndexRequestSchema,
  AgentSimulationIndexResponseSchema,
  AgentUpdateSchema,
  AgentVideoGenerateRequestSchema,
  AppEventSchema,
  AppEventScopeSchema,
  ApplicationCreateSchema,
  ApplicationEntitySchema,
  ApplicationTypeSchema,
  ApplicationUpdateSchema,
  BatchUserCreateResultSchema,
  BatchUserCreateSchema,
  BrowserConfigSchema,
  BrowserTypeSchema,
  CheckoutSessionSchema,
  ConnectorEntitySchema,
  ConnectorSearchSchema,
  ConnectorUpsertSchema,
  EntityStatusSchema,
  FailureAnalysisSchema,
  FileSchema,
  FileUploadResponseSchema,
  HealthResponseSchema,
  IndexResponseSchema,
  KnowledgeEntitySchema,
  KnowledgeTypeSchema,
  MigrationPrepareSchema,
  MigrationRunSchema,
  MindMapSchema,
  PlanCatalogSchema,
  PlanInfoSchema,
  PortalSessionSchema,
  PreviewVideoChatEntitySchema,
  PreviewVideoChatSearchSchema,
  PreviewVideoChatUpsertSchema,
  PublicConfigSchema,
  QAFlowCreateSchema,
  QAFlowEntitySchema,
  QAFlowProcessingResponseSchema,
  QAFlowStatusSchema,
  QAHealingAttemptEntrySchema,
  QARunEntitySchema,
  QATestCaseEntitySchema,
  QAVersionHistoryEntrySchema,
  SessionEntitySchema,
  SessionUpsertSchema,
  SimulationAnswerSchema,
  SimulationCreateSchema,
  SimulationEntitySchema,
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
  SubscriptionUsageSchema,
  TourEntitySchema,
  TrialSubscriptionSchema,
  UrlGuideCreateSchema,
  UrlGuideEntitySchema,
  UrlGuideUpdateSchema,
  UserEntitySchema,
  UserQuotaSchema,
  UserUpdateSchema,
  WidgetCommandSchema,
  WidgetCreateSchema,
  WidgetEntitySchema,
  WidgetEventSchema,
  WidgetSettingsDataSchema,
  WidgetTypeSchema,
  WidgetUpdateSchema,
  WidgetWithAgentSchema,
  WorkspaceCreateSchema,
  WorkspaceEntitySchema,
  WorkspaceMemberEntitySchema,
  WorkspaceMemberRoleSchema,
  WorkspaceUpdateSchema,
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

  validateUrl: oc
    .route({
      method: 'GET',
      tags: ['Root'],
      path: '/validate-url',
      summary: 'Validate URL accessibility and DNS resolution',
      description: 'Validates a URL for format, DNS resolution, and HTTP accessibility',
    })
    .input(
      z.object({
        url: z.string(),
        skip_network: z.string().optional(),
      }),
    )
    .output(
      z.object({
        valid: z.boolean(),
        accessible: z.boolean(),
        dnsResolves: z.boolean(),
        error: z.string().optional(),
        warnings: z.array(z.string()).optional(),
      }),
    ),

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
      summary: 'Get current authenticated user and workspace information',
      description: 'Returns user profile and workspace data based on session cookie',
    })
    .output(
      z.object({
        user: UserEntitySchema,
        workspace: WorkspaceEntitySchema.nullable(),
        workspaces: z.array(
          z.object({
            id: z.number(),
            name: z.string(),
            slug: z.string(),
            role: z.enum(['owner', 'member']),
          }),
        ),
      }),
    ),

  // ============================================================================
  // ONBOARDING ROUTES - User and workspace onboarding
  // ============================================================================

  onboard: oc
    .route({
      method: 'POST',
      tags: ['Onboarding'],
      path: '/onboard',
      summary: 'Complete user onboarding in one atomic operation',
      description: 'Creates workspace, updates user status, and invites team members',
    })
    .input(
      z.object({
        name: z.string().min(1).max(45),
        domain: z.string().min(1).max(200),
        team_emails: z.array(z.string().email()).optional().default([]),
        app_url: z.string().optional(),
        app_username: z.string().optional(),
        app_password: z.string().optional(),
      }),
    )
    .output(
      z.object({
        workspace: WorkspaceEntitySchema,
      }),
    ),

  // ============================================================================
  // WORKSPACE ROUTES - Organization and workspace management
  // ============================================================================

  workspaceCreate: oc
    .route({
      method: 'POST',
      tags: ['Workspace'],
      path: '/workspaces',
      summary: 'Create a new workspace',
      description: 'Creates new workspace with specified settings and returns workspace entity',
    })
    .input(WorkspaceCreateSchema)
    .output(WorkspaceEntitySchema),

  workspaceSearch: oc
    .route({
      method: 'GET',
      tags: ['Workspace'],
      path: '/workspaces',
      summary: 'Search and filter workspaces by various criteria',
      description: 'Returns list of workspaces matching search parameters (name, domain, email, etc.)',
    })
    .input(
      z.object({
        name: z.string().optional(),
        domain: z.string().optional(),
        email: z.string().email().optional(),
        app_id: z.coerce.number().optional(),
        workspace_id: z.coerce.number().optional(),
        user_id: z.coerce.number().optional(),
      }),
    )
    .output(z.array(WorkspaceEntitySchema)),

  workspaceGet: oc
    .route({
      method: 'GET',
      tags: ['Workspace'],
      path: '/workspaces/{slug}',
      summary: 'Get specific workspace details by slug',
      description: 'Returns complete workspace information including settings and configuration',
    })
    .input(z.object({ slug: z.string() }))
    .output(WorkspaceEntitySchema),

  workspaceUpdate: oc
    .route({
      method: 'PUT',
      tags: ['Workspace'],
      path: '/workspaces/{slug}',
      summary: 'Update workspace settings and configuration',
      description: 'Modifies workspace properties like name, domain, or feature settings',
    })
    .input(WorkspaceUpdateSchema.extend({ slug: z.string() }))
    .output(WorkspaceEntitySchema),

  workspaceDelete: oc
    .route({
      method: 'DELETE',
      tags: ['Workspace'],
      path: '/workspaces/{slug}',
      summary: 'Delete workspace and all associated data',
      description: 'Removes workspace from system and cleans up all related resources',
    })
    .input(z.object({ slug: z.string() }))
    .output(z.void()),

  // ── Workspace Members ───────────────────────────────────────────────
  workspaceMemberList: oc
    .route({
      method: 'GET',
      tags: ['Workspace'],
      path: '/workspaces/{slug}/members',
      summary: 'List workspace members',
    })
    .input(z.object({ slug: z.string() }))
    .output(
      z.array(
        WorkspaceMemberEntitySchema.extend({
          user: UserEntitySchema.pick({ id: true, email: true, first_name: true, last_name: true, image_url: true }),
        }),
      ),
    ),

  workspaceMemberAdd: oc
    .route({
      method: 'POST',
      tags: ['Workspace'],
      path: '/workspaces/{slug}/members',
      summary: 'Add member to workspace',
    })
    .input(z.object({ slug: z.string(), email: z.string().email(), role: WorkspaceMemberRoleSchema.default('member') }))
    .output(WorkspaceMemberEntitySchema),

  workspaceMemberRemove: oc
    .route({
      method: 'DELETE',
      tags: ['Workspace'],
      path: '/workspaces/{slug}/members/{user_id}',
      summary: 'Remove member from workspace',
    })
    .input(z.object({ slug: z.string(), user_id: z.number() }))
    .output(z.object({ success: z.boolean() })),

  workspaceMemberUpdateRole: oc
    .route({
      method: 'PATCH',
      tags: ['Workspace'],
      path: '/workspaces/{slug}/members/{user_id}',
      summary: 'Update member role',
    })
    .input(z.object({ slug: z.string(), user_id: z.number(), role: WorkspaceMemberRoleSchema }))
    .output(WorkspaceMemberEntitySchema),

  workspaceListForUser: oc
    .route({
      method: 'GET',
      tags: ['Workspace'],
      path: '/users/me/workspaces',
      summary: 'List workspaces for current user',
    })
    .output(z.array(WorkspaceEntitySchema.extend({ role: WorkspaceMemberRoleSchema }))),

  // ============================================================================
  // ADMIN ROUTES - System administration and maintenance
  // ============================================================================

  // Admin
  adminReconcile: oc
    .route({
      method: 'POST',
      path: '/admin/reconcile',
      tags: ['Admin'],
      summary: 'Reconcile Stripe customers and WorkOS users',
      description:
        'Backfills missing Stripe customer IDs for workspaces and real WorkOS user IDs for users. Idempotent and safe to run repeatedly. Requires super user role.',
    })
    .output(
      z.object({
        workspaces_stripe_created: z.number(),
        users_workos_created: z.number(),
        workspace_plans_synced: z.number(),
        trials_provisioned: z.number(),
        stripe_plans_refreshed: z.number(),
        workos_profiles_synced: z.number(),
        errors: z.array(
          z.object({
            type: z.string(),
            id: z.number(),
            error: z.string(),
          }),
        ),
      }),
    ),

  adminMaintenance: oc
    .route({
      method: 'POST',
      path: '/admin/maintenance',
      tags: ['Admin'],
      summary: 'Run periodic maintenance cleanup tasks',
      description:
        'Cleans up orphaned CosmosDB containers, QA simulations not linked to existing runs, and orphaned blob storage files. Idempotent and safe to run repeatedly. Requires super user role.',
    })
    .output(
      z.object({
        cosmos_containers_deleted: z.number(),
        orphaned_qa_simulations_deleted: z.number(),
        orphaned_blob_dirs_deleted: z.number(),
        errors: z.array(
          z.object({
            type: z.string(),
            detail: z.string(),
          }),
        ),
      }),
    ),

  // ============================================================================
  // APPLICATION ROUTES - App and website management
  // ============================================================================

  applicationCreate: oc
    .route({
      method: 'POST',
      tags: ['Application'],
      path: '/applications',
      summary: 'Create a new application',
      description: 'Creates a new application for a workspace',
    })
    .input(ApplicationCreateSchema)
    .output(ApplicationEntitySchema),

  applicationSearch: oc
    .route({
      method: 'GET',
      path: '/applications',
      summary: 'Search applications for workspace',
      description:
        'Returns applications for the authenticated workspace, optionally filtered by type, always includes widgets',
    })
    .input(
      z.object({
        type: ApplicationTypeSchema.optional(),
      }),
    )
    .output(
      z.array(
        ApplicationEntitySchema.extend({
          widgets: z.array(WidgetEntitySchema),
        }),
      ),
    ),

  applicationGet: oc
    .route({
      method: 'GET',
      tags: ['Application'],
      path: '/applications/{application_id}',
      summary: 'Get application by ID',
      description: 'Returns specific application details by ID, always includes widgets',
    })
    .input(z.object({ application_id: z.coerce.number() }))
    .output(
      ApplicationEntitySchema.extend({
        widgets: z.array(WidgetEntitySchema),
      }),
    ),

  applicationUpdate: oc
    .route({
      method: 'PUT',
      tags: ['Application'],
      path: '/applications/{application_id}',
      summary: 'Update application',
      description: 'Updates application details and configuration',
    })
    .input(ApplicationUpdateSchema.extend({ application_id: z.coerce.number() }))
    .output(ApplicationEntitySchema),

  applicationDelete: oc
    .route({
      method: 'DELETE',
      tags: ['Application'],
      path: '/applications/{application_id}',
      summary: 'Delete application',
      description: 'Removes an application and all associated widgets',
    })
    .input(z.object({ application_id: z.coerce.number() }))
    .output(z.void()),

  // ============================================================================
  // WIDGET ROUTES - Widget, Slack, and other widget management
  // ============================================================================

  widgetCreate: oc
    .route({
      method: 'POST',
      tags: ['Widget'],
      path: '/widgets',
      summary: 'Create a new widget',
      description: 'Creates a new widget for an application',
    })
    .input(WidgetCreateSchema)
    .output(WidgetEntitySchema),

  widgetSearch: oc
    .route({
      method: 'GET',
      tags: ['Widget'],
      path: '/widgets',
      summary: 'Search widgets for workspace',
      description: 'Search widgets by type, application, marketrix_id, or marketrix_key',
    })
    .input(
      z.object({
        type: WidgetTypeSchema.optional(),
        application_id: z.coerce.number().optional(),
        marketrix_id: z.string().optional(),
        marketrix_key: z.string().optional(),
      }),
    )
    .output(z.array(WidgetWithAgentSchema)),

  widgetGetDefaults: oc
    .route({
      method: 'GET',
      path: '/widgets/defaults/{type}',
      summary: 'Get default settings for widget type',
      description: 'Returns default settings for the specified widget type',
    })
    .input(z.object({ type: WidgetTypeSchema }))
    .output(z.union([WidgetSettingsDataSchema, SlackSettingsDataSchema])),

  widgetGet: oc
    .route({
      method: 'GET',
      tags: ['Widget'],
      path: '/widgets/{widget_id}',
      summary: 'Get widget by ID',
      description: 'Returns specific widget details by widget ID including snippet code',
    })
    .input(z.object({ widget_id: z.coerce.number() }))
    .output(WidgetEntitySchema),

  widgetUpdate: oc
    .route({
      method: 'PUT',
      tags: ['Widget'],
      path: '/widgets/{widget_id}',
      summary: 'Update widget',
      description: 'Updates widget settings and configuration',
    })
    .input(WidgetUpdateSchema.extend({ widget_id: z.coerce.number() }))
    .output(WidgetEntitySchema),

  widgetDelete: oc
    .route({
      method: 'DELETE',
      tags: ['Widget'],
      path: '/widgets/{widget_id}',
      summary: 'Delete widget',
      description: 'Removes a widget from an application',
    })
    .input(z.object({ widget_id: z.coerce.number() }))
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

  previewVideoChatUpsert: oc
    .route({
      method: 'POST',
      path: '/preview-video-chat',
      summary: 'Create or update preview video chat record',
      description: 'Persists guide preview chat content, history, output, and related simulation metadata',
    })
    .input(PreviewVideoChatUpsertSchema)
    .output(PreviewVideoChatEntitySchema),

  previewVideoChatSearch: oc
    .route({
      method: 'GET',
      path: '/preview-video-chat',
      summary: 'Search preview video chat records',
      description: 'Returns preview chat records filtered by chat_id, agent_id, or simulation_id for current workspace',
    })
    .input(PreviewVideoChatSearchSchema)
    .output(z.array(PreviewVideoChatEntitySchema)),

  previewVideoChatGet: oc
    .route({
      method: 'GET',
      path: '/preview-video-chat/{id}',
      summary: 'Get preview video chat record by ID',
      description: 'Returns a single preview chat record for current workspace',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(PreviewVideoChatEntitySchema.nullable()),

  connectorUpsert: oc
    .route({
      method: 'POST',
      path: '/connector',
      summary: 'Create or update connector',
      description: 'Stores provider credentials and API endpoint details for workspace connectors',
    })
    .input(ConnectorUpsertSchema)
    .output(ConnectorEntitySchema),

  connectorSearch: oc
    .route({
      method: 'GET',
      path: '/connector',
      summary: 'Search connectors',
      description: 'Returns workspace connectors filtered by provider/status',
    })
    .input(ConnectorSearchSchema)
    .output(z.array(ConnectorEntitySchema)),

  connectorGet: oc
    .route({
      method: 'GET',
      path: '/connector/{id}',
      summary: 'Get connector by ID',
      description: 'Returns a single workspace connector',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(ConnectorEntitySchema.nullable()),

  connectorDelete: oc
    .route({
      method: 'DELETE',
      path: '/connector/{id}',
      summary: 'Delete connector',
      description: 'Deletes a connector for current workspace',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(z.void()),
  // ============================================================================
  // USER ROUTES - User account management and operations
  // ============================================================================

  userSearch: oc
    .route({
      method: 'GET',
      tags: ['User'],
      path: '/user',
      summary: 'Search and filter users by workspace',
      description: 'Returns list of users associated with specified workspace',
    })
    .input(
      z.object({
        workspace_id: z.coerce.number().optional(),
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
      summary: 'Search and filter agents by workspace or user',
      description: 'Returns list of agents matching search parameters',
    })
    .input(
      z.object({
        workspace_id: z.coerce.number().optional(),
        user_id: z.coerce.number().optional(),
        application_id: z.coerce.number().optional(),
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
      description: 'Returns list of activity logs matching search parameters (workspace, type)',
    })
    .input(
      z.object({
        workspace_id: z.coerce.number().optional(),
        type: ActionLogTypeSchema.optional(),
        application_id: z.coerce.number().optional(),
      }),
    )
    .output(z.array(ActionLogEntitySchema)),

  // ============================================================================
  // TOUR ROUTES - Interactive tour and guidance system
  // ============================================================================

  tourSearch: oc
    .route({
      method: 'GET',
      tags: ['Tour'],
      path: '/tour',
      summary: 'Search and filter tours by workspace',
      description: 'Returns list of available tours for specified workspace',
    })
    .input(
      z.object({
        workspace_id: z.coerce.number().optional(),
        application_id: z.coerce.number().optional(),
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

  // ============================================================================
  // URL GUIDE ROUTES - URL-based guidance messages for widget
  // ============================================================================

  urlGuideSearch: oc
    .route({
      method: 'GET',
      tags: ['URL Guide'],
      path: '/url-guide',
      summary: 'Search URL guides by widget',
      description: 'Returns list of URL guides for specified widget',
    })
    .input(
      z.object({
        widget_id: z.coerce.number(),
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
        widget_id: z.coerce.number(),
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
      summary: 'Search and filter simulations by workspace',
      description:
        'Returns list of simulations associated with specified workspace. Use application_id, agent_id, or pinned to filter.',
    })
    .input(
      z.object({
        workspace_id: z.coerce.number().optional(),
        application_id: z.coerce.number().optional(),
        agent_id: z.coerce.number().optional(),
        pinned: z.any().transform(val => (String(val) === 'true' ? true : String(val) === 'false' ? false : undefined)),
        source: z.enum(['direct', 'qa']).optional(),
        limit: z.coerce.number().optional(),
        offset: z.coerce.number().optional(),
      }),
    )
    .output(z.array(SimulationEntitySchema)),

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

  simulationAssignAgents: oc
    .route({
      method: 'PUT',
      tags: ['Simulation'],
      path: '/simulation/{simulation_id}/agents',
      summary: 'Assign agents to a simulation',
      description: 'Sets which agents use this simulation for their knowledge. Triggers learning on affected agents.',
    })
    .input(
      z.object({
        simulation_id: z.coerce.number(),
        agent_ids: z.array(z.number()),
      }),
    )
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
        session_id: z.string(),
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
  // SESSION ROUTES - Session recording management
  // ============================================================================

  sessionUpsert: oc
    .route({
      method: 'POST',
      tags: ['Session'],
      path: '/sessions',
      summary: 'Create or update session',
      description: 'Creates a new session or updates an existing one',
    })
    .input(SessionUpsertSchema)
    .output(SessionEntitySchema),

  sessionGet: oc
    .route({
      method: 'GET',
      tags: ['Session'],
      path: '/sessions/{session_id}',
      summary: 'Get session by session ID',
      description: 'Retrieves a session by its session_id',
    })
    .input(z.object({ session_id: z.string() }))
    .output(SessionEntitySchema.nullable()),

  sessionGetByChat: oc
    .route({
      method: 'GET',
      tags: ['Session'],
      path: '/sessions/chat/{chat_id}',
      summary: 'Get sessions by chat ID',
      description: 'Retrieves all sessions for a given chat_id',
    })
    .input(z.object({ chat_id: z.string() }))
    .output(z.array(SessionEntitySchema)),

  sessionSearch: oc
    .route({
      method: 'GET',
      tags: ['Session'],
      path: '/sessions',
      summary: 'Get all sessions',
      description: 'Retrieves all sessions ordered by creation date, optionally filtered by application and date range',
    })
    .input(
      z.object({
        application_id: z.coerce.number().optional(),
        start_date: z.string().optional(),
        end_date: z.string().optional(),
      }),
    )
    .output(z.array(SessionEntitySchema)),

  sessionEvents: oc
    .route({
      method: 'GET',
      tags: ['Session'],
      path: '/sessions/{session_id}/events',
      summary: 'Get session events',
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
      summary: 'Create browser session for application',
      description: 'Creates a browser session and navigates to the application URL',
    })
    .input(
      z.object({
        application_id: z.number(),
        agent_id: z.number(),
        url: z.string().nullish(),
      }),
    )
    .output(
      z.object({
        session_id: z.string(),
        live_view_url: z.string(),
      }),
    ),

  browserSessionStop: oc
    .route({
      method: 'POST',
      tags: ['Browser Session'],
      path: '/browser-session/{session_id}/stop',
      summary: 'Stop browser session',
      description: 'Stops all running tasks and closes the browser session. Set stop_tasks=false to skip task cleanup.',
    })
    .input(
      z.object({
        session_id: z.string(),
        stop_tasks: z.boolean().optional().default(true),
      }),
    )
    .output(z.object({ success: z.boolean(), message: z.string() })),

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
        workspace_id: z.coerce.number().optional(),
        type: KnowledgeTypeSchema.optional(),
        application_id: z.coerce.number().optional(),
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
        application_id: z.coerce.number(),
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

  knowledgeAssignAgents: oc
    .route({
      method: 'PUT',
      tags: ['Knowledge'],
      path: '/knowledge/{knowledge_id}/agents',
      summary: 'Assign agents to a knowledge item',
      description: 'Sets which agents use this knowledge item. Triggers learning on affected agents.',
    })
    .input(
      z.object({
        knowledge_id: z.coerce.number(),
        agent_ids: z.array(z.number()),
      }),
    )
    .output(KnowledgeEntitySchema),

  // ============================================================================
  // QA FLOW ROUTES - QA flow upload and test result management
  // ============================================================================

  qaFlowCreate: oc
    .route({
      method: 'POST',
      tags: ['QA'],
      path: '/qa/document',
      summary: 'Upload QA flow (file or text)',
      description: 'Uploads a PDF/text file or text content for QA test generation',
    })
    .input(QAFlowCreateSchema)
    .output(QAFlowEntitySchema),

  qaFlowProcess: oc
    .route({
      method: 'POST',
      tags: ['QA'],
      path: '/qa/document/{id}/process',
      summary: 'Process QA flow and generate test cases',
      description:
        'Starts async processing (returns 202). Poll GET /qa/document/:id for status and processing_step until completed/failed.',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(z.object({ document: QAFlowEntitySchema })),

  qaFlowRefine: oc
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
    .output(QAFlowProcessingResponseSchema),

  qaFlowGet: oc
    .route({
      method: 'GET',
      tags: ['QA'],
      path: '/qa/document/{id}',
      summary: 'Get QA flow by ID',
      description: 'Retrieves a QA flow by its ID',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(QAFlowEntitySchema),

  qaFlowSearch: oc
    .route({
      method: 'GET',
      tags: ['QA'],
      path: '/qa/document',
      summary: 'List QA flows',
      description: 'Gets all QA flows with run_count and display_title',
    })
    .input(
      z.object({
        application_id: z.coerce.number().optional(),
      }),
    )
    .output(
      z.object({
        documents: z.array(
          QAFlowEntitySchema.extend({
            run_count: z.number(),
            display_title: z.string(),
            total_failed: z.number(),
            pass_rate: z.number().nullable(),
            last_run: z
              .object({
                id: z.number(),
                status: z.string(),
                total_tests: z.number(),
                passed_tests: z.number(),
                failed_tests: z.number(),
                created_at: z.coerce.date().nullable(),
              })
              .nullable(),
          }),
        ),
        metrics: z.object({
          total_flows: z.number(),
          total_runs: z.number(),
          avg_pass_rate: z.number().nullable(),
          total_failed: z.number(),
          total_passed: z.number(),
        }),
      }),
    ),

  qaFlowDelete: oc
    .route({
      method: 'DELETE',
      tags: ['QA'],
      path: '/qa/document/{id}',
      summary: 'Delete QA flow',
      description: 'Deletes a QA flow and all its runs and test cases',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(z.void()),

  qaFlowUpdate: oc
    .route({
      method: 'PUT',
      tags: ['QA'],
      path: '/qa/document/{id}',
      summary: 'Update QA flow status',
      description: 'Updates the status of a QA flow',
    })
    .input(
      z.object({
        id: z.coerce.number(),
        status: QAFlowStatusSchema,
      }),
    )
    .output(QAFlowEntitySchema),

  qaFlowRuns: oc
    .route({
      method: 'GET',
      tags: ['QA'],
      path: '/qa/document/{id}/runs',
      summary: 'List runs for a QA flow',
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
      description: 'Returns run details with test cases',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(
      QARunEntitySchema.extend({
        test_cases: z.array(QATestCaseEntitySchema),
      }),
    ),

  qaRunDelete: oc
    .route({
      method: 'DELETE',
      tags: ['QA'],
      path: '/qa/run/{id}',
      summary: 'Delete a QA run',
      description: 'Deletes a QA run and all its test cases',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(z.void()),

  qaFlowRun: oc
    .route({
      method: 'POST',
      tags: ['QA'],
      path: '/qa/document/{id}/run',
      summary: 'Create and start a new QA run',
      description: 'Creates a new run and starts execution. Returns 202; poll test-cases for execution status.',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(
      z.object({
        run: QARunEntitySchema,
        simulations: z.array(SimulationEntitySchema),
      }),
    ),

  qaTestCaseList: oc
    .route({
      method: 'GET',
      path: '/qa/document/{id}/test-cases',
      summary: 'Get test cases for a QA flow',
      description: 'Retrieves test cases; optional run_id scopes to that run',
    })
    .input(z.object({ id: z.coerce.number(), run_id: z.coerce.number().optional() }))
    .output(z.array(QATestCaseEntitySchema)),

  qaTestCaseUpdate: oc
    .route({
      method: 'PUT',
      path: '/qa/test-case/{id}',
      summary: 'Update test case definition fields',
      description: 'Updates a test case definition (title, objective, steps, etc.)',
    })
    .input(
      z.object({
        id: z.coerce.number(),
        test_title: z.string().optional(),
        test_objective: z.string().optional(),
        test_steps: z.array(z.string()).optional(),
        expected_outcome: z.string().optional(),
        priority: z.enum(['Low', 'Medium', 'High']).optional(),
        is_active: z.boolean().optional(),
      }),
    )
    .output(QATestCaseEntitySchema),

  // Execute all tests for a document (creates a run and executes; returns run + simulations)
  qaFlowExecuteTests: oc
    .route({
      method: 'POST',
      tags: ['QA'],
      path: '/qa/document/{id}/execute',
      summary: 'Create a run and execute all pending tests for a QA flow as simulations',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(
      z.object({
        run: QARunEntitySchema,
        simulations: z.array(SimulationEntitySchema),
      }),
    ),

  // Execute a single test
  qaTestCaseExecute: oc
    .route({
      method: 'POST',
      path: '/qa/test-case/{id}/execute',
      summary: 'Execute a single test case as a simulation',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(
      z.object({
        simulation: SimulationEntitySchema,
      }),
    ),

  // Get simulation linked to test case
  qaTestCaseSimulation: oc
    .route({
      method: 'GET',
      path: '/qa/test-case/{id}/simulation',
      summary: 'Get the simulation linked to a test case',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(
      z.object({
        simulation: SimulationEntitySchema.nullable(),
      }),
    ),

  // QA Test Case Version routes (reads from qa_test_case.version_history JSON)
  qaTestCaseVersionList: oc
    .route({
      method: 'GET',
      path: '/qa/test-case/{id}/versions',
      summary: 'Get version history for a test case',
      description: 'Returns all version entries from the test case version_history JSON',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(z.array(QAVersionHistoryEntrySchema)),

  qaTestCaseVersionGet: oc
    .route({
      method: 'GET',
      path: '/qa/test-case/{id}/versions/{version}',
      summary: 'Get specific test case version',
      description: 'Returns a specific version entry from the test case version_history JSON',
    })
    .input(z.object({ id: z.coerce.number(), version: z.coerce.number() }))
    .output(QAVersionHistoryEntrySchema),

  qaTestCaseVersionRollback: oc
    .route({
      method: 'POST',
      path: '/qa/test-case/{id}/versions/{version}/rollback',
      summary: 'Rollback to specific version',
      description: 'Restores test case to a previous version and appends new version entry',
    })
    .input(z.object({ id: z.coerce.number(), version: z.coerce.number() }))
    .output(QAVersionHistoryEntrySchema),

  qaTestCaseVersionCompare: oc
    .route({
      method: 'GET',
      path: '/qa/test-case/{id}/versions/compare',
      summary: 'Compare two versions',
      description: 'Returns differences between two test case versions',
    })
    .input(z.object({ id: z.coerce.number(), version1: z.coerce.number(), version2: z.coerce.number() }))
    .output(
      z.object({
        version1: QAVersionHistoryEntrySchema,
        version2: QAVersionHistoryEntrySchema,
        diff: z.array(
          z.object({
            field: z.string(),
            oldValue: z.unknown(),
            newValue: z.unknown(),
          }),
        ),
      }),
    ),

  qaTestCaseVersionDelete: oc
    .route({
      method: 'DELETE',
      path: '/qa/test-case/{id}/versions/{version}',
      summary: 'Delete a specific version',
      description: 'Removes a version from history and reverts test case to previous version if it was the latest',
    })
    .input(z.object({ id: z.coerce.number(), version: z.coerce.number() }))
    .output(z.object({ success: z.boolean(), current_version: z.number() })),

  qaTestCaseVersionAccept: oc
    .route({
      method: 'POST',
      path: '/qa/test-case/{id}/versions/{version}/accept',
      summary: 'Accept a specific version',
      description: 'Marks a version as accepted by the user',
    })
    .input(z.object({ id: z.coerce.number(), version: z.coerce.number() }))
    .output(z.object({ success: z.boolean() })),

  // QA Self-Healing routes (reads from qa_test_case.healing_attempts JSON)
  qaHealingAttemptList: oc
    .route({
      method: 'GET',
      path: '/qa/test-case/{id}/healing-attempts',
      summary: 'Get healing attempts for a test case',
      description: 'Returns all healing attempt entries from the test case healing_attempts JSON',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(z.array(QAHealingAttemptEntrySchema)),

  qaHealingAttemptApprove: oc
    .route({
      method: 'POST',
      path: '/qa/test-case/{id}/healing-attempts/{attemptIndex}/approve',
      summary: 'Approve a healing attempt',
      description: 'Applies the repair from a validated healing attempt by array index',
    })
    .input(z.object({ id: z.coerce.number(), attemptIndex: z.coerce.number() }))
    .output(z.object({ success: z.boolean() })),

  qaHealingAttemptReject: oc
    .route({
      method: 'POST',
      path: '/qa/test-case/{id}/healing-attempts/{attemptIndex}/reject',
      summary: 'Reject a healing attempt',
      description: 'Marks a healing attempt as rejected by array index',
    })
    .input(z.object({ id: z.coerce.number(), attemptIndex: z.coerce.number() }))
    .output(z.object({ success: z.boolean() })),

  qaHealingTrigger: oc
    .route({
      method: 'POST',
      path: '/qa/test-case/{id}/heal',
      summary: 'Trigger self-healing for a failed test case',
      description: 'Initiates the self-healing workflow for a test case',
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
        attemptIndex: z.number().nullable(),
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
      description: 'Returns test cases comparison across different browsers',
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
      description: 'Updates the default browser configuration for a QA flow',
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
      description:
        'Creates a trial subscription for the authenticated workspace. The trial period is 30 days by default.',
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

  stripeGetCatalog: oc
    .route({
      method: 'GET',
      tags: ['Stripe'],
      path: '/stripe/catalog',
      summary: 'Get public Stripe catalog (pricing, plans, config)',
      description:
        'Returns pricing from Stripe, plan catalog metadata, and Stripe frontend configuration in a single call.',
    })
    .output(z.object({ pricing: StripePricingSchema, plans: PlanCatalogSchema, config: StripeConfigSchema })),

  stripeGetSubscription: oc
    .route({
      method: 'GET',
      tags: ['Stripe'],
      path: '/stripe/subscription',
      summary: 'Get current subscription plan and usage',
      description:
        'Returns current subscription plan information and actual usage statistics for the authenticated workspace.',
    })
    .output(z.object({ plan: PlanInfoSchema, usage: SubscriptionUsageSchema })),

  // stripeWebhook is handled as a raw Express route — not part of the oRPC contract.

  // ============================================================================
  // WIDGET STREAM - Real-time widget communication via SSE
  // ============================================================================

  widgetStream: oc
    .route({
      method: 'GET',
      tags: ['Widget'],
      path: '/widget/stream',
      summary: 'SSE stream for real-time widget events',
      description:
        'Typed event stream delivering tool calls, task status updates, chat responses, and registration confirmation.',
    })
    .input(
      z.object({
        chat_id: z.string(),
        marketrix_id: z.string().optional(),
        marketrix_key: z.string().optional(),
        agent_id: z.coerce.number().optional(),
        application_id: z.coerce.number().optional(),
      }),
    )
    .output(eventIterator(WidgetEventSchema)),

  widgetMessage: oc
    .route({
      method: 'POST',
      tags: ['Widget'],
      path: '/widget/message',
      summary: 'Send a typed command from widget to server',
      description: 'Receives chat commands, tool responses, and keepalive pings from the widget.',
    })
    .input(
      z.object({
        chat_id: z.string(),
        command: WidgetCommandSchema,
      }),
    )
    .output(z.object({ ok: z.boolean() })),

  // ============================================================================
  // APP EVENTS - Real-time dashboard event stream via SSE
  // ============================================================================

  appEvents: oc
    .route({
      method: 'GET',
      tags: ['App'],
      path: '/app/events',
      summary: 'SSE stream for real-time app dashboard events',
      description:
        'Typed event stream delivering simulation, agent, QA, and user updates filtered by scope and application.',
    })
    .input(
      z.object({
        scopes: z.array(AppEventScopeSchema).min(1),
        application_id: z.coerce.number().optional(),
      }),
    )
    .output(eventIterator(AppEventSchema)),
};

export { contract };
