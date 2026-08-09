import { z } from 'zod';

export const EntityStatusSchema = z.enum(['created', 'active', 'suspended']);

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

// NOT z.coerce.boolean() — that's Boolean(val), so `?enabled=false` would coerce true.
export const booleanQueryParam = z
  .union([z.boolean(), z.string()])
  .transform(val => (typeof val === 'boolean' ? val : val === 'true' ? true : val === 'false' ? false : undefined))
  .optional();

export const paginatedListOf = <T extends z.ZodType>(schema: T) =>
  z.object({
    items: z.array(schema),
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
  });

// Bounded results (scoped to a parent entity) — no limit/offset.
export const listOf = <T extends z.ZodType>(schema: T) =>
  z.object({
    items: z.array(schema),
    count: z.number(),
  });

export const SuccessSchema = z.object({ success: z.literal(true) });
export const SuccessWithMessageSchema = SuccessSchema.extend({ message: z.string() });

// One browser_op invocation recorded inside a SimulationStep's action.
export const ToolCallRecordSchema = z.object({
  name: z.string().min(1),
  params: z.record(z.string(), z.unknown()).default({}),
  result: z.record(z.string(), z.unknown()).default({}),
});

// Shared by workspace update + slack-test so both 400 on the same malformed input.
export const SlackWebhookUrlSchema = z.url().refine(u => /^https:\/\/hooks\.slack\.com\//.test(u), {
  message: 'Slack webhook URL must start with https://hooks.slack.com/',
});

export const GraphEdgeSchema = z
  .object({
    start: z.string(),
    end: z.string(),
    action: z.string(),
  })
  .passthrough();
export type GraphEdgeData = z.infer<typeof GraphEdgeSchema>;

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

// Unique page state observed during simulation; matches agent's PageNode (knowledge/graph.py).
// passthrough() because the agent model may evolve faster than this schema.
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
