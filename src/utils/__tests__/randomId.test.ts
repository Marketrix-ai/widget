/**
 * `randomId` tests: it mints distinct v4 UUIDs, and it and a chat message still mint where
 * `crypto.randomUUID` is missing, as it is on a plain-http host page.
 */
import { afterEach, describe, expect, it } from 'bun:test';

import { createUserMessage } from '../chat';
import { randomId } from '../randomId';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const randomUUID = globalThis.crypto.randomUUID;

afterEach(() => {
  Object.defineProperty(globalThis.crypto, 'randomUUID', { value: randomUUID, configurable: true, writable: true });
});

describe('randomId', () => {
  it('mints distinct v4 UUIDs', () => {
    const ids = new Set(Array.from({ length: 100 }, randomId));
    expect(ids.size).toBe(100);
    for (const id of ids) expect(id).toMatch(V4);
  });

  it('works outside a secure context, where crypto.randomUUID does not exist', () => {
    Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true, writable: true });
    expect(randomId()).toMatch(V4);
    expect(createUserMessage('hello', 'tell').id).toMatch(/^user-/);
  });
});
