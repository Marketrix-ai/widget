/**
 * `src/sdk/` is a generated mirror this repo may not hand-edit, and drift against the api is checked
 * in infra — but a REGENERATION that reintroduces a credential-shaped input is a security regression
 * this side can catch on its own, before the tag it would ship under.
 *
 * `application_id` is deliberately not an input: accepting a bare, guessable application id as the
 * credential let an anonymous caller drive any tenant's agent. It is output-only, on `registered`.
 */
import { expect, it } from 'vitest';

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
  // Sanity-check the accessor against a known answer: a silent [] would make the assertions vacuous.
  expect(inputFields(widgetStream)).toContain('chat_id');
});
