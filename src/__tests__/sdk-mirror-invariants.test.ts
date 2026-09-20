/**
 * Security-invariant tests on the generated SDK mirror: `widgetStream`/`widgetMessagePost` never
 * accept `application_id` as an input, since that credential must stay output-only. Also checks the
 * mirror has no hand-written routes.ts/schema.ts — it is generated, never edited in place.
 */
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'bun:test';

import { widgetMessagePost, widgetStream } from '../sdk/contracts/widget';

function inputFields(procedure: unknown): string[] {
  const schema = (procedure as { '~orpc': { inputSchema?: { shape?: Record<string, unknown> } } })['~orpc'].inputSchema;
  const shape = schema?.shape;
  if (!shape)
    throw new Error('the oRPC contract no longer exposes ~orpc.inputSchema.shape — this check is blind, fix it');
  return Object.keys(shape);
}

it.each([
  ['widgetStream', widgetStream],
  ['widgetMessagePost', widgetMessagePost],
])('%s does not accept application_id as an input', (_name, procedure) => {
  expect(inputFields(procedure)).not.toContain('application_id');
});

it('still reads a real input shape', () => {
  expect(inputFields(widgetStream)).toContain('chat_id');
});

it('has no hand-written routes.ts or schema.ts in the sdk mirror', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const sdkDir = resolve(here, '../sdk');
  const names = readdirSync(sdkDir, { recursive: true }).map(String);
  expect(names.some(n => n.endsWith('routes.ts'))).toBe(false);
  expect(names.some(n => n.endsWith('schema.ts'))).toBe(false);
});
