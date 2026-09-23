/**
 * rrweb session-recording wire shapes: the serialized DOM node tree, incremental mutation data and the
 * recorded event union the widget posts and the dashboard replays.
 *
 * Kept apart from `common.ts` so the widget mirror carries the recording shapes without the dashboard's
 * shared entities.
 */
import { z } from 'zod';

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

const RrwebSerializedNodeSchema: z.ZodType<RrwebSerializedNodeOutput> = z.lazy(() =>
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

const RrwebIncrementalDataSchema = z.union([
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
    type: z.literal([0, 1, 2, 3, 4, 5, 6, 7, 9, 10]),
    id: z.number(),
    x: z.number().optional(),
    y: z.number().optional(),
    pointerType: z.literal([0, 1, 2]).optional(),
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
    type: z.literal([0, 1, 2, 3, 4]),
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
