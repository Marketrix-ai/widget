/**
 * Wire primitives shared across every domain: id and pagination shapes, list and patch helpers.
 *
 * Exports `IdSchema` (every row id), helpers like `paginatedListOf`/`unionOfRecord`/`discriminatedUnionOfRecord`,
 * the id and pagination input schemas, `BaseEntitySchema` and `StoredDateSchema`, the one date that may arrive as
 * the ISO string a JSONB document stores. This file mirrors whole into the widget SDK, so only domain-free
 * primitives belong here.
 */
import { z } from 'zod';

export const IdSchema = z.number().int().positive();

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

export const ByIdSchema = z.strictObject({ id: IdSchema });
export const BySlugSchema = z.strictObject({ slug: z.string() });
export const BySimulationIdSchema = z.strictObject({ simulation_id: IdSchema });
export const ByApplicationIdSchema = z.strictObject({ application_id: IdSchema });
export const ByUserIdSchema = z.strictObject({ user_id: IdSchema });

export const PaginationSchema = z.strictObject({
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
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

const recordMembers = <T extends Record<string, z.ZodType>>(schemas: T) =>
  Object.values(schemas) as [T[keyof T], ...T[keyof T][]];

export const unionOfRecord = <T extends Record<string, z.ZodType>>(schemas: T) => z.union(recordMembers(schemas));

export const discriminatedUnionOfRecord = <
  const K extends string,
  T extends { [P in keyof T & string]: z.ZodObject<Record<K, z.ZodLiteral<P>>> },
>(
  key: K,
  schemas: T,
) => z.discriminatedUnion(key, recordMembers(schemas));

export const SuccessSchema = z.strictObject({ success: z.literal(true) });
export const SuccessWithMessageSchema = SuccessSchema.extend({ message: z.string() });
