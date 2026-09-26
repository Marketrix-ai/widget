/**
 * Domain-free refinements shared across contracts: `NonBlankStringSchema`, a string with a non-space
 * character and the one spelling of a required string, `optionalText`, capped free text whose blank clears it to null,
 * and `distinctListOf`, a list whose rows are unique by a key.
 */
import { z } from 'zod';

export const NonBlankStringSchema = z.string().regex(/\S/, 'Must not be blank');

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform(text => text || null);

export const distinctListOf = <T extends z.ZodType>(item: T, key: (row: z.output<T>) => string, message: string) =>
  z.array(item).refine(rows => new Set(rows.map(key)).size === rows.length, message);
