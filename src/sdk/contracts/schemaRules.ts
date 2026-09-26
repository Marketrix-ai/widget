/**
 * Domain-free refinements shared across contracts: `NON_BLANK`, the one whitespace class blank text is judged by
 * (JavaScript's `\s` and `trim()` set, spelled out because the agent declares the same class by name),
 * `NonBlankStringSchema`, a string with a non-space character and the one spelling of a required string, `optionalText`, capped free text whose blank clears it to null,
 * and `distinctListOf`, a list whose rows are unique by each of its keys.
 */
import { z } from 'zod';

export const NON_BLANK = /[^\t-\r\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/;

export const NonBlankStringSchema = z.string().regex(NON_BLANK, 'Must not be blank');

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform(text => text || null);

export const distinctListOf = <T extends z.ZodType>(
  item: T,
  ...uniques: (readonly [key: (row: z.output<T>) => string, message: string])[]
) =>
  uniques.reduce(
    (list, [key, message]) => list.refine(rows => new Set(rows.map(key)).size === rows.length, message),
    z.array(item),
  );
