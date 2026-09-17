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

import { mocked } from '../test/vi-compat';
import { configureSdk, sdk } from './index';

describe('sdk transport', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('omits credentials on every request, explicitly, not by relying on the cross-origin default', async () => {
    configureSdk('https://api.test');

    await sdk.widgetMessagePost({ chat_id: 'c1', command: { type: 'chat/stop' } });

    const mockedFetch = mocked(globalThis.fetch);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const init = mockedFetch.mock.calls[0]?.[1];
    expect(init?.credentials).toBe('omit');
  });
});
