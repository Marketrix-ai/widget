import { z } from 'zod';

export const EntityStatusSchema = z.enum(['created', 'active', 'suspended']);
export type EntityStatus = z.infer<typeof EntityStatusSchema>;

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

type StripDefault<T> = T extends z.ZodDefault<infer Inner> ? Inner : T;

/**
 * The ONE way to build a PATCH schema from an entity/input schema. Zod's `.partial()` makes every
 * field optional but does NOT stop a `.default(...)` field from being backfilled when omitted — an
 * update caller who sends only `{ title }` gets `options: []`/`config: {}` re-applied by parsing, so a
 * `field !== undefined` merge guard downstream never sees the omission and silently wipes the column.
 * This strips each field's default before making it optional, so "not sent" really does parse to
 * `undefined`.
 */
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

// Lives here, not in `notification.ts`, because BOTH the notification entity and the `notification/*`
// members of root's AppEvent union need it, and root.ts importing the notification domain would drag
// nine procedures persona-hub never calls into its mirror.
//
// `run_finished` covers every terminal (and cycle-allowance-paused) run the owner is told about — a
// study run, a QA run, or a standalone simulation. The outcome word lives in the row's payload, not in
// a type per outcome: the recipient rule, the deep link and the dedupe are identical for all of them,
// and only the sentence differs.
export const NotificationTypeSchema = z.enum(['simulation_question', 'run_finished']);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

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

export const NotificationResolvedReasonSchema = z.enum(['answered', 'dismissed', 'cancelled']);
export type NotificationResolvedReason = z.infer<typeof NotificationResolvedReasonSchema>;

/** Every live-progress stream the api opens. The app keys `useAgentProgress` on these, so a kind it
 *  cannot name is a generator whose progress never renders. */
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
