import { oc } from '@orpc/contract';
import { z } from 'zod';

import { ByAgentIdSchema, GraphSchema, paginatedListOf, PaginationSchema, SuccessSchema } from './common';
import { AgentEntitySchema, AgentTypeSchema, AgentVoiceSchema } from './entities';

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
export type AgentCreateData = z.infer<typeof AgentCreateSchema>;

export const AgentUpdateSchema = AgentEntitySchema.partial().extend({
  file: z.instanceof(File).optional(),
  knowledge_ids: KnowledgeIdsSchema,
  simulation_ids: SimulationIdsSchema,
});
export type AgentUpdateData = z.infer<typeof AgentUpdateSchema>;

export const AgentTaskStartResponseSchema = z.object({
  text: z.string(),
  task_id: z.string().optional(),
});
export type AgentTaskStartResponse = z.infer<typeof AgentTaskStartResponseSchema>;

export const AgentTaskStopResponseSchema = z.object({
  status: z.string(),
  message: z.string().optional(),
});
export type AgentTaskStopResponse = z.infer<typeof AgentTaskStopResponseSchema>;

export const AgentTaskStatusResponseSchema = z.object({
  task_id: z.string().optional(),
  status: z.string().optional(),
  current_step: z.string().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});
export type AgentTaskStatusResponse = z.infer<typeof AgentTaskStatusResponseSchema>;

export const AgentSearchConfigSchema = z.object({
  content_type: z.enum(['document', 'video', 'automation_log', 'screenshot', 'all']).optional(),
  context: z.string().optional(),
  previous_actions: z.array(z.string()).optional(),
  top: z.coerce.number().min(1).max(100).optional(),
  min_confidence: z.coerce.number().min(0).max(1).optional(),
  entities: z.array(z.string()).optional(),
  use_vector_search: z.boolean().optional(),
  vector_threshold: z.coerce.number().min(0).max(1).optional(),
});
export type AgentSearchConfig = z.infer<typeof AgentSearchConfigSchema>;

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
export type SearchDocument = z.infer<typeof SearchDocumentSchema>;

/**
 * Search result schema (Azure Search result wrapper)
 */
export const SearchResultSchema = z.object({
  document: SearchDocumentSchema,
  score: z.number(),
  highlights: z.record(z.string(), z.array(z.string())).optional(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

export const AgentSimulationIndexRequestSchema = z.object({
  simulation_id: z.coerce.number().positive('Simulation ID must be a positive number'),
});
export type AgentSimulationIndexRequest = z.infer<typeof AgentSimulationIndexRequestSchema>;

export const AgentSimulationIndexResponseSchema = z.object({
  agent: AgentEntitySchema,
  simulation_id: z.number(),
  knowledge_id: z.number(),
  message: z.string(),
});
export type AgentSimulationIndexResponse = z.infer<typeof AgentSimulationIndexResponseSchema>;

export const agentCreate = oc
  .route({
    method: 'POST',
    tags: ['Agent'],
    path: '/agent',
    summary: 'Create new AI agent with configuration',
    description: 'Creates agent with specified settings, prompts, and returns agent entity',
  })
  .input(AgentCreateSchema)
  .output(AgentEntitySchema);

export const agentSearch = oc
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
  .output(paginatedListOf(AgentEntitySchema));

export const agentGet = oc
  .route({
    method: 'GET',
    tags: ['Agent'],
    path: '/agent/{agent_id}',
    summary: 'Get specific agent details by ID',
    description: 'Returns complete agent information including configuration and settings',
  })
  .input(ByAgentIdSchema.extend({ include: z.array(z.enum(['knowledge', 'simulations'])).optional() }))
  .output(AgentEntitySchema);

export const agentGraph = oc
  .route({
    method: 'GET',
    tags: ['Agent'],
    path: '/agent/{agent_id}/graph',
    summary: 'Get agent graph by ID',
    description: 'Returns the knowledge graph for the specified agent',
  })
  .input(ByAgentIdSchema)
  .output(GraphSchema);

export const agentUpdate = oc
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
  .output(AgentEntitySchema);

export const agentDelete = oc
  .route({
    method: 'DELETE',
    tags: ['Agent'],
    path: '/agent/{agent_id}',
    summary: 'Delete agent and all associated data',
    description: 'Permanently deletes an agent and cleans up all related resources. This action cannot be undone.',
  })
  .input(ByAgentIdSchema)
  .output(SuccessSchema);

export const agentIndexSimulation = oc
  .route({
    method: 'POST',
    tags: ['Agent'],
    path: '/agent/{agent_id}/index',
    summary: 'Index simulation document into agent knowledge base',
    description: "Adds a simulation document to an agent's knowledge base and refreshes the search index",
  })
  .input(AgentSimulationIndexRequestSchema.extend({ agent_id: z.coerce.number() }))
  .output(AgentSimulationIndexResponseSchema);

export const agentRoutes = {
  agentCreate,
  agentSearch,
  agentGet,
  agentGraph,
  agentUpdate,
  agentDelete,
  agentIndexSimulation,
};
