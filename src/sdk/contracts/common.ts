import { z } from 'zod';

export const EntityStatusSchema = z.enum(['created', 'active', 'suspended', 'pending_approval']);

/**
 * Base entity schema with common fields for all database entities
 */
export const BaseEntitySchema = z.object({
  id: z.number().optional(),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
});

export const ByIdSchema = z.object({ id: z.coerce.number() });
export const BySlugSchema = z.object({ slug: z.string() });
export const ByWidgetIdSchema = z.object({ widget_id: z.coerce.number() });
export const BySimulationIdSchema = z.object({ simulation_id: z.coerce.number() });
export const ByApplicationIdSchema = z.object({ application_id: z.coerce.number() });
export const ByUserIdSchema = z.object({ user_id: z.coerce.number() });

export const PaginationSchema = z.object({
  limit: z.coerce.number().optional().default(50),
  offset: z.coerce.number().optional().default(0),
});

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

/** Value types in QA test case version diffs */
export const DiffValueSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]);

export const ContextRefSchema = z.object({
  type: z.enum(['doc', 'sim', 'session']),
  id: z.string(),
  label: z.string(),
});

export const SuccessSchema = z.object({ success: z.literal(true) });
export const SuccessWithMessageSchema = SuccessSchema.extend({ message: z.string() });

/**
 * One tool_call recorded inside a SimulationStep — the underlying browser_op
 * invocation that contributed to the step's action.
 */
export const ToolCallRecordSchema = z.object({
  name: z.string().min(1),
  params: z.record(z.string(), z.unknown()).default({}),
  result: z.record(z.string(), z.unknown()).default({}),
});
export type ToolCallRecord = z.infer<typeof ToolCallRecordSchema>;

/**
 * Slack incoming-webhook URL validator — shared by the workspace update path
 * and the slack-test endpoint so both surface a 400 BAD_REQUEST for the same
 * malformed input.
 */
export const SlackWebhookUrlSchema = z
  .string()
  .url()
  .refine(u => /^https:\/\/hooks\.slack\.com\//.test(u), {
    message: 'Slack webhook URL must start with https://hooks.slack.com/',
  });

/**
 * Graph edge schema - transition from one node to another via an action
 */
export const GraphEdgeSchema = z
  .object({
    start: z.string(),
    end: z.string(),
    action: z.string(),
  })
  .passthrough();
export type GraphEdgeData = z.infer<typeof GraphEdgeSchema>;

/**
 * Graph section schema - functional UI section within a page node
 */
export const GraphSectionSchema = z
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
 * Graph node schema - unique page state observed during simulation.
 * Matches agent's PageNode model (perception/graph.py).
 * Uses passthrough() because the agent model may evolve faster than the schema.
 */
export const GraphNodeSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    url: z.string(),
    summary: z.string().default(''),
    screenshot: z.string().default(''),
    sections: z.array(GraphSectionSchema).default([]),
    sequence_ids: z.array(z.number()).default([]),
    embedding: z.array(z.number()).nullish(),
  })
  .passthrough();
export type GraphNodeData = z.infer<typeof GraphNodeSchema>;

export const GraphSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
});
export type GraphData = z.infer<typeof GraphSchema>;

/**
 * Skill invocation request — used by SimulationCreateSchema to launch a
 * simulation against a specific skill. Lives in common so simulation.ts
 * can import it without crossing domain boundaries.
 */
export const SkillInvocationRequestSchema = z.object({
  skill_id: z.number().int(),
  params: z.record(z.string(), z.string()),
});
export type SkillInvocationRequest = z.infer<typeof SkillInvocationRequestSchema>;
