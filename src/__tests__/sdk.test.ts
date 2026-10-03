/**
 * Embed-hygiene invariant on `sdk/index.ts`'s hand-written transport wiring: every request explicitly
 * omits credentials. This widget authenticates with `marketrix_id`/`marketrix_key` request fields, never
 * a cookie, and runs as a script embedded on an arbitrary host page — nothing here should ever ask the
 * browser to attach ambient cookies/HTTP auth to an api call, regardless of what domain `mtxApiHost`
 * happens to resolve to. Spies on `globalThis.fetch` (the real transport `RPCLink` calls into) rather
 * than mocking the sdk module itself, since the property under test is `createClient`'s own `fetch`
 * override, not anything the mirror or a higher-level mock could stand in for.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { configureSdk, getSdk } from '../sdk';

describe('sdk transport', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('omits credentials on every request, explicitly, not by relying on the cross-origin default', async () => {
    configureSdk('https://api.test');

    await getSdk().widgetMessagePost({ chat_id: 'c1', command: { type: 'chat/stop' } });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = fetchSpy.mock.calls[0]?.[1];
    expect(init?.credentials).toBe('omit');
  });
});
