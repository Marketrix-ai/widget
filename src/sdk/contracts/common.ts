/**
 * Wire primitives shared across every domain: id and pagination shapes and list helpers.
 *
 * Exports `IdSchema` (an id a caller sends), `RowIdSchema` (a stored id or FK, whose int-ness Postgres enforces),
 * `PositiveBigintStringSchema` (a bigint id as text, or a row id keying a map), `BaseEntitySchema` (every row's
 * `id`/`created_at`/`updated_at`; `CreatedEntitySchema` for a row never updated), helpers like
 * `paginatedListOf`/`unionOfRecord`/`discriminatedUnionOfRecord`, the typed object builders `keysOf`/`fromKeys`/
 * `pickKeys` over `withKeys` (an object checked to hold exactly the given keys), the id and pagination input schemas, and `StoredDateSchema`, the one date that may arrive as the ISO
 * string a JSONB document stores. This file mirrors whole into the widget SDK, so only domain-free primitives belong
 * here.
 */
import { z } from 'zod';

import { PAGE_SIZE_MAX } from './limits';

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

export const paginatedListOf = <T extends z.ZodType>(schema: T) =>
  z.strictObject({
    items: z.array(schema),
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
  });

export const keysOf = <T extends Partial<Record<keyof T, unknown>>>(value: T): (keyof T & string)[] =>
  Object.keys(value).filter((key): key is keyof T & string => key in value);

const holdsKeys = <R>(value: unknown, keys: readonly string[]): value is R =>
  typeof value === 'object' && value !== null && Object.keys(value).sort().join() === [...keys].sort().join();

export const withKeys = <R>(value: unknown, keys: readonly string[]): R => {
  if (holdsKeys<R>(value, keys)) return value;
  throw new Error(`Expected exactly the keys ${keys.join(', ')}`);
};

export const fromKeys = <const K extends string, V>(keys: readonly K[], value: (key: K) => V): Record<K, V> =>
  withKeys(Object.fromEntries(keys.map(key => [key, value(key)])), keys);

export const pickKeys = <T, const K extends keyof T & string>(value: T, keys: readonly K[]): Pick<T, K> =>
  withKeys(Object.fromEntries(keys.map(key => [key, value[key]])), keys);

const recordMembers = <T extends Record<string, z.ZodType>>(schemas: T): [T[keyof T], ...T[keyof T][]] => {
  const [first, ...rest] = keysOf(schemas).map(key => schemas[key]);
  if (!first) throw new Error('A union of a record needs at least one member');
  return [first, ...rest];
};

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
