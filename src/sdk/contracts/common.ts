/**
 * Wire primitives shared across every domain: id/pagination shapes, tool call and browser session
 * state, and the application knowledge graph.
 *
 * Exports helpers like `paginatedListOf`/`unionOfRecord`, the id and pagination input schemas, and the
 * graph and session-state entity schemas. This file mirrors whole into the widget SDK, so any shape
 * added here reaches the widget even if nothing else changes.
 */
import { z } from 'zod';

export const EntityStatusSchema = z.enum(['created', 'active', 'suspended']);
export type EntityStatus = z.infer<typeof EntityStatusSchema>;

export const BaseEntitySchema = z.strictObject({
  id: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const ByIdSchema = z.strictObject({ id: z.coerce.number() });
export const BySlugSchema = z.strictObject({ slug: z.string() });
export const BySimulationIdSchema = z.strictObject({ simulation_id: z.coerce.number() });
export const ByApplicationIdSchema = z.strictObject({ application_id: z.coerce.number() });
export const ByUserIdSchema = z.strictObject({ user_id: z.coerce.number() });

export const PaginationSchema = z.strictObject({
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
  return z.strictObject(stripped) as unknown as z.ZodObject<{
    [K in keyof Shape]: z.ZodOptional<StripDefault<Shape[K]>>;
  }>;
}

export const booleanQueryParam = z
  .union([z.boolean(), z.string()])
  .transform(val => (typeof val === 'boolean' ? val : val === 'true' ? true : val === 'false' ? false : undefined))
  .optional();

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

const RrwebNodeFields = {
  id: z.number(),
  rootId: z.number().optional(),
  isShadowHost: z.boolean().optional(),
  isShadow: z.boolean().optional(),
};

const RrwebAttributesSchema = z.record(z.string(), z.union([z.string(), z.number(), z.literal(true), z.null()]));

const rrwebSerializedNodeSchemaFor = <Child extends z.ZodType>(child: Child) =>
  z.discriminatedUnion('type', [
    z.strictObject({
      ...RrwebNodeFields,
      type: z.literal(0),
      childNodes: z.array(child),
      compatMode: z.string().optional(),
    }),
    z.strictObject({
      ...RrwebNodeFields,
      type: z.literal(1),
      name: z.string(),
      publicId: z.string(),
      systemId: z.string(),
    }),
    z.strictObject({
      ...RrwebNodeFields,
      type: z.literal(2),
      tagName: z.string(),
      attributes: RrwebAttributesSchema,
      childNodes: z.array(child),
      isSVG: z.literal(true).optional(),
      needBlock: z.boolean().optional(),
      isCustom: z.literal(true).optional(),
    }),
    z.strictObject({
      ...RrwebNodeFields,
      type: z.literal(3),
      textContent: z.string(),
      isStyle: z.literal(true).optional(),
    }),
    z.strictObject({ ...RrwebNodeFields, type: z.literal(4), textContent: z.literal('') }),
    z.strictObject({ ...RrwebNodeFields, type: z.literal(5), textContent: z.string() }),
  ]);

const _RrwebSerializedNodeShallowSchema = rrwebSerializedNodeSchemaFor(z.never());
type RrwebSerializedNodeShallow = z.infer<typeof _RrwebSerializedNodeShallowSchema>;
type RrwebSerializedNodeOutput =
  | Exclude<RrwebSerializedNodeShallow, { type: 0 | 2 }>
  | (Omit<Extract<RrwebSerializedNodeShallow, { type: 0 }>, 'childNodes'> & {
      childNodes: RrwebSerializedNodeOutput[];
    })
  | (Omit<Extract<RrwebSerializedNodeShallow, { type: 2 }>, 'childNodes'> & {
      childNodes: RrwebSerializedNodeOutput[];
    });

export const RrwebSerializedNodeSchema: z.ZodType<RrwebSerializedNodeOutput> = z.lazy(() =>
  rrwebSerializedNodeSchemaFor(RrwebSerializedNodeSchema),
);
export type RrwebSerializedNode = z.infer<typeof RrwebSerializedNodeSchema>;

const RrwebStyleValueSchema = z.record(
  z.string(),
  z.union([z.string(), z.literal(false), z.tuple([z.string(), z.string()])]),
);
const RrwebStyleIndexSchema = z.union([z.number(), z.array(z.number())]);
const RrwebStyleAddRuleSchema = z.strictObject({
  rule: z.string(),
  index: RrwebStyleIndexSchema.optional(),
});
const RrwebMovementPositionSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  id: z.number(),
  timeOffset: z.number(),
});

export const RrwebIncrementalDataSchema = z.union([
  z.strictObject({
    source: z.literal(0),
    texts: z.array(z.strictObject({ id: z.number(), value: z.string().nullable() })),
    attributes: z.array(
      z.strictObject({
        id: z.number(),
        attributes: z.record(z.string(), z.union([z.string(), RrwebStyleValueSchema, z.null()])),
      }),
    ),
    removes: z.array(z.strictObject({ parentId: z.number(), id: z.number(), isShadow: z.boolean().optional() })),
    adds: z.array(
      z.strictObject({
        parentId: z.number(),
        previousId: z.number().nullable().optional(),
        nextId: z.number().nullable(),
        node: RrwebSerializedNodeSchema,
      }),
    ),
    isAttachIframe: z.literal(true).optional(),
  }),
  ...([1, 6, 12] as const).map(source =>
    z.strictObject({ source: z.literal(source), positions: z.array(RrwebMovementPositionSchema) }),
  ),
  z.strictObject({
    source: z.literal(2),
    type: z.union([
      z.literal(0),
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
      z.literal(7),
      z.literal(9),
      z.literal(10),
    ]),
    id: z.number(),
    x: z.number().optional(),
    y: z.number().optional(),
    pointerType: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  }),
  z.strictObject({ source: z.literal(3), id: z.number(), x: z.number(), y: z.number() }),
  z.strictObject({ source: z.literal(4), width: z.number(), height: z.number() }),
  z.strictObject({
    source: z.literal(5),
    id: z.number(),
    text: z.string(),
    isChecked: z.boolean(),
  }),
  z.strictObject({
    source: z.literal(7),
    type: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    id: z.number(),
    currentTime: z.number().optional(),
    volume: z.number().optional(),
    muted: z.boolean().optional(),
    loop: z.boolean().optional(),
    playbackRate: z.number().optional(),
  }),
  z.union([
    z.strictObject({
      source: z.literal(8),
      id: z.number(),
      removes: z.array(z.strictObject({ index: RrwebStyleIndexSchema })),
    }),
    z.strictObject({ source: z.literal(8), id: z.number(), adds: z.array(RrwebStyleAddRuleSchema) }),
    z.strictObject({ source: z.literal(8), id: z.number(), replace: z.string() }),
    z.strictObject({ source: z.literal(8), id: z.number(), replaceSync: z.string() }),
    z.strictObject({
      source: z.literal(8),
      styleId: z.number(),
      removes: z.array(z.strictObject({ index: RrwebStyleIndexSchema })),
    }),
    z.strictObject({ source: z.literal(8), styleId: z.number(), adds: z.array(RrwebStyleAddRuleSchema) }),
    z.strictObject({ source: z.literal(8), styleId: z.number(), replace: z.string() }),
    z.strictObject({ source: z.literal(8), styleId: z.number(), replaceSync: z.string() }),
  ]),
  z.union([
    z.strictObject({
      source: z.literal(13),
      id: z.number(),
      index: z.array(z.number()),
      set: z.strictObject({ property: z.string(), value: z.string().nullable(), priority: z.string().optional() }),
    }),
    z.strictObject({
      source: z.literal(13),
      id: z.number(),
      index: z.array(z.number()),
      remove: z.strictObject({ property: z.string() }),
    }),
    z.strictObject({
      source: z.literal(13),
      styleId: z.number(),
      index: z.array(z.number()),
      set: z.strictObject({ property: z.string(), value: z.string().nullable(), priority: z.string().optional() }),
    }),
    z.strictObject({
      source: z.literal(13),
      styleId: z.number(),
      index: z.array(z.number()),
      remove: z.strictObject({ property: z.string() }),
    }),
  ]),
  z.strictObject({
    source: z.literal(14),
    ranges: z.array(
      z.strictObject({
        start: z.number(),
        startOffset: z.number(),
        end: z.number(),
        endOffset: z.number(),
      }),
    ),
  }),
  z.strictObject({
    source: z.literal(15),
    id: z.number(),
    styles: z.array(z.strictObject({ styleId: z.number(), rules: z.array(RrwebStyleAddRuleSchema) })).optional(),
    styleIds: z.array(z.number()),
  }),
  z.strictObject({ source: z.literal(16), define: z.strictObject({ name: z.string() }) }),
]);

const RrwebTimedFields = { timestamp: z.number() };

export const RrwebEventSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal(0), data: z.strictObject({}), ...RrwebTimedFields }),
  z.strictObject({ type: z.literal(1), data: z.strictObject({}), ...RrwebTimedFields }),
  z.strictObject({
    type: z.literal(2),
    data: z.strictObject({
      node: RrwebSerializedNodeSchema,
      initialOffset: z.strictObject({ top: z.number(), left: z.number() }),
    }),
    ...RrwebTimedFields,
  }),
  z.strictObject({ type: z.literal(3), data: RrwebIncrementalDataSchema, ...RrwebTimedFields }),
  z.strictObject({
    type: z.literal(4),
    data: z.strictObject({ href: z.string(), width: z.number(), height: z.number() }),
    ...RrwebTimedFields,
  }),
]);
export type RrwebEvent = z.infer<typeof RrwebEventSchema>;

export const SlackWebhookUrlSchema = z.url().refine(u => /^https:\/\/hooks\.slack\.com\//.test(u), {
  message: 'Slack webhook URL must start with https://hooks.slack.com/',
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
