import { z } from 'zod';

export const EntityStatusSchema = z.enum(['created', 'active', 'suspended']);
export type EntityStatus = z.infer<typeof EntityStatusSchema>;

export const BaseEntitySchema = z.object({
  id: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
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

type StripDefault<T> = T extends z.ZodDefault<infer Inner> ? Inner : T;

export function partialPatch<Shape extends z.ZodRawShape>(
  schema: z.ZodObject<Shape>,
): z.ZodObject<{ [K in keyof Shape]: z.ZodOptional<StripDefault<Shape[K]>> }> {
  const stripped = Object.fromEntries(
    Object.entries(schema.shape).map(([key, field]) => {
      const base = field as z.ZodTypeAny;
      const unwrapped = base instanceof z.ZodDefault ? (base.removeDefault() as z.ZodTypeAny) : base;
      return [key, unwrapped.optional()];
    }),
  );
  return z.object(stripped) as unknown as z.ZodObject<{ [K in keyof Shape]: z.ZodOptional<StripDefault<Shape[K]>> }>;
}

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

export const listOf = <T extends z.ZodType>(schema: T) =>
  z.object({
    items: z.array(schema),
    count: z.number(),
  });

// A plain (non-discriminated) union of every variant in a `{ <discriminant value>: ZodType }` map — the
// shape `TriggerSourceConfigSchemas`/`WorkflowActionTargetConfigSchemas` are declared in, and the
// registry (`models/columnSchemas.ts`) keys by the same discriminant separately. Typed off the map's
// own value type rather than a bare `z.ZodType`, whose inferred output is `unknown` and would erase
// every variant's real shape from the union.
export const unionOfRecord = <T extends Record<string, z.ZodType>>(
  schemas: T,
): z.ZodUnion<[T[keyof T], ...T[keyof T][]]> => z.union(Object.values(schemas) as [T[keyof T], ...T[keyof T][]]);

export const SuccessSchema = z.object({ success: z.literal(true) });
export const SuccessWithMessageSchema = SuccessSchema.extend({ message: z.string() });

export const ToolCallRecordSchema = z
  .object({
    name: z.string().min(1),
    params: z.record(z.string(), z.unknown()),
    result: z.record(z.string(), z.unknown()),
  })
  .strict();

// `simulation.session_state` (Browserbase cookies + localStorage snapshot). Lives here rather than
// models/columnSchemas.ts, which imports FROM contracts/foundationEntities.ts — a leaf-shaped schema
// this file already is one, so contracts/foundationEntities.ts can type SimulationEntitySchema's own
// `session_state` field with it (C8 in the data-truth audit) without cycling back through columnSchemas.ts.
export const SessionStateSchema = z
  .object({
    cookies: z.array(z.record(z.string(), z.unknown())),
    local_storage: z.array(z.object({ origin: z.string(), items: z.record(z.string(), z.string()) }).strict()),
  })
  .strict();

export const SlackWebhookUrlSchema = z.url().refine(u => /^https:\/\/hooks\.slack\.com\//.test(u), {
  message: 'Slack webhook URL must start with https://hooks.slack.com/',
});

export const GraphEdgeSchema = z
  .object({
    start: z.string(),
    end: z.string(),
    action: z.string(),
  })
  .strict();
export type GraphEdgeData = z.infer<typeof GraphEdgeSchema>;

const GraphBoxSchema = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).strict();

export const GraphSectionSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    purpose: z.string(),
    elements: z.array(z.object({ label: z.string(), text: z.string(), bbox: GraphBoxSchema }).strict()),
    bbox: GraphBoxSchema,
    screenshot: z.string(),
    embedding: z.array(z.number()).nullable(),
  })
  .strict();

// The whole-graph tier — `applicationGraphGet`/`simulationGraphGet` load nodes with `readGraph`, which
// always resolves sections to `[]` for speed; a node's real sections are a lazy drill-in fetched one at
// a time by `graphNodeSectionsGet` (its own `GraphSectionSchema`-shaped output), so this tier never
// carries them. `sequence_ids` is DROPPED (not just unselected) — the stored `graph.graph_nodes` column
// stays for the agent's own write-side dedupe, but no app/widget graph or heatmap component ever read the
// wire field, and `common.ts` is in the WIDGET audience closure, so this narrowing republishes the widget.
export const GraphNodeSummarySchema = z
  .object({
    id: z.string(),
    title: z.string(),
    url: z.string(),
    summary: z.string(),
    screenshot: z.string(),
    embedding: z.array(z.number()).nullable().optional(),
  })
  .strict();
export type GraphNodeData = z.infer<typeof GraphNodeSummarySchema>;

export const GraphSchema = z.object({
  nodes: z.array(GraphNodeSummarySchema),
  edges: z.array(GraphEdgeSchema),
});
export type GraphData = z.infer<typeof GraphSchema>;

export const AGENT_PROGRESS_KINDS = [
  'study_plan',
  'qa_generate_journeys',
  'qa_prefill_values',
  'persona_generate',
  'persona_from_description',
  'persona_autocomplete',
] as const;
export const AgentProgressKindSchema = z.enum(AGENT_PROGRESS_KINDS);
export type AgentProgressKind = z.infer<typeof AgentProgressKindSchema>;
