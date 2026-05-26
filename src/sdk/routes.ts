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
 * - State Trigger: URL-pattern rules that swap widget chips per page (formerly UrlGuide)
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
  ActionCreateSchema,
  ActionEntitySchema,
  ActionLogCreateSchema,
  ActionLogEntitySchema,
  ActionLogTypeSchema,
  ActionSearchSchema,
  ActionUpdateSchema,
  AgentCreateSchema,
  AgentEntitySchema,
  AgentSimulationIndexRequestSchema,
  AgentSimulationIndexResponseSchema,
  AgentUpdateSchema,
  AppEventSchema,
  AppEventScopeSchema,
  ApplicationCreateSchema,
  ApplicationReadSchema,
  ApplicationTypeSchema,
  ApplicationUpdateSchema,
  AutomationCreateSchema,
  AutomationEntitySchema,
  AutomationRunEntitySchema,
  AutomationRunSearchSchema,
  AutomationSearchSchema,
  AutomationUpdateSchema,
  BatchUserCreateResultSchema,
  BatchUserCreateSchema,
  BrowserConfigSchema,
  BrowserTypeSchema,
  ByAgentIdSchema,
  ByApplicationIdSchema,
  ByIdSchema,
  BySimulationIdSchema,
  BySlugSchema,
  ByUserIdSchema,
  ByWidgetIdSchema,
  ChatContextResponseSchema,
  CheckoutSessionSchema,
  ConnectorCapabilitySchema,
  ConnectorEntitySchema,
  ConnectorSearchSchema,
  ConnectorUpsertSchema,
  ContextRefSchema,
  DiffValueSchema,
  DomainPersonaSuggestResponseSchema,
  EntityStatusSchema,
  FailureAnalysisSchema,
  FileSchema,
  FileUploadResponseSchema,
  GithubRepoSchema,
  GithubWorkflowRunSchema,
  HealthResponseSchema,
  HeatmapCandidateSchema,
  HeatmapJobStatusSchema,
  HeatmapPageEntitySchema,
  HeatmapSnapshotEntitySchema,
  HeatmapTypeSchema,
  HeatmapVariationSchema,
  IndexResponseSchema,
  InsightPersonaEntitySchema,
  InsightPersonasResponseSchema,
  InsightPersonasSaveDomainInputSchema,
  InsightPersonaUpdateInputSchema,
  InsightSegmentEntitySchema,
  KnowledgeEntitySchema,
  KnowledgeTypeSchema,
  listOf,
  McpStatusSchema,
  McpToolSchema,
  MindMapSchema,
  NotificationChannelsSchema,
  NotificationEntitySchema,
  NotificationSlackTestSchema,
  paginatedListOf,
  PaginationSchema,
  PlanCatalogSchema,
  PlanInfoSchema,
  PortalSessionSchema,
  PreviewVideoChatEntitySchema,
  PreviewVideoChatSearchSchema,
  PreviewVideoChatUpsertSchema,
  ProviderEntitySchema,
  ProviderNameSchema,
  PublicConfigSchema,
  PushSubscriptionRegisterSchema,
  PushSubscriptionUnregisterSchema,
  QAFlowCreateSchema,
  QAFlowEntitySchema,
  QAFlowProcessingResponseSchema,
  QAFlowStatusSchema,
  QAHealingAttemptEntrySchema,
  QARunEntitySchema,
  QARunTaskEntitySchema,
  QATestCaseEntitySchema,
  QAVersionHistoryEntrySchema,
  ReactionEntitySchema,
  ReactionRunEntitySchema,
  SessionEntitySchema,
  SessionStatsResponseSchema,
  SessionUpsertSchema,
  SimulationAnswerSchema,
  SimulationCreateSchema,
  SimulationEntitySchema,
  SimulationListEntitySchema,
  SimulationProgressEntitySchema,
  SimulationStepSchema,
  SimulationStepSummarySchema,
  SimulationUpdateSchema,
  SlackCapabilitySchema,
  SlackCommandLogEntitySchema,
  SlackCommandLogSearchSchema,
  StateTriggerCreateSchema,
  StateTriggerEntitySchema,
  StateTriggerUpdateSchema,
  StripeCheckoutSchema,
  StripeConfigSchema,
  StripeDowngradeResponseSchema,
  StripeDowngradeSchema,
  StripePortalSchema,
  StripePricingSchema,
  StripeTrialSchema,
  SubscriptionUsageSchema,
  SuccessSchema,
  SuccessWithMessageSchema,
  SuggestedSimulationSchema,
  TrialSubscriptionSchema,
  TriggerCreateSchema,
  TriggerEntitySchema,
  TriggerSearchSchema,
  TriggerUpdateSchema,
  UserEntitySchema,
  UserQuotaSchema,
  UserUpdateSchema,
  VapidPublicKeyResponseSchema,
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
      tags: ['Internal'],
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
        url: z.string().url(),
        skip_network: z.string().optional(),
      }),
    )
    .output(
      z.object({
        valid: z.boolean(),
        accessible: z.boolean(),
        dnsResolves: z.boolean(),
        error: z.string().optional().describe('Error message if URL validation failed'),
        warnings: z.array(z.string()).optional().describe('Non-fatal issues found during URL validation'),
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

  /** @docs-only — raw Express handler; returns HTML, not JSON */
  emailAction: oc
    .route({
      method: 'GET',
      tags: ['Auth'],
      path: '/email-action/{token}',
      summary: 'Process email approval/rejection action',
      description:
        'Handles approve/reject links from admin emails. Token-in-URL authentication (no session required). Returns an HTML page, not JSON.',
    })
    .input(z.object({ token: z.string().min(1) }))
    .output(z.object({ result: z.string().describe('HTML response page') })),

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
        slug: z.string().min(1).max(45).optional(),
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
      z
        .object({
          name: z.string().optional(),
          domain: z.string().optional(),
          email: z.string().email().optional(),
          application_id: z.coerce.number().optional(),
          workspace_id: z.coerce.number().optional(),
          user_id: z.coerce.number().optional(),
        })
        .extend(PaginationSchema.shape),
    )
    .output(paginatedListOf(WorkspaceEntitySchema)),

  workspaceLookup: oc
    .route({
      method: 'GET',
      tags: ['Workspace'],
      path: '/workspaces/lookup/{slug}',
      summary: 'Look up workspace by slug for onboarding',
      description: 'Returns workspace name and slug for join-workspace flow. Requires onboarding-level auth.',
    })
    .input(BySlugSchema)
    .output(z.object({ name: z.string(), slug: z.string() }).nullable()),

  workspaceGet: oc
    .route({
      method: 'GET',
      tags: ['Workspace'],
      path: '/workspaces/{slug}',
      summary: 'Get specific workspace details by slug',
      description: 'Returns complete workspace information including settings and configuration',
    })
    .input(BySlugSchema)
    .output(WorkspaceEntitySchema),

  workspaceSelect: oc
    .route({
      method: 'POST',
      tags: ['Workspace'],
      path: '/workspaces/{slug}/select',
      summary: 'Select the active workspace for the current session',
      description: 'Updates the server-side session workspace context to match the selected workspace slug.',
    })
    .input(BySlugSchema)
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
      description: 'Permanently deletes a workspace and cleans up all related resources. This action cannot be undone.',
    })
    .input(BySlugSchema)
    .output(SuccessSchema),

  // ── Workspace Members ───────────────────────────────────────────────
  workspaceMemberList: oc
    .route({
      method: 'GET',
      tags: ['Workspace'],
      path: '/workspaces/{slug}/members',
      summary: 'List workspace members',
      description: 'Returns all members of the workspace with their user profile details and roles.',
    })
    .input(BySlugSchema)
    .output(
      listOf(
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
      description: 'Invites a user by email to join the workspace with the specified role. Defaults to member role.',
    })
    .input(BySlugSchema.extend({ email: z.string().email(), role: WorkspaceMemberRoleSchema.default('member') }))
    .output(WorkspaceMemberEntitySchema),

  workspaceMemberRemove: oc
    .route({
      method: 'DELETE',
      tags: ['Workspace'],
      path: '/workspaces/{slug}/members/{user_id}',
      summary: 'Remove member from workspace',
      description: 'Removes a user from the workspace by user_id. The user loses access immediately.',
    })
    .input(BySlugSchema.extend({ user_id: z.number() }))
    .output(SuccessSchema),

  workspaceMemberUpdateRole: oc
    .route({
      method: 'PATCH',
      tags: ['Workspace'],
      path: '/workspaces/{slug}/members/{user_id}',
      summary: 'Update member role',
      description: 'Changes the role of a workspace member. Valid roles: owner, member.',
    })
    .input(BySlugSchema.extend({ user_id: z.number(), role: WorkspaceMemberRoleSchema }))
    .output(WorkspaceMemberEntitySchema),

  workspaceListForUser: oc
    .route({
      method: 'GET',
      tags: ['Workspace'],
      path: '/users/me/workspaces',
      summary: 'List workspaces for current user',
      description: 'Returns all workspaces the authenticated user belongs to, including their role in each.',
    })
    .output(listOf(WorkspaceEntitySchema.extend({ role: WorkspaceMemberRoleSchema }))),

  // ============================================================================
  // ADMIN ROUTES - System administration and maintenance
  // ============================================================================

  // Admin
  adminReconcile: oc
    .route({
      method: 'POST',
      path: '/admin/reconcile',
      tags: ['Internal'],
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
      tags: ['Internal'],
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

  adminRebuild: oc
    .route({
      method: 'POST',
      path: '/admin/rebuild',
      tags: ['Internal'],
      summary: 'Rebuild all agent indexes after cleanup',
      description:
        'Removes stale knowledge (missing files), stale simulations (0 steps or missing blobs), then deletes and recreates vector stores and knowledge graphs for every agent. Index creation is async. Requires super user role.',
    })
    .output(
      z.object({
        knowledge_removed: z.number(),
        simulations_removed: z.number(),
        agents_rebuilt: z.number(),
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
      description: 'Creates a new application for the authenticated workspace and returns the created entity.',
    })
    .input(ApplicationCreateSchema)
    .output(ApplicationReadSchema),

  applicationSearch: oc
    .route({
      method: 'GET',
      tags: ['Application'],
      path: '/applications',
      summary: 'Search applications for workspace',
      description:
        'Returns applications for the authenticated workspace, optionally filtered by type, always includes widgets',
    })
    .input(
      z
        .object({
          type: ApplicationTypeSchema.optional(),
          include: z.array(z.enum(['widgets'])).optional(),
        })
        .extend(PaginationSchema.shape),
    )
    .output(
      paginatedListOf(
        ApplicationReadSchema.extend({
          widgets: z.array(WidgetEntitySchema).optional(),
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
    .input(ByApplicationIdSchema)
    .output(
      ApplicationReadSchema.extend({
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
    .output(ApplicationReadSchema),

  applicationDelete: oc
    .route({
      method: 'DELETE',
      tags: ['Application'],
      path: '/applications/{application_id}',
      summary: 'Delete application',
      description: 'Permanently deletes an application and all associated widgets. This action cannot be undone.',
    })
    .input(ByApplicationIdSchema)
    .output(SuccessSchema),

  // ============================================================================
  // WIDGET ROUTES - Widget, Slack, and other widget management
  // ============================================================================

  widgetCreate: oc
    .route({
      method: 'POST',
      tags: ['Widget'],
      path: '/widgets',
      summary: 'Create a new widget',
      description:
        'Creates a new widget for an application and returns the created entity. Requires an application_id.',
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
      z
        .object({
          type: WidgetTypeSchema.optional(),
          application_id: z.coerce.number().optional(),
          marketrix_id: z.string().optional(),
          marketrix_key: z.string().optional(),
          include: z.array(z.enum(['agent'])).optional(),
        })
        .extend(PaginationSchema.shape),
    )
    .output(paginatedListOf(WidgetWithAgentSchema)),

  widgetGetDefaults: oc
    .route({
      method: 'GET',
      tags: ['Widget'],
      path: '/widgets/defaults/{type}',
      summary: 'Get default settings for widget type',
      description: 'Returns default settings for the specified widget type',
    })
    .input(z.object({ type: WidgetTypeSchema }))
    .output(WidgetSettingsDataSchema),

  widgetGet: oc
    .route({
      method: 'GET',
      tags: ['Widget'],
      path: '/widgets/{widget_id}',
      summary: 'Get widget by ID',
      description: 'Returns specific widget details by widget ID including snippet code',
    })
    .input(ByWidgetIdSchema)
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
      description: 'Permanently deletes a widget from an application. This action cannot be undone.',
    })
    .input(ByWidgetIdSchema)
    .output(SuccessSchema),

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
      tags: ['Chat'],
      path: '/preview-video-chat',
      summary: 'Create or update preview video chat record',
      description: 'Persists guide preview chat content, history, output, and related simulation metadata',
    })
    .input(PreviewVideoChatUpsertSchema)
    .output(PreviewVideoChatEntitySchema),

  previewVideoChatSearch: oc
    .route({
      method: 'GET',
      tags: ['Chat'],
      path: '/preview-video-chat',
      summary: 'Search preview video chat records',
      description: 'Returns preview chat records filtered by chat_id, agent_id, or simulation_id for current workspace',
    })
    .input(PreviewVideoChatSearchSchema)
    .output(listOf(PreviewVideoChatEntitySchema)),

  previewVideoChatGet: oc
    .route({
      method: 'GET',
      tags: ['Chat'],
      path: '/preview-video-chat/{id}',
      summary: 'Get preview video chat record by ID',
      description: 'Returns a single preview chat record for current workspace',
    })
    .input(ByIdSchema)
    .output(PreviewVideoChatEntitySchema.nullable()),

  connectorUpsert: oc
    .route({
      method: 'POST',
      tags: ['Connector'],
      path: '/connector',
      summary: 'Create or update connector',
      description: 'Stores provider credentials and API endpoint details for workspace connectors',
    })
    .input(ConnectorUpsertSchema)
    .output(ConnectorEntitySchema),

  connectorSearch: oc
    .route({
      method: 'GET',
      tags: ['Connector'],
      path: '/connector',
      summary: 'Search connectors',
      description: 'Returns workspace connectors filtered by provider/status',
    })
    .input(ConnectorSearchSchema)
    .output(paginatedListOf(ConnectorEntitySchema)),

  connectorGet: oc
    .route({
      method: 'GET',
      tags: ['Connector'],
      path: '/connector/{id}',
      summary: 'Get connector by ID',
      description: 'Returns a single workspace connector',
    })
    .input(ByIdSchema)
    .output(ConnectorEntitySchema.nullable()),

  connectorDelete: oc
    .route({
      method: 'DELETE',
      tags: ['Connector'],
      path: '/connector/{id}',
      summary: 'Delete connector',
      description: 'Permanently deletes a connector for current workspace. This action cannot be undone.',
    })
    .input(ByIdSchema)
    .output(SuccessSchema),

  // ============================================================================
  // GitHub connectivity (UI helper endpoints)
  // ============================================================================

  connectorGithubRepos: oc
    .route({
      method: 'GET',
      tags: ['Connector'],
      path: '/connector/{id}/github/repos',
      summary: 'List GitHub repositories for a GitHub connector',
      description: 'Uses the stored GitHub PAT from the connector to call GitHub /user/repos.',
    })
    .input(
      z.object({
        id: z.coerce.number(),
        per_page: z.coerce.number().int().min(1).max(100).optional(),
        page: z.coerce.number().int().min(1).optional(),
      }),
    )
    .output(z.array(GithubRepoSchema)),

  connectorGithubWorkflowRuns: oc
    .route({
      method: 'GET',
      tags: ['Connector'],
      path: '/connector/{id}/github/repos/{owner}/{repo}/actions/runs',
      summary: 'List GitHub Actions workflow runs',
      description: 'Lists workflow runs for a repository (pass/fail status).',
    })
    .input(
      z.object({
        id: z.coerce.number(),
        owner: z.string().min(1),
        repo: z.string().min(1),
        per_page: z.coerce.number().int().min(1).max(100).optional(),
        page: z.coerce.number().int().min(1).optional(),
      }),
    )
    .output(z.array(GithubWorkflowRunSchema)),

  // ============================================================================
  // MCP ROUTES - MCP connector activation and credential management
  // ============================================================================

  mcpActivate: oc
    .route({
      method: 'POST',
      tags: ['MCP'],
      path: '/mcp/activate',
      summary: 'Activate MCP for an application',
      description: 'Creates or reactivates an MCP connector with auto-generated credentials.',
    })
    .input(z.object({ application_id: z.coerce.number() }))
    .output(McpStatusSchema),

  mcpDeactivate: oc
    .route({
      method: 'POST',
      tags: ['MCP'],
      path: '/mcp/deactivate',
      summary: 'Deactivate MCP for an application',
      description: 'Deactivates the MCP connector. Credentials are preserved but access is revoked.',
    })
    .input(z.object({ application_id: z.coerce.number() }))
    .output(McpStatusSchema),

  mcpRegenerate: oc
    .route({
      method: 'POST',
      tags: ['MCP'],
      path: '/mcp/regenerate',
      summary: 'Regenerate MCP API key',
      description: 'Generates a new API key for the MCP connector. Existing integrations will break.',
    })
    .input(z.object({ application_id: z.coerce.number() }))
    .output(McpStatusSchema),

  mcpStatus: oc
    .route({
      method: 'GET',
      tags: ['MCP'],
      path: '/mcp/status/{application_id}',
      summary: 'Get MCP activation status',
      description: 'Returns the MCP connector status for an application, or null if not activated.',
    })
    .input(z.object({ application_id: z.coerce.number() }))
    .output(McpStatusSchema.nullable()),

  mcpTools: oc
    .route({
      method: 'GET',
      tags: ['MCP'],
      path: '/mcp/tools/{application_id}',
      summary: 'List MCP platform tools',
      description: 'Returns all platform tools with their enabled/disabled state.',
    })
    .input(z.object({ application_id: z.coerce.number() }))
    .output(z.array(McpToolSchema)),

  mcpToolToggle: oc
    .route({
      method: 'PATCH',
      tags: ['MCP'],
      path: '/mcp/tools/toggle',
      summary: 'Toggle a platform tool',
      description: 'Enable or disable a specific platform tool for the MCP server.',
    })
    .input(z.object({ application_id: z.coerce.number(), tool_name: z.string(), enabled: z.boolean() }))
    .output(z.array(McpToolSchema)),

  // ============================================================================
  // AUTOMATION ROUTES - DAG-based workflow engine
  // ============================================================================

  automationCreate: oc
    .route({
      method: 'POST',
      tags: ['Automation'],
      path: '/automation',
      summary: 'Create automation',
      description: 'Creates a DAG-based automation workflow',
    })
    .input(AutomationCreateSchema)
    .output(AutomationEntitySchema),

  automationSearch: oc
    .route({
      method: 'GET',
      tags: ['Automation'],
      path: '/automation',
      summary: 'List automations',
      description: 'Returns automations for the current workspace',
    })
    .input(AutomationSearchSchema)
    .output(paginatedListOf(AutomationEntitySchema)),

  automationGet: oc
    .route({
      method: 'GET',
      tags: ['Automation'],
      path: '/automation/{id}',
      summary: 'Get automation',
      description: 'Returns a single automation with its graph',
    })
    .input(ByIdSchema)
    .output(AutomationEntitySchema.nullable()),

  automationUpdate: oc
    .route({
      method: 'PUT',
      tags: ['Automation'],
      path: '/automation/{id}',
      summary: 'Update automation',
      description: 'Updates automation graph and settings',
    })
    .input(AutomationUpdateSchema)
    .output(AutomationEntitySchema),

  automationDelete: oc
    .route({
      method: 'DELETE',
      tags: ['Automation'],
      path: '/automation/{id}',
      summary: 'Delete automation',
      description: 'Permanently deletes an automation and deregisters its triggers',
    })
    .input(ByIdSchema)
    .output(SuccessSchema),

  automationToggle: oc
    .route({
      method: 'PATCH',
      tags: ['Automation'],
      path: '/automation/{id}/toggle',
      summary: 'Toggle automation',
      description: 'Enable or disable an automation',
    })
    .input(z.object({ id: z.coerce.number(), enabled: z.boolean() }))
    .output(AutomationEntitySchema),

  automationRun: oc
    .route({
      method: 'POST',
      tags: ['Automation'],
      path: '/automation/{id}/run',
      summary: 'Trigger automation run',
      description: 'Manually triggers an automation run',
    })
    .input(ByIdSchema)
    .output(AutomationRunEntitySchema.nullable()),

  automationRunSearch: oc
    .route({
      method: 'GET',
      tags: ['Automation'],
      path: '/automation/{id}/runs',
      summary: 'List automation runs',
      description: 'Returns execution history for an automation',
    })
    .input(z.object({ id: z.coerce.number() }).extend(AutomationRunSearchSchema.shape))
    .output(paginatedListOf(AutomationRunEntitySchema)),

  automationRunGet: oc
    .route({
      method: 'GET',
      tags: ['Automation'],
      path: '/automation/{id}/runs/{run_id}',
      summary: 'Get automation run',
      description: 'Returns a single run with per-node results',
    })
    .input(z.object({ id: z.coerce.number(), run_id: z.coerce.number() }))
    .output(AutomationRunEntitySchema.nullable()),

  // ============================================================================
  // PROVIDER ROUTES - OAuth provider rows (one per workspace × provider)
  // ============================================================================

  providerGet: oc
    .route({
      method: 'GET',
      tags: ['Provider'],
      path: '/provider/{provider}',
      summary: 'Get provider record for a workspace',
    })
    .input(z.object({ provider: ProviderNameSchema }))
    .output(ProviderEntitySchema.nullable()),

  providerDelete: oc
    .route({
      method: 'DELETE',
      tags: ['Provider'],
      path: '/provider/{provider}',
      summary: 'Disconnect a provider',
    })
    .input(z.object({ provider: ProviderNameSchema }))
    .output(SuccessSchema),

  providerRefresh: oc
    .route({
      method: 'POST',
      tags: ['Provider'],
      path: '/provider/{provider}/refresh',
      summary: 'Re-fetch provider data using stored credentials',
    })
    .input(z.object({ provider: ProviderNameSchema }))
    .output(ProviderEntitySchema),

  // ============================================================================
  // TRIGGER ROUTES - Inbound event sources
  // ============================================================================

  triggerCreate: oc
    .route({
      method: 'POST',
      tags: ['Trigger'],
      path: '/trigger',
      summary: 'Create a new trigger',
    })
    .input(TriggerCreateSchema)
    .output(TriggerEntitySchema),

  triggerGet: oc
    .route({
      method: 'GET',
      tags: ['Trigger'],
      path: '/trigger/{trigger_id}',
      summary: 'Get a single trigger',
    })
    .input(z.object({ trigger_id: z.coerce.number() }))
    .output(TriggerEntitySchema),

  triggerSearch: oc
    .route({
      method: 'GET',
      tags: ['Trigger'],
      path: '/trigger',
      summary: 'List triggers',
    })
    .input(TriggerSearchSchema)
    .output(paginatedListOf(TriggerEntitySchema)),

  triggerUpdate: oc
    .route({
      method: 'PUT',
      tags: ['Trigger'],
      path: '/trigger/{trigger_id}',
      summary: 'Update trigger',
    })
    .input(TriggerUpdateSchema)
    .output(TriggerEntitySchema),

  triggerDelete: oc
    .route({
      method: 'DELETE',
      tags: ['Trigger'],
      path: '/trigger/{trigger_id}',
      summary: 'Delete a trigger',
    })
    .input(z.object({ trigger_id: z.coerce.number() }))
    .output(SuccessSchema),

  triggerToggle: oc
    .route({
      method: 'PATCH',
      tags: ['Trigger'],
      path: '/trigger/{trigger_id}/toggle',
      summary: 'Toggle trigger enabled state',
    })
    .input(z.object({ trigger_id: z.coerce.number() }))
    .output(TriggerEntitySchema),

  triggerAutoInstall: oc
    .route({
      method: 'POST',
      tags: ['Trigger'],
      path: '/trigger/{trigger_id}/install',
      summary: 'Auto-install trigger configuration on the provider',
    })
    .input(z.object({ trigger_id: z.coerce.number() }))
    .output(z.object({ success: z.boolean(), message: z.string() })),

  // ============================================================================
  // SLACK COMMAND ROUTES - Slash command log and capabilities
  // ============================================================================

  slackCommandLogSearch: oc
    .route({
      method: 'GET',
      tags: ['Slack'],
      path: '/slack/command-log',
      summary: 'Search slash command logs',
    })
    .input(SlackCommandLogSearchSchema)
    .output(paginatedListOf(SlackCommandLogEntitySchema)),

  slackCapabilities: oc
    .route({
      method: 'GET',
      tags: ['Slack'],
      path: '/slack/capabilities',
      summary: 'Get Slack capability stats',
    })
    .output(z.array(SlackCapabilitySchema)),

  // ============================================================================
  // ACTION ROUTES - Outbound capabilities
  // ============================================================================

  actionCreate: oc
    .route({
      method: 'POST',
      tags: ['Action'],
      path: '/action',
      summary: 'Create a custom action',
    })
    .input(ActionCreateSchema)
    .output(ActionEntitySchema),

  actionGet: oc
    .route({
      method: 'GET',
      tags: ['Action'],
      path: '/action/{action_id}',
      summary: 'Get a single action',
    })
    .input(z.object({ action_id: z.coerce.number() }))
    .output(ActionEntitySchema),

  actionSearch: oc
    .route({
      method: 'GET',
      tags: ['Action'],
      path: '/action',
      summary: 'List actions',
    })
    .input(ActionSearchSchema)
    .output(paginatedListOf(ActionEntitySchema)),

  actionUpdate: oc
    .route({
      method: 'PUT',
      tags: ['Action'],
      path: '/action/{action_id}',
      summary: 'Update action',
    })
    .input(ActionUpdateSchema)
    .output(ActionEntitySchema),

  actionDelete: oc
    .route({
      method: 'DELETE',
      tags: ['Action'],
      path: '/action/{action_id}',
      summary: 'Delete an action',
    })
    .input(z.object({ action_id: z.coerce.number() }))
    .output(SuccessSchema),

  actionToggle: oc
    .route({
      method: 'PATCH',
      tags: ['Action'],
      path: '/action/{action_id}/toggle',
      summary: 'Toggle action enabled state',
    })
    .input(z.object({ action_id: z.coerce.number() }))
    .output(ActionEntitySchema),

  connectorCapabilities: oc
    .route({
      method: 'GET',
      tags: ['Connector'],
      path: '/connector-capabilities',
      summary: 'List connector capabilities',
      description: 'Returns available triggers and callbacks per connector type',
    })
    .input(z.object({}))
    .output(z.array(ConnectorCapabilitySchema)),

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
      z
        .object({
          workspace_id: z.coerce.number().optional(),
          status: EntityStatusSchema.optional(),
        })
        .extend(PaginationSchema.shape),
    )
    .output(paginatedListOf(UserEntitySchema)),

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
    .input(ByUserIdSchema)
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
      tags: ['User'],
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
      description:
        'Permanently deletes a user account and cleans up all related resources. This action cannot be undone.',
    })
    .input(ByUserIdSchema)
    .output(SuccessSchema),

  userDeactivate: oc
    .route({
      method: 'POST',
      tags: ['User'],
      path: '/user/{user_id}/deactivate',
      summary: 'Deactivate user account without deletion',
      description: 'Deactivates user access while preserving data for potential reactivation',
    })
    .input(ByUserIdSchema.extend({ reason: z.string().optional() }))
    .output(SuccessSchema),

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
      description:
        'Returns list of agents matching search parameters. Supports filtering by workspace_id, user_id, and application_id.',
    })
    .input(
      z
        .object({
          workspace_id: z.coerce.number().optional(),
          user_id: z.coerce.number().optional(),
          application_id: z.coerce.number().optional(),
          include: z.array(z.enum(['knowledge', 'simulations'])).optional(),
        })
        .extend(PaginationSchema.shape),
    )
    .output(paginatedListOf(AgentEntitySchema)),

  agentGet: oc
    .route({
      method: 'GET',
      tags: ['Agent'],
      path: '/agent/{agent_id}',
      summary: 'Get specific agent details by ID',
      description: 'Returns complete agent information including configuration and settings',
    })
    .input(ByAgentIdSchema.extend({ include: z.array(z.enum(['knowledge', 'simulations'])).optional() }))
    .output(AgentEntitySchema),

  agentMindmap: oc
    .route({
      method: 'GET',
      tags: ['Agent'],
      path: '/agent/{agent_id}/mindmap',
      summary: 'Get agent mindmap by ID',
      description: 'Returns the mindmap knowledge graph for the specified agent',
    })
    .input(ByAgentIdSchema)
    .output(MindMapSchema),

  agentUpdate: oc
    .route({
      method: 'PUT',
      tags: ['Agent'],
      path: '/agent/{agent_id}',
      summary: 'Update agent configuration and settings',
      description:
        'Updates agent details. For JSON requests, handled by oRPC. Also accepts multipart/form-data for logo file uploads (handled by raw Express route).',
    })
    .input(
      AgentUpdateSchema.extend({
        agent_id: z.coerce.number(),
        force_reset_learning: z.coerce.boolean().optional(),
      }),
    )
    .output(AgentEntitySchema),

  agentDelete: oc
    .route({
      method: 'DELETE',
      tags: ['Agent'],
      path: '/agent/{agent_id}',
      summary: 'Delete agent and all associated data',
      description: 'Permanently deletes an agent and cleans up all related resources. This action cannot be undone.',
    })
    .input(ByAgentIdSchema)
    .output(SuccessSchema),

  agentIndexSimulation: oc
    .route({
      method: 'POST',
      tags: ['Agent'],
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
    .input(ByAgentIdSchema)
    .output(AgentEntitySchema),

  // ============================================================================
  // ACTIVITY LOG ROUTES - System activity tracking and auditing
  // ============================================================================

  activityLogCreate: oc
    .route({
      method: 'POST',
      tags: ['Activity Log'],
      path: '/log',
      summary: 'Create new activity log entry',
      description: 'Records user or system action for auditing and tracking purposes',
    })
    .input(ActionLogCreateSchema)
    .output(ActionLogEntitySchema),

  activityLogSearch: oc
    .route({
      method: 'GET',
      tags: ['Activity Log'],
      path: '/log',
      summary: 'Search and filter activity logs',
      description: 'Returns list of activity logs matching search parameters (workspace, type)',
    })
    .input(
      z
        .object({
          workspace_id: z.coerce.number().optional(),
          type: ActionLogTypeSchema.optional(),
          application_id: z.coerce.number().optional(),
        })
        .extend(PaginationSchema.shape),
    )
    .output(paginatedListOf(ActionLogEntitySchema)),

  // ============================================================================
  // STATE TRIGGER ROUTES - URL-based guidance messages for widget
  // ============================================================================

  stateTriggerSearch: oc
    .route({
      method: 'GET',
      tags: ['State Trigger'],
      path: '/state-trigger',
      summary: 'Search state triggers by widget',
      description: 'Returns list of state triggers for specified widget',
    })
    .input(ByWidgetIdSchema.extend(PaginationSchema.shape))
    .output(paginatedListOf(StateTriggerEntitySchema)),

  stateTriggerCreate: oc
    .route({
      method: 'POST',
      tags: ['State Trigger'],
      path: '/state-trigger',
      summary: 'Create new state trigger',
      description: 'Creates state trigger with pattern and message',
    })
    .input(StateTriggerCreateSchema)
    .output(StateTriggerEntitySchema),

  stateTriggerGet: oc
    .route({
      method: 'GET',
      tags: ['State Trigger'],
      path: '/state-trigger/{id}',
      summary: 'Get state trigger by ID',
      description: 'Returns state trigger details',
    })
    .input(ByIdSchema)
    .output(StateTriggerEntitySchema),

  stateTriggerUpdate: oc
    .route({
      method: 'PUT',
      tags: ['State Trigger'],
      path: '/state-trigger/{id}',
      summary: 'Update state trigger',
      description: 'Updates state trigger properties',
    })
    .input(StateTriggerUpdateSchema.extend({ id: z.coerce.number() }))
    .output(StateTriggerEntitySchema),

  stateTriggerDelete: oc
    .route({
      method: 'DELETE',
      tags: ['State Trigger'],
      path: '/state-trigger/{id}',
      summary: 'Delete state trigger',
      description: 'Permanently deletes a state trigger. This action cannot be undone.',
    })
    .input(ByIdSchema)
    .output(SuccessSchema),

  stateTriggerMatch: oc
    .route({
      method: 'GET',
      tags: ['State Trigger'],
      path: '/state-trigger/match',
      summary: 'Find matching state trigger for current URL',
      description: 'Returns matching state trigger for a given URL pattern',
    })
    .input(
      z.object({
        widget_id: z.coerce.number(),
        url: z.string(),
      }),
    )
    .output(StateTriggerEntitySchema.nullable()),

  // ============================================================================
  // SIMULATION ROUTES - Application simulation and testing
  // ============================================================================

  simulationGet: oc
    .route({
      method: 'GET',
      tags: ['Simulation'],
      path: '/simulation/{simulation_id}',
      summary: 'Get a single simulation by ID',
    })
    .input(
      z.object({
        simulation_id: z.coerce.number(),
      }),
    )
    .output(SimulationEntitySchema),

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
      z
        .object({
          workspace_id: z.coerce.number().optional(),
          application_id: z.coerce.number().optional(),
          agent_id: z.coerce.number().optional(),
          pinned: z
            .union([z.boolean(), z.string()])
            .optional()
            .transform(val =>
              val === undefined
                ? undefined
                : typeof val === 'boolean'
                  ? val
                  : val === 'true'
                    ? true
                    : val === 'false'
                      ? false
                      : undefined,
            ),
          source: z.enum(['direct', 'qa']).optional(),
          include: z.array(z.enum(['agent', 'application'])).optional(),
        })
        .extend(PaginationSchema.shape),
    )
    .output(paginatedListOf(SimulationListEntitySchema)),

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
      BySimulationIdSchema.extend({
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
    .input(BySimulationIdSchema.extend({ task_id: z.string().optional() }))
    .output(listOf(SimulationProgressEntitySchema)),

  simulationTaskLiveView: oc
    .route({
      method: 'GET',
      tags: ['Simulation'],
      path: '/simulation/{simulation_id}/task/{task_id}/live-view',
      summary: 'Get per-task live view URL',
      description: 'Returns Browserbase per-tab live view URL for a specific task within a simulation.',
    })
    .input(
      z.object({
        simulation_id: z.coerce.number().int().positive(),
        task_id: z.string(),
      }),
    )
    .output(
      z.object({
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
    .input(BySimulationIdSchema.extend({ task_id: z.string() }))
    .output(listOf(SimulationStepSchema)),

  simulationSteps: oc
    .route({
      method: 'GET',
      tags: ['Simulation'],
      path: '/simulation/{simulation_id}/steps',
      summary: 'Get all simulation steps with topic and screenshot link as JSON',
      description:
        'Returns each step with step_number, topic, screenshot_url, and optional title/url for the simulation',
    })
    .input(BySimulationIdSchema)
    .output(listOf(SimulationStepSummarySchema)),

  simulationMindmap: oc
    .route({
      method: 'GET',
      tags: ['Simulation'],
      path: '/simulation/{simulation_id}/mindmap',
      summary: 'Get simulation mindmap by ID',
      description: 'Returns the mindmap knowledge graph for the specified simulation',
    })
    .input(BySimulationIdSchema)
    .output(MindMapSchema),

  simulationStop: oc
    .route({
      method: 'POST',
      tags: ['Simulation'],
      path: '/simulation/{simulation_id}/stop',
      summary: 'Stop running simulation',
      description: 'Terminates a running simulation and closes its browser session.',
    })
    .input(BySimulationIdSchema)
    .output(SuccessWithMessageSchema),

  simulationAnswer: oc
    .route({
      method: 'POST',
      tags: ['Simulation'],
      path: '/simulation/{simulation_id}/answer',
      summary: 'Submit answer to simulation question',
      description: 'Submits an answer to a pending question from the simulation agent',
    })
    .input(SimulationAnswerSchema.extend({ simulation_id: z.coerce.number() }))
    .output(SuccessWithMessageSchema),

  simulationRetryMindmap: oc
    .route({
      method: 'POST',
      tags: ['Simulation'],
      path: '/simulation/{simulation_id}/retry-mindmap',
      summary: 'Retry mindmap generation',
      description: 'Restarts mindmap generation from stored history for a simulation.',
    })
    .input(z.object({ simulation_id: z.coerce.number() }))
    .output(SuccessWithMessageSchema),

  simulationDelete: oc
    .route({
      method: 'DELETE',
      tags: ['Simulation'],
      path: '/simulation/{simulation_id}',
      summary: 'Delete simulation',
      description:
        'Permanently deletes a simulation and all associated data. Only works on simulations in terminal state.',
    })
    .input(BySimulationIdSchema)
    .output(SuccessWithMessageSchema),

  // ============================================================================
  // NOTIFICATION ROUTES - Multi-channel pause-for-input notifications
  // ============================================================================

  notificationListPending: oc
    .route({
      method: 'GET',
      tags: ['Notification'],
      path: '/notification/pending',
      summary: 'List pending notifications for the current user',
    })
    .output(listOf(NotificationEntitySchema)),

  notificationMarkRead: oc
    .route({
      method: 'POST',
      tags: ['Notification'],
      path: '/notification/{id}/read',
      summary: 'Mark a notification as read',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(SuccessSchema),

  notificationDismiss: oc
    .route({
      method: 'POST',
      tags: ['Notification'],
      path: '/notification/{id}/dismiss',
      summary: 'Dismiss a pending notification',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(SuccessSchema),

  notificationGetPreferences: oc
    .route({
      method: 'GET',
      tags: ['Notification'],
      path: '/notification/preferences',
      summary: 'Get notification preferences for the current (user, workspace)',
    })
    .output(NotificationChannelsSchema),

  notificationUpdatePreferences: oc
    .route({
      method: 'PUT',
      tags: ['Notification'],
      path: '/notification/preferences',
      summary: 'Update notification preferences for the current (user, workspace)',
    })
    .input(NotificationChannelsSchema)
    .output(NotificationChannelsSchema),

  notificationGetVapidPublicKey: oc
    .route({
      method: 'GET',
      tags: ['Notification'],
      path: '/notification/vapid-public-key',
      summary: 'Public VAPID key for browser pushManager.subscribe',
    })
    .output(VapidPublicKeyResponseSchema),

  notificationRegisterPushSubscription: oc
    .route({
      method: 'POST',
      tags: ['Notification'],
      path: '/notification/push-subscription',
      summary: 'Register a Web Push subscription for the current user',
    })
    .input(PushSubscriptionRegisterSchema)
    .output(SuccessSchema),

  notificationUnregisterPushSubscription: oc
    .route({
      method: 'DELETE',
      tags: ['Notification'],
      path: '/notification/push-subscription',
      summary: 'Unregister a Web Push subscription for the current user',
    })
    .input(PushSubscriptionUnregisterSchema)
    .output(SuccessSchema),

  notificationSendTestSlack: oc
    .route({
      method: 'POST',
      tags: ['Notification'],
      path: '/notification/slack-test',
      summary: 'Send a test message to a Slack incoming-webhook URL',
    })
    .input(NotificationSlackTestSchema)
    .output(SuccessWithMessageSchema),

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
    .input(z.object({ session_id: z.string().min(1) }))
    .output(SessionEntitySchema.nullable()),

  sessionGetByChat: oc
    .route({
      method: 'GET',
      tags: ['Session'],
      path: '/sessions/chat/{chat_id}',
      summary: 'Get sessions by chat ID',
      description: 'Retrieves all sessions for a given chat_id',
    })
    .input(z.object({ chat_id: z.string().min(1) }))
    .output(listOf(SessionEntitySchema)),

  sessionSearch: oc
    .route({
      method: 'GET',
      tags: ['Session'],
      path: '/sessions',
      summary: 'Get all sessions',
      description: 'Retrieves all sessions ordered by creation date, optionally filtered by application and date range',
    })
    .input(
      z
        .object({
          application_id: z.coerce.number().optional(),
          start_date: z.string().optional(),
          end_date: z.string().optional(),
        })
        .extend(PaginationSchema.shape),
    )
    .output(paginatedListOf(SessionEntitySchema)),

  sessionStats: oc
    .route({
      method: 'GET',
      tags: ['Session'],
      path: '/sessions/stats',
      summary: 'Get session activity stats',
      description:
        'Returns daily aggregated session metrics for charting. Each entry is one calendar day with session count and total event count.',
    })
    .input(
      z.object({
        application_id: z.coerce.number(),
        start_date: z.string().describe('YYYY-MM-DD'),
        end_date: z.string().describe('YYYY-MM-DD'),
      }),
    )
    .output(SessionStatsResponseSchema),

  sessionEvents: oc
    .route({
      method: 'GET',
      tags: ['Session'],
      path: '/sessions/{session_id}/events',
      summary: 'Get session events (paginated by batch)',
      description: 'Fetches batches from storage in pages. Use batch_offset/batch_limit to paginate.',
    })
    .input(
      z.object({
        session_id: z.string().min(1),
        batch_offset: z.coerce.number().int().nonnegative().default(0),
        batch_limit: z.coerce.number().int().positive().max(50).default(20),
      }),
    )
    .output(
      z.object({
        items: z.array(
          z.object({
            type: z.number(),
            timestamp: z.number(),
            data: z.unknown().describe('rrweb event payload — shape defined by rrweb library'),
          }),
        ),
        count: z.number(),
        total_batches: z.number(),
        batch_offset: z.number(),
        batch_limit: z.number(),
      }),
    ),

  browserSessionCreate: oc
    .route({
      method: 'POST',
      tags: ['Browser Session'],
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
        browser_session_id: z.string(),
        live_view_url: z.string(),
      }),
    ),

  browserSessionStop: oc
    .route({
      method: 'POST',
      tags: ['Browser Session'],
      path: '/browser-session/{browser_session_id}/stop',
      summary: 'Stop browser session',
      description: 'Stops all running tasks and closes the browser session. Set stop_tasks=false to skip task cleanup.',
    })
    .input(
      z.object({
        browser_session_id: z.string(),
        stop_tasks: z.boolean().optional().default(true),
      }),
    )
    .output(SuccessWithMessageSchema),

  // ============================================================================
  // KNOWLEDGE ROUTES - Knowledge base and document management
  // ============================================================================

  knowledgeSearch: oc
    .route({
      method: 'GET',
      tags: ['Knowledge'],
      path: '/knowledge',
      summary: 'Search and filter knowledge base documents',
      description:
        'Returns list of knowledge documents matching search parameters. Supports filtering by workspace_id, type, and application_id.',
    })
    .input(
      z
        .object({
          workspace_id: z.coerce.number().optional(),
          type: KnowledgeTypeSchema.optional(),
          application_id: z.coerce.number().optional(),
          include: z.array(z.enum(['agents', 'application'])).optional(),
        })
        .extend(PaginationSchema.shape),
    )
    .output(paginatedListOf(KnowledgeEntitySchema)),

  knowledgeCreate: oc
    .route({
      method: 'POST',
      tags: ['Knowledge'],
      path: '/knowledge',
      summary: 'Upload new knowledge base document',
      description: 'Upload a file, document URL, or video URL to create a knowledge entry for AI training',
    })
    .input(
      z.object({
        file: z.file().optional(),
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
    .input(ByIdSchema)
    .output(KnowledgeEntitySchema),

  knowledgeDelete: oc
    .route({
      method: 'DELETE',
      tags: ['Knowledge'],
      path: '/knowledge/{id}',
      summary: 'Delete knowledge document',
      description: 'Permanently deletes a knowledge document from the database. This action cannot be undone.',
    })
    .input(ByIdSchema)
    .output(SuccessSchema),

  knowledgeRefresh: oc
    .route({
      method: 'POST',
      tags: ['Knowledge'],
      path: '/knowledge/{id}/refresh',
      summary: 'Refresh knowledge document',
      description: 'Re-fetches HTML content from source URL and updates the document',
    })
    .input(ByIdSchema)
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
      description:
        'Uploads a PDF/text file or text content for QA test generation. Also accepts multipart/form-data for file uploads (handled by raw Express route).',
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
    .input(ByIdSchema)
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
      ByIdSchema.extend({
        refinementPrompt: z.string().min(5).max(2000),
      }),
    )
    .output(QAFlowProcessingResponseSchema),

  qaFlowProcessStream: oc
    .route({
      method: 'POST',
      tags: ['QA'],
      path: '/qa/document/{id}/process/stream',
      summary: 'Process QA flow with SSE streaming',
      description:
        'Streams processing events as Server-Sent Events. Events: response.created, response.progress, response.clear, response.completed, error.',
    })
    .input(ByIdSchema)
    .output(
      eventIterator(
        z.object({
          event: z
            .string()
            .describe(
              'SSE event type: response.created | response.progress | response.clear | response.completed | error',
            ),
          data: z.unknown().describe('Event payload object — shape varies by event type'),
        }),
      ),
    ),

  qaFlowRefineStream: oc
    .route({
      method: 'POST',
      tags: ['QA'],
      path: '/qa/document/{id}/refine/stream',
      summary: 'Refine QA flow test cases with SSE streaming',
      description: 'Streams refinement events as Server-Sent Events. Requires a refinement prompt (min 5 chars).',
    })
    .input(
      ByIdSchema.extend({
        refinementPrompt: z.string().min(5),
      }),
    )
    .output(
      eventIterator(
        z.object({
          event: z
            .string()
            .describe(
              'SSE event type: response.created | response.progress | response.clear | response.completed | error',
            ),
          data: z.unknown().describe('Event payload object — shape varies by event type'),
        }),
      ),
    ),

  qaFlowGet: oc
    .route({
      method: 'GET',
      tags: ['QA'],
      path: '/qa/document/{id}',
      summary: 'Get QA flow by ID',
      description: 'Retrieves a QA flow by its ID',
    })
    .input(ByIdSchema)
    .output(QAFlowEntitySchema),

  qaFlowSearch: oc
    .route({
      method: 'GET',
      tags: ['QA'],
      path: '/qa/document',
      summary: 'List QA flows',
      description:
        'Returns all QA flows with aggregated metrics (run_count, pass_rate, total_failed) and the last run summary. Supports filtering by application_id.',
    })
    .input(
      z
        .object({
          application_id: z.coerce.number().optional(),
        })
        .extend(PaginationSchema.shape),
    )
    .output(
      paginatedListOf(
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
      ).extend({
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
      description: 'Permanently deletes a QA flow and all its runs and test cases. This action cannot be undone.',
    })
    .input(ByIdSchema)
    .output(SuccessSchema),

  qaFlowUpdate: oc
    .route({
      method: 'PUT',
      tags: ['QA'],
      path: '/qa/document/{id}',
      summary: 'Update QA flow',
      description: 'Updates status and/or pinned state of a QA flow',
    })
    .input(
      ByIdSchema.extend({
        status: QAFlowStatusSchema.optional(),
        pinned: z.boolean().optional(),
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
    .input(ByIdSchema.extend(PaginationSchema.shape))
    .output(
      paginatedListOf(
        QARunEntitySchema.extend({
          status: z.string(),
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
    .input(ByIdSchema)
    .output(
      QARunEntitySchema.extend({
        test_cases: z.array(QATestCaseEntitySchema),
      }),
    ),

  qaRunVerdicts: oc
    .route({
      method: 'GET',
      tags: ['QA'],
      path: '/qa/run/{run_id}/verdicts',
      summary: 'Get evaluator verdicts for a QA run',
      description: 'Returns all qa_run_task rows for a run, keyed by test case',
    })
    .input(z.object({ run_id: z.coerce.number() }))
    .output(z.array(QARunTaskEntitySchema)),

  qaRunDelete: oc
    .route({
      method: 'DELETE',
      tags: ['QA'],
      path: '/qa/run/{id}',
      summary: 'Delete a QA run',
      description: 'Permanently deletes a QA run and all its test case results. This action cannot be undone.',
    })
    .input(ByIdSchema)
    .output(SuccessSchema),

  qaFlowRun: oc
    .route({
      method: 'POST',
      tags: ['QA'],
      path: '/qa/document/{id}/run',
      summary: 'Create and start a new QA run',
      description: 'Creates a new run and starts execution. Returns 202; poll test-cases for execution status.',
    })
    .input(
      ByIdSchema.extend({
        auto_heal: z.boolean().default(false),
        auto_accept: z.boolean().default(false),
      }),
    )
    .output(
      z.object({
        run: QARunEntitySchema,
      }),
    ),

  qaTestCaseList: oc
    .route({
      method: 'GET',
      tags: ['QA'],
      path: '/qa/document/{id}/test-cases',
      summary: 'Get test cases for a QA flow',
      description: 'Retrieves test cases; optional run_id scopes to that run',
    })
    .input(ByIdSchema.extend({ run_id: z.coerce.number().optional() }))
    .output(listOf(QATestCaseEntitySchema)),

  qaTestCaseUpdate: oc
    .route({
      method: 'PUT',
      tags: ['QA'],
      path: '/qa/test-case/{id}',
      summary: 'Update test case definition fields',
      description: 'Updates a test case definition (title, objective, steps, etc.)',
    })
    .input(
      ByIdSchema.extend({
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
      description:
        'Creates a new QA run, then starts a simulation for every active test case. Returns the run and simulation entities.',
    })
    .input(ByIdSchema)
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
      tags: ['QA'],
      path: '/qa/test-case/{id}/execute',
      summary: 'Execute a single test case as a simulation',
      description: 'Starts a simulation for the specified test case and returns the simulation entity.',
    })
    .input(ByIdSchema)
    .output(
      z.object({
        simulation: SimulationEntitySchema,
      }),
    ),

  // Get simulation linked to test case
  qaTestCaseSimulation: oc
    .route({
      method: 'GET',
      tags: ['QA'],
      path: '/qa/test-case/{id}/simulation',
      summary: 'Get the simulation linked to a test case',
      description:
        'Returns the simulation entity associated with the test case for a specific run, or null if no simulation exists.',
    })
    .input(ByIdSchema.extend({ run_id: z.coerce.number().int().positive().optional() }))
    .output(
      z.object({
        simulation: SimulationEntitySchema.nullable(),
      }),
    ),

  // QA Test Case Version routes (reads from qa_test_case.version_history JSON)
  qaTestCaseVersionList: oc
    .route({
      method: 'GET',
      tags: ['QA'],
      path: '/qa/test-case/{id}/versions',
      summary: 'Get version history for a test case',
      description: 'Returns all version entries from the test case version_history JSON',
    })
    .input(ByIdSchema)
    .output(listOf(QAVersionHistoryEntrySchema)),

  qaTestCaseVersionGet: oc
    .route({
      method: 'GET',
      tags: ['QA'],
      path: '/qa/test-case/{id}/versions/{version}',
      summary: 'Get specific test case version',
      description: 'Returns a specific version entry from the test case version_history JSON',
    })
    .input(ByIdSchema.extend({ version: z.coerce.number() }))
    .output(QAVersionHistoryEntrySchema),

  qaTestCaseVersionRollback: oc
    .route({
      method: 'POST',
      tags: ['QA'],
      path: '/qa/test-case/{id}/versions/{version}/rollback',
      summary: 'Rollback to specific version',
      description: 'Restores test case to a previous version and appends new version entry',
    })
    .input(ByIdSchema.extend({ version: z.coerce.number() }))
    .output(QAVersionHistoryEntrySchema),

  qaTestCaseVersionCompare: oc
    .route({
      method: 'GET',
      tags: ['QA'],
      path: '/qa/test-case/{id}/versions/compare',
      summary: 'Compare two versions',
      description: 'Returns differences between two test case versions',
    })
    .input(ByIdSchema.extend({ version1: z.coerce.number(), version2: z.coerce.number() }))
    .output(
      z.object({
        version1: QAVersionHistoryEntrySchema,
        version2: QAVersionHistoryEntrySchema,
        diff: z.array(
          z.object({
            field: z.string(),
            oldValue: DiffValueSchema,
            newValue: DiffValueSchema,
          }),
        ),
      }),
    ),

  qaTestCaseVersionDelete: oc
    .route({
      method: 'DELETE',
      tags: ['QA'],
      path: '/qa/test-case/{id}/versions/{version}',
      summary: 'Delete a specific version',
      description: 'Removes a version from history and reverts test case to previous version if it was the latest',
    })
    .input(ByIdSchema.extend({ version: z.coerce.number() }))
    .output(SuccessSchema.extend({ current_version: z.number() })),

  qaTestCaseVersionAccept: oc
    .route({
      method: 'POST',
      tags: ['QA'],
      path: '/qa/test-case/{id}/versions/{version}/accept',
      summary: 'Accept a specific version',
      description: 'Marks a version as accepted by the user',
    })
    .input(ByIdSchema.extend({ version: z.coerce.number() }))
    .output(SuccessSchema),

  // QA Self-Healing routes (reads from qa_test_case.healing_attempts JSON)
  qaHealingAttemptList: oc
    .route({
      method: 'GET',
      tags: ['QA'],
      path: '/qa/test-case/{id}/healing-attempts',
      summary: 'Get healing attempts for a test case',
      description: 'Returns all healing attempt entries from the test case healing_attempts JSON',
    })
    .input(ByIdSchema)
    .output(listOf(QAHealingAttemptEntrySchema)),

  qaHealingAttemptApprove: oc
    .route({
      method: 'POST',
      tags: ['QA'],
      path: '/qa/test-case/{id}/healing-attempts/{attemptIndex}/approve',
      summary: 'Approve a healing attempt',
      description: 'Applies the repair from a validated healing attempt by array index',
    })
    .input(ByIdSchema.extend({ attemptIndex: z.coerce.number() }))
    .output(SuccessSchema),

  qaHealingAttemptReject: oc
    .route({
      method: 'POST',
      tags: ['QA'],
      path: '/qa/test-case/{id}/healing-attempts/{attemptIndex}/reject',
      summary: 'Reject a healing attempt',
      description: 'Marks a healing attempt as rejected by array index',
    })
    .input(ByIdSchema.extend({ attemptIndex: z.coerce.number() }))
    .output(SuccessSchema),

  qaHealingTrigger: oc
    .route({
      method: 'POST',
      tags: ['QA'],
      path: '/qa/test-case/{id}/heal',
      summary: 'Trigger self-healing for a failed test case',
      description: 'Initiates the self-healing workflow for a test case',
    })
    .input(
      ByIdSchema.extend({
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
      tags: ['QA'],
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
      tags: ['QA'],
      path: '/qa/document/{id}/cross-browser-comparison',
      summary: 'Get cross-browser comparison',
      description: 'Returns test cases comparison across different browsers',
    })
    .input(ByIdSchema)
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
      tags: ['QA'],
      path: '/qa/document/{id}/browser-config',
      summary: 'Update browser configuration',
      description: 'Updates the default browser configuration for a QA flow',
    })
    .input(BrowserConfigSchema.extend({ id: z.coerce.number() }))
    .output(SuccessSchema),

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
    .input(z.object({ subscriptionId: z.string().min(1) }))
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

  stripeSyncPlan: oc
    .route({
      method: 'POST',
      tags: ['Stripe'],
      path: '/stripe/sync',
      summary: 'Reconcile workspace plan with Stripe',
      description:
        'Force-syncs the workspace_plan row with live Stripe subscription state. Called by the app after checkout success to recover from delayed or missed webhooks.',
    })
    .output(z.object({ plan: PlanInfoSchema })),

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
        tab_id: z.string().optional(),
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

  // ============================================================================
  // WEBHOOK ROUTES - External service webhooks
  // ============================================================================

  /** @docs-only — raw Express handler; requires webhook signature verification */
  workosWebhook: oc
    .route({
      method: 'POST',
      tags: ['Internal'],
      path: '/workos/webhook',
      summary: 'WorkOS webhook receiver',
      description:
        'Receives webhook events from WorkOS (user management, SSO). Verified via workos-signature header. Not for external use.',
    })
    .input(z.object({ event: z.string(), data: z.record(z.string(), z.unknown()) }))
    .output(z.object({ received: z.boolean() })),

  /** @docs-only — raw Express handler; requires webhook signature verification */
  stripeWebhook: oc
    .route({
      method: 'POST',
      tags: ['Internal'],
      path: '/stripe/webhook',
      summary: 'Stripe webhook receiver',
      description:
        'Receives webhook events from Stripe (payments, subscriptions). Verified via stripe-signature header. Not for external use.',
    })
    .input(
      z
        .object({
          id: z.string(),
          object: z.string(),
          type: z.string(),
          data: z.record(z.string(), z.unknown()),
        })
        .passthrough()
        .describe('Stripe event payload'),
    )
    .output(z.object({ received: z.boolean() })),

  // ============================================================================
  // INSIGHT - UX Insights
  // ============================================================================

  // Personas
  insightPersonasGet: oc
    .route({
      method: 'GET',
      tags: ['Insight'],
      path: '/insights/personas',
      summary: 'Get personas overview (connectors + segments + personas)',
    })
    .input(ByApplicationIdSchema)
    .output(InsightPersonasResponseSchema),

  insightSegmentsGenerate: oc
    .route({
      method: 'POST',
      tags: ['Insight'],
      path: '/insights/segments/generate',
      summary: 'Generate segments from session data (mocked)',
    })
    .input(ByApplicationIdSchema)
    .output(z.object({ items: z.array(InsightSegmentEntitySchema) })),

  insightSegmentDelete: oc
    .route({ method: 'DELETE', tags: ['Insight'], path: '/insights/segments/{id}', summary: 'Delete a segment' })
    .input(z.object({ id: z.coerce.number() }))
    .output(SuccessSchema),

  insightPersonasGenerate: oc
    .route({
      method: 'POST',
      tags: ['Insight'],
      path: '/insights/personas/generate',
      summary: 'Generate personas from segments (mocked)',
    })
    .input(ByApplicationIdSchema)
    .output(z.object({ items: z.array(InsightPersonaEntitySchema) })),

  insightPersonaDelete: oc
    .route({ method: 'DELETE', tags: ['Insight'], path: '/insights/personas/{id}', summary: 'Delete a persona' })
    .input(z.object({ id: z.coerce.number() }))
    .output(SuccessSchema),

  insightPersonasDomainSuggest: oc
    .route({
      method: 'GET',
      tags: ['Insight'],
      path: '/insights/personas/domain-suggest',
      summary: 'Get domain-specific persona suggestions (accessible during onboarding)',
    })
    .input(z.object({ domain: z.string() }))
    .output(DomainPersonaSuggestResponseSchema),

  insightPersonasSaveDomain: oc
    .route({
      method: 'POST',
      tags: ['Insight'],
      path: '/insights/personas/save-domain',
      summary: 'Save domain-suggested personas to the workspace (accessible during onboarding)',
    })
    .input(InsightPersonasSaveDomainInputSchema)
    .output(z.object({ saved: z.number() })),

  insightPersonaUpdate: oc
    .route({
      method: 'PATCH',
      tags: ['Insight'],
      path: '/insights/personas/{id}',
      summary: 'Update persona content (name, description, profile fields, tags, traits)',
    })
    .input(InsightPersonaUpdateInputSchema)
    .output(SuccessSchema),

  insightPersonaUpdateSelection: oc
    .route({
      method: 'PATCH',
      tags: ['Insight'],
      path: '/insights/personas/{id}/selection',
      summary: 'Toggle the is_selected state of a persona',
    })
    .input(z.object({ id: z.coerce.number(), is_selected: z.boolean() }))
    .output(SuccessSchema),

  insightPersonasRegenerate: oc
    .route({
      method: 'POST',
      tags: ['Insight'],
      path: '/insights/personas/regenerate',
      summary: 'Start segment + persona regeneration for an application (fire-and-forget)',
    })
    .input(z.object({ application_id: z.number() }))
    .output(z.object({ job_id: z.string() })),

  insightPersonaKeyFeatures: oc
    .route({
      method: 'POST',
      tags: ['Insight'],
      path: '/insights/personas/{id}/key-features',
      summary: 'Generate AI key product feature insights for a specific persona',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(z.object({ features: z.array(z.string()) })),

  insightResearchRun: oc
    .route({
      method: 'POST',
      tags: ['Insight'],
      path: '/insights/{application_id}/research/run',
      summary: 'Kick off Background Research for an application',
      description:
        "Fire-and-forget: dispatches Background Research to the agent, returns a job_id the client can subscribe to via appEvents. On completion, research output is persisted as knowledge rows with source='research' and a knowledge_embed is dispatched per row.",
    })
    .input(z.object({ application_id: z.coerce.number() }))
    .output(z.object({ job_id: z.string() })),

  insightResearchStatus: oc
    .route({
      method: 'GET',
      tags: ['Insight'],
      path: '/insights/{application_id}/research/status',
      summary: 'Check whether Background Research is currently running',
      description:
        'Returns the current Background Research dispatch state for an application. Used by the client to restore the "Researching…" banner across page refreshes — if `status="in_progress"`, the client subscribes to appEvents and waits for `job/completed`. Per-pod tracking; not persistent across api restarts.',
    })
    .input(z.object({ application_id: z.coerce.number() }))
    .output(z.object({ status: z.enum(['idle', 'in_progress']) })),

  // Heatmaps
  insightHeatmapPages: oc
    .route({
      method: 'GET',
      tags: ['Insight'],
      path: '/insights/heatmaps/pages',
      summary: 'Get all tracked heatmap pages',
    })
    .input(ByApplicationIdSchema)
    .output(z.object({ items: z.array(HeatmapPageEntitySchema) })),

  insightHeatmapSnapshot: oc
    .route({
      method: 'GET',
      tags: ['Insight'],
      path: '/insights/heatmaps/snapshot',
      summary: 'Get heatmap snapshot for a page/variation/type',
    })
    .input(z.object({ page_id: z.coerce.number(), variation: HeatmapVariationSchema, type: HeatmapTypeSchema }))
    .output(HeatmapSnapshotEntitySchema.nullable()),

  insightHeatmapsGenerate: oc
    .route({
      method: 'POST',
      tags: ['Insight'],
      path: '/insights/heatmaps/generate',
      summary: 'Enqueue a heatmap aggregation job over RRWeb session batches',
    })
    .input(ByApplicationIdSchema)
    .output(z.object({ job_id: z.string(), status: z.enum(['queued', 'active']) })),

  insightHeatmapsStatus: oc
    .route({
      method: 'GET',
      tags: ['Insight'],
      path: '/insights/heatmaps/status',
      summary: 'Get the current heatmap aggregation job status for an application',
    })
    .input(ByApplicationIdSchema)
    .output(HeatmapJobStatusSchema),

  insightHeatmapCandidates: oc
    .route({
      method: 'POST',
      tags: ['Insight'],
      path: '/insights/heatmaps/candidates',
      summary: 'Live-scan contributing sessions for a (page, variation) snapshot',
    })
    .input(
      z.object({
        page_id: z.number(),
        variation: HeatmapVariationSchema,
        limit: z.number().int().min(1).max(50).default(15),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .output(
      z.object({
        candidates: z.array(HeatmapCandidateSchema),
        total: z.number(),
      }),
    ),

  insightHeatmapSetBackdrop: oc
    .route({
      method: 'POST',
      tags: ['Insight'],
      path: '/insights/heatmaps/backdrop',
      summary: 'Pin a session as the backdrop override for a (page, variation) snapshot, or clear it with null',
    })
    .input(
      z.object({
        page_id: z.number(),
        variation: HeatmapVariationSchema,
        session_id: z.string().nullable(),
      }),
    )
    .output(z.object({ success: z.literal(true) })),

  // Reactions
  insightReactionsGet: oc
    .route({
      method: 'GET',
      tags: ['Insight'],
      path: '/insights/reactions',
      summary: 'Get all reactions with runs and results',
    })
    .input(ByApplicationIdSchema)
    .output(z.object({ reactions: z.array(ReactionEntitySchema), personas: z.array(InsightPersonaEntitySchema) })),

  insightReactionCreate: oc
    .route({
      method: 'POST',
      tags: ['Insight'],
      path: '/insights/reactions',
      summary: 'Create a new reaction (question)',
    })
    .input(z.object({ application_id: z.coerce.number(), question: z.string() }))
    .output(ReactionEntitySchema),

  insightReactionDelete: oc
    .route({
      method: 'DELETE',
      tags: ['Insight'],
      path: '/insights/reactions/{id}',
      summary: 'Delete a reaction and all its runs',
    })
    .input(z.object({ id: z.coerce.number() }))
    .output(SuccessSchema),

  insightReactionContext: oc
    .route({
      method: 'POST',
      tags: ['Insight'],
      path: '/insights/reactions/context',
      summary: 'Get context for a reaction question',
    })
    .input(z.object({ application_id: z.coerce.number(), question: z.string() }))
    .output(ChatContextResponseSchema),

  insightReactionRun: oc
    .route({
      method: 'POST',
      tags: ['Insight'],
      path: '/insights/reactions/{reaction_id}/run',
      summary: 'Run reaction scoring for selected personas',
    })
    .input(
      z.object({
        reaction_id: z.coerce.number(),
        persona_ids: z.array(z.coerce.number()),
        context_refs: z.array(ContextRefSchema),
        simulations: z.array(SuggestedSimulationSchema.pick({ description: true, selected: true })),
      }),
    )
    .output(ReactionRunEntitySchema),

  insightReactionReportGenerate: oc
    .route({
      method: 'POST',
      tags: ['Insight'],
      path: '/insights/reactions/run/{id}/report',
      summary: 'Schedule background generation of a reaction run PDF report',
      description:
        'Kicks off PDF rendering in the background to avoid nginx timeouts. Listen for reaction-run/report-ready (or reaction-run/report-failed) SSE for the resulting URL.',
    })
    .input(ByIdSchema)
    .output(z.object({ status: z.literal('pending') })),
};

export { contract };
