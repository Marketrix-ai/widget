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

export const SuccessSchema = z.object({ success: z.literal(true) });
export const SuccessWithMessageSchema = SuccessSchema.extend({ message: z.string() });

export const ToolCallRecordSchema = z.object({
  name: z.string().min(1),
  params: z.record(z.string(), z.unknown()).default({}),
  result: z.record(z.string(), z.unknown()).default({}),
});

/** One vocabulary for a persona-chat SSE stream, shared by `contracts/personaChat.ts`'s
 * `personaOSChatStream` and `contracts/studies.ts`'s `personaChatStream` — the two INPUT schemas that
 * feed them differ (`public_persona_id` vs `application_persona_id` + `application_id`) and stay
 * separate, but the chunk shape they emit is the same event union either way. Lives here rather than on
 * either domain file so moving it widens no audience closure — it is already inside every consumer's
 * mirror. */
export const PersonaChatChunkSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('usage'), usage_key: z.string() }),
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({ type: z.literal('done'), text: z.string() }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);

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
