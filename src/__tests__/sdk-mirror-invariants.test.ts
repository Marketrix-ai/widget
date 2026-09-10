/**
 * Security invariants this repo can assert about its own generated SDK mirror.
 *
 * `src/sdk/` is a generated mirror this repo may not hand-edit, and drift against the api is checked
 * in infra — but a REGENERATION that reintroduces a credential-shaped input is a security regression
 * this side can catch on its own, before the tag it would ship under.
 *
 * `application_id` is deliberately not an input: accepting a bare, guessable application id as the
 * credential let an anonymous caller drive any tenant's agent. It is output-only, on `registered`.
 *
 * Contents:
 * - `inputFields` reads a procedure's oRPC input-schema keys, throwing rather than returning empty
 *   when the contract stops exposing `~orpc.inputSchema.shape` — a blind check must fail loudly.
 * - the `it.each` over `widgetStream` / `widgetMessagePost` pins that neither accepts `application_id`.
 * - `still reads a real input shape` checks the accessor against a known answer (`chat_id` on
 *   `widgetStream`): a silent `[]` would make the assertions above vacuously pass.
 */
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
