/**
 * Wire primitives shared across every domain: id and pagination shapes, list and patch helpers.
 *
 * Exports `IdSchema` (an id a caller sends), `RowIdSchema` (a stored id or FK, whose int-ness Postgres enforces),
 * `PositiveBigintStringSchema` (a bigint id as text, or a row id keying a map), `BaseEntitySchema` (every row's
 * `id`/`created_at`/`updated_at`; `CreatedEntitySchema` for a row never updated),
 * `JsonValue`, helpers like `paginatedListOf`/`unionOfRecord`/`discriminatedUnionOfRecord`, the typed object builders
 * `keysOf`/`fromKeys`/`pickKeys`, the id and pagination input schemas, `StoredDateSchema`, the one date that may
 * arrive as the ISO string a JSONB document stores, and `partialPatch`, whose patches never carry a field's
 * create-time default. This file mirrors whole into the widget SDK, so only domain-free primitives belong here.
 */
import { z } from 'zod';

import { PAGE_SIZE_MAX } from './limits';

export type JsonValue = z.core.util.JSONType;

export const IdSchema = z.number().int().positive();

export const EntityStatusSchema = z.enum(['created', 'active', 'suspended']);
export type EntityStatus = z.infer<typeof EntityStatusSchema>;

export const RowIdSchema = z.number().int();
export const PositiveBigintStringSchema = z.string().regex(/^[1-9]\d*$/);

export const CreatedEntitySchema = z.strictObject({ id: RowIdSchema, created_at: z.date() });
export const BaseEntitySchema = CreatedEntitySchema.extend({ updated_at: z.date() });

export const StoredDateSchema = z.union([
  z.date(),
  z.iso.datetime({ offset: true }).transform(value => new Date(value)),
]);

export const ByIdSchema = z.strictObject({ id: IdSchema });
export const BySlugSchema = z.strictObject({ slug: z.string() });
export const BySimulationIdSchema = z.strictObject({ simulation_id: IdSchema });
export const ByApplicationIdSchema = z.strictObject({ application_id: IdSchema });
export const ByRunIdSchema = z.strictObject({ run_id: IdSchema });
export const ByStudyIdSchema = z.strictObject({ study_id: IdSchema });

export const PaginationSchema = z.strictObject({
  limit: z.number().int().min(1).max(PAGE_SIZE_MAX).default(50),
  offset: z.number().int().min(0).default(0),
});

type StripDefault<T> =
  T extends z.ZodDefault<infer Inner>
    ? Inner
    : T extends z.ZodPipe<z.ZodDefault<infer Inner>, infer Out>
      ? z.ZodPipe<Inner, Out>
      : T;

const stripDefault = (field: z.core.$ZodType): z.core.$ZodType =>
  field instanceof z.ZodDefault
    ? field.removeDefault()
    : field instanceof z.ZodPipe && field.in instanceof z.ZodDefault
      ? z.pipe(field.in.removeDefault(), field.out)
      : field;

export function partialPatch<Shape extends z.ZodRawShape>(schema: z.ZodObject<Shape>) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const shape = Object.fromEntries(
    Object.entries(schema.shape).map(([key, field]) => [key, z.optional(stripDefault(field))]),
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

export const keysOf = <T extends Partial<Record<keyof T, unknown>>>(value: T) =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  Object.keys(value) as (keyof T & string)[];

export const fromKeys = <const K extends string, V>(keys: readonly K[], value: (key: K) => V) =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  Object.fromEntries(keys.map(key => [key, value(key)])) as Record<K, V>;

export const pickKeys = <T, const K extends keyof T & string>(value: T, keys: readonly K[]) =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  Object.fromEntries(keys.map(key => [key, value[key]])) as Pick<T, K>;

const recordMembers = <T extends Record<string, z.ZodType>>(schemas: T) =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
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
