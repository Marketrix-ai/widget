/**
 * Wire primitives shared across every domain: id/pagination shapes, tool call and browser session
 * state, and the application knowledge graph.
 *
 * Exports helpers like `paginatedListOf`/`unionOfRecord`, the id and pagination input schemas, the graph and
 * session-state entity schemas, and `StoredDateSchema`, the one date that may arrive as the ISO string a JSONB
 * document stores. This file mirrors whole into the widget SDK, so any shape
 * added here reaches the widget even if nothing else changes.
 */
import { z } from 'zod';

export const EntityStatusSchema = z.enum(['created', 'active', 'suspended']);
export type EntityStatus = z.infer<typeof EntityStatusSchema>;

export const BaseEntitySchema = z.strictObject({
  id: z.number(),
  created_at: z.date(),
  updated_at: z.date(),
});

export const StoredDateSchema = z.union([
  z.date(),
  z.iso.datetime({ offset: true }).transform(value => new Date(value)),
]);

export const ByIdSchema = z.strictObject({ id: z.number() });
export const BySlugSchema = z.strictObject({ slug: z.string() });
export const BySimulationIdSchema = z.strictObject({ simulation_id: z.number() });
export const ByApplicationIdSchema = z.strictObject({ application_id: z.number() });
export const ByUserIdSchema = z.strictObject({ user_id: z.number() });

export const PaginationSchema = z.strictObject({
  limit: z.number().int().optional().default(50),
  offset: z.number().int().optional().default(0),
});

type StripDefault<T> = T extends z.ZodDefault<infer Inner> ? Inner : T;

export function partialPatch<Shape extends z.ZodRawShape>(schema: z.ZodObject<Shape>) {
  const shape = Object.fromEntries(
    Object.entries(schema.shape).map(([key, field]) => [
      key,
      z.optional(field instanceof z.ZodDefault ? field.removeDefault() : field),
    ]),
  ) as { [K in keyof Shape]: z.ZodOptional<StripDefault<Shape[K]>> };
  return z.strictObject(shape);
}

export const paginatedListOf = <T extends z.ZodType>(schema: T) =>
  z.strictObject({
    items: z.array(schema),
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
  });

export const listOf = <T extends z.ZodType>(schema: T) =>
  z.strictObject({
    items: z.array(schema),
    count: z.number(),
  });

export const unionOfRecord = <T extends Record<string, z.ZodType>>(
  schemas: T,
): z.ZodUnion<[T[keyof T], ...T[keyof T][]]> => z.union(Object.values(schemas) as [T[keyof T], ...T[keyof T][]]);

export const SuccessSchema = z.strictObject({ success: z.literal(true) });
export const SuccessWithMessageSchema = SuccessSchema.extend({ message: z.string() });

const ToolFailureSchema = z.strictObject({ ok: z.literal(false), error: z.string() });
const ToolOkSchema = z.strictObject({ ok: z.literal(true) });

const toolCallRecord = <const Name extends string, Params extends z.ZodType, Result extends z.ZodType>(
  name: Name,
  params: Params,
  result: Result,
) =>
  z.strictObject({
    name: z.literal(name),
    params,
    result: z.union([result, ToolFailureSchema]),
  });

export const ToolCallRecordSchema = z.discriminatedUnion('name', [
  toolCallRecord('core.navigate', z.strictObject({ url: z.string() }), ToolOkSchema),
  toolCallRecord('core.click', z.strictObject({ ref: z.string() }), ToolOkSchema),
  toolCallRecord('core.click_text', z.strictObject({ text: z.string() }), ToolOkSchema),
  toolCallRecord('core.fill', z.strictObject({ ref: z.string(), value: z.string() }), ToolOkSchema),
  toolCallRecord('core.select_option', z.strictObject({ ref: z.string(), value: z.string() }), ToolOkSchema),
  toolCallRecord('core.check', z.strictObject({ ref: z.string(), checked: z.boolean() }), ToolOkSchema),
  toolCallRecord('core.wait_for', z.strictObject({ ref: z.string(), timeout: z.number() }), ToolOkSchema),
  toolCallRecord(
    'core.extract',
    z.strictObject({ ref: z.string() }),
    z.strictObject({ ok: z.literal(true), value: z.string() }),
  ),
  toolCallRecord(
    'core.scroll',
    z.strictObject({
      direction: z.enum(['up', 'down', 'top', 'bottom']),
      pixels: z.number().int(),
    }),
    ToolOkSchema,
  ),
  toolCallRecord('core.press_key', z.strictObject({ key: z.string() }), ToolOkSchema),
  toolCallRecord('core.drag', z.strictObject({ from_item: z.string(), to_item: z.string() }), ToolOkSchema),
  z.strictObject({
    name: z.literal('core.ask_user'),
    params: z.strictObject({ question: z.string() }),
    result: z.union([z.strictObject({ answer: z.string() }), z.strictObject({ answered: z.literal(false) })]),
  }),
  toolCallRecord(
    'core.finish',
    z.strictObject({ success: z.boolean(), message: z.string() }),
    z.strictObject({
      ok: z.literal(true),
      finish: z.literal(true),
      success: z.boolean(),
      message: z.string(),
    }),
  ),
  toolCallRecord(
    'wait',
    z.strictObject({ seconds: z.number().min(0).max(10) }),
    z.strictObject({ ok: z.literal(true), data: z.strictObject({ waited_seconds: z.number() }) }),
  ),
  toolCallRecord(
    'get_memory',
    z.strictObject({ id: z.string() }),
    z.strictObject({
      ok: z.literal(true),
      data: z.union([
        z.strictObject({ id: z.string(), text: z.string() }),
        z.strictObject({ status: z.literal('no memory found'), id: z.string() }),
      ]),
    }),
  ),
  toolCallRecord(
    'update_memory',
    z.strictObject({ id: z.string(), text: z.string() }),
    z.strictObject({
      ok: z.literal(true),
      data: z.strictObject({ status: z.literal('stored'), id: z.string() }),
    }),
  ),
  toolCallRecord(
    'get_todo',
    z.strictObject({ id: z.string() }),
    z.strictObject({
      ok: z.literal(true),
      data: z.union([
        z.strictObject({ id: z.string(), items: z.array(z.string()) }),
        z.strictObject({ status: z.literal('no todo found'), id: z.string() }),
      ]),
    }),
  ),
  toolCallRecord(
    'update_todo',
    z.strictObject({ id: z.string(), items: z.array(z.string()) }),
    z.strictObject({
      ok: z.literal(true),
      data: z.strictObject({ status: z.literal('stored'), id: z.string(), count: z.number().int() }),
    }),
  ),
]);

export const BrowserCookieSchema = z.strictObject({
  name: z.string(),
  value: z.string(),
  domain: z.string(),
  path: z.string().optional(),
  secure: z.boolean().optional(),
  httpOnly: z.boolean().optional(),
  sameSite: z.enum(['Strict', 'Lax', 'None']).optional(),
  expires: z.number().optional(),
});

export const SessionStateSchema = z.strictObject({
  cookies: z.array(BrowserCookieSchema),
  local_storage: z.array(
    z.strictObject({
      origin: z.string(),
      items: z.record(z.string(), z.string()),
    }),
  ),
});

export const GraphEdgeSchema = z.strictObject({
  start: z.string(),
  end: z.string(),
  action: z.string(),
});
export type GraphEdgeData = z.infer<typeof GraphEdgeSchema>;

const GraphBoxSchema = z.strictObject({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });

export const GraphSectionSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  purpose: z.string(),
  elements: z.array(z.strictObject({ label: z.string(), text: z.string(), bbox: GraphBoxSchema })),
  bbox: GraphBoxSchema,
  screenshot: z.string(),
  embedding: z.array(z.number()).nullable(),
});

export const GraphNodeSummarySchema = z.strictObject({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  summary: z.string(),
  screenshot: z.string(),
  embedding: z.array(z.number()).nullable().optional(),
});
export type GraphNodeData = z.infer<typeof GraphNodeSummarySchema>;

export const GraphSchema = z.strictObject({
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
