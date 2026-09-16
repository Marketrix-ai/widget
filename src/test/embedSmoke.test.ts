/**
 * Boots the BUILT `dist/widget.mjs` — never the source — in a jsdom host document exactly the way a
 * customer's browser hands it off: `loader.js` forwards every `mtx-*` attribute from the host's own
 * `<script>` tag onto a `<script type="module" src=".../widget.mjs">` it injects, and the widget itself
 * auto-inits off `document.querySelectorAll('script[mtx-id]')` (`autoInitializeWidget`) rather than its
 * own `document.currentScript`, so dropping an equivalent tag into the document before importing the
 * built module is the same boot a real page gives it. jsdom here has no `runScripts: 'dangerously'`
 * (`src/test/preload.ts`), so `loader.js` itself can't be executed as a real `<script>`; its
 * attribute-forwarding contract is instead run directly as a function against a minimal fake `document`,
 * which is the honest substitute — everything downstream of that forwarding (the actual widget boot) IS
 * exercised against the real built artifact.
 *
 * `bun run build` runs once in `beforeAll` so the dist under test is never stale: this repo's own `ci`
 * script builds AFTER test, so a pre-existing `dist/` can't be assumed here.
 *
 * `mtx-*` attribute NAMES come from parsing README's own script-tag snippet, not a hand-typed list, so a
 * renamed or added attribute breaks this file until the README (or the test) is fixed — never a silent
 * drift between what the docs promise and what boots.
 *
 * The mocked production response is encoded with oRPC's OWN `@orpc/client/standard` serializer, not a
 * hand-guessed envelope: the widget's real `RPCLink` decode only accepts bytes that serializer actually
 * produces, so a fabricated shape would either falsely pass or drift silently from the real wire format.
 *
 * Pins: no host-page fetch before the deferred auto-init tick, and none at all without a `script[mtx-id]`
 * tag · a correctly-attributed tag drives exactly one `widgetPublicSearch` lookup to the documented
 * `mtx-api-host` (never a foreign origin, alongside the session's ordinary `chatCreate`/`widgetStream`
 * calls) · a resolved config mounts a `{ mode: 'closed' }` shadow root holding the FAB at the documented z-index
 * (`LAYER_TOKENS.panel`, 2147483002) · the only global the bundle adds to `window` is `__mtx` · the
 * runtime-exported surface matches `src/index.tsx`'s value exports exactly · console stays silent on a
 * clean boot · `loader.js` forwards only `mtx-*` attributes onto the module script it injects.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { StandardRPCJsonSerializer, StandardRPCSerializer } from '@orpc/client/standard';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';

import { validSettings } from './fixtures';

const testDir = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(testDir, '../..');
const distPath = resolve(root, 'dist/widget.mjs');
const readme = readFileSync(resolve(root, 'README.md'), 'utf8');

const readmeSnippet = readme.match(/```html\n(<script[\s\S]*?<\/script>)\n```/)?.[1];
if (!readmeSnippet) throw new Error('README.md script-tag install snippet not found — update this test');
const mtxAttrNames = [...readmeSnippet.matchAll(/\s(mtx-[a-z-]+)="/g)].map(m => m[1]!);
if (mtxAttrNames.length === 0)
  throw new Error('README.md script-tag snippet carries no mtx-* attributes — update this test');

// Bun caches a plain `.mjs` import by PATH, ignoring the query string (unlike its own `.ts` transpiler
// loader) — a `?case=N` cache-buster is a no-op here and every "fresh boot" would reuse the same
// singleton (`window.__mtx`, `initPromise`, `widgetState.mount`). Each test instead imports its own
// byte-identical COPY of the built file, placed under `dist/` (not the OS tmpdir) so its relative
// `node_modules` resolution for the externalized `react`/`react-dom` still walks up to this repo's own.
const scratchDir = resolve(root, 'dist/.smoke');
let caseCounter = 0;
const importDist = () => {
  const file = resolve(scratchDir, `case-${++caseCounter}.mjs`);
  writeFileSync(file, readFileSync(distPath));
  return import(pathToFileURL(file).href);
};
const tick = () => new Promise<void>(r => setTimeout(r, 0));

const HOST = 'https://widget-embed-smoke.example';
const attrValues: Record<string, string> = {
  'mtx-id': 'smoke-id',
  'mtx-key': 'smoke-key',
  'mtx-api-host': HOST,
};

function attachHostScriptTag(): void {
  const script = document.createElement('script');
  for (const name of mtxAttrNames) script.setAttribute(name, attrValues[name] ?? `smoke-${name}`);
  document.head.appendChild(script);
}

function captureShadowRoots(): { roots: Map<Element, { root: ShadowRoot; mode: string }>; restore: () => void } {
  const roots = new Map<Element, { root: ShadowRoot; mode: string }>();
  const original = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (this: Element, init: ShadowRootInit) {
    const root = original.call(this, init);
    roots.set(this, { root, mode: init.mode });
    return root;
  };
  return { roots, restore: () => (Element.prototype.attachShadow = original) };
}

const serializer = new StandardRPCSerializer(new StandardRPCJsonSerializer());
const orpcJsonResponse = (result: unknown): Response =>
  new Response(JSON.stringify(serializer.serialize(result)), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const settings = validSettings();
const activeWidget = {
  id: 7,
  application_id: 42,
  settings,
  status: 'active' as const,
  marketrix_id: attrValues['mtx-id'],
  marketrix_key: attrValues['mtx-key'],
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
};
const searchResult = { items: [activeWidget], total: 1, limit: 20, offset: 0 };

const realConsoleError = console.error;
const realConsoleWarn = console.warn;
const realFetch = globalThis.fetch;

beforeAll(() => {
  // `bun test` sets `NODE_ENV=test` for this whole process; inheriting that into `vite build` flips its
  // JSX transform to the dev runtime (`jsxDEV`), which the widget's externalized `react/jsx-runtime`
  // doesn't export, so the built bundle throws on its first render. Force production explicitly.
  const build = spawnSync('bun', ['run', 'build'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
  });
  if (build.status !== 0) throw new Error('bun run build failed — cannot smoke test a bundle that was never produced');
  // `vite build` empties `dist/` before writing it, so the scratch dir must be (re)created AFTER the
  // build above, never at module-eval time.
  mkdirSync(scratchDir, { recursive: true });
});

afterAll(() => {
  rmSync(scratchDir, { recursive: true, force: true });
});

afterEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  delete window.__mtx; // an assignment to `undefined` would still CREATE the key, poisoning every later test's window-global baseline
  globalThis.fetch = realFetch;
  console.error = realConsoleError;
  console.warn = realConsoleWarn;
});

describe('loader.js forwards only mtx-* attributes onto the widget.mjs it injects', () => {
  it("copies the host script tag's mtx-* attributes and none else onto the module script", () => {
    const loaderSource = readFileSync(resolve(root, 'public/loader.js'), 'utf8');
    const appended: { type: string; textContent?: string; src?: string; attrs: Record<string, string> }[] = [];
    const currentScript = {
      src: 'https://widget.marketrix.ai/loader.js',
      async: 'true',
      attributes: [
        { name: 'src', value: 'https://widget.marketrix.ai/loader.js' },
        { name: 'async', value: 'true' },
        ...mtxAttrNames.map(name => ({ name, value: attrValues[name] ?? `smoke-${name}` })),
      ],
    };
    const fakeDocument = {
      currentScript,
      head: { appendChild: (el: (typeof appended)[number]) => appended.push(el) },
      createElement: () => {
        const el: (typeof appended)[number] = { type: '', attrs: {} };

        return new Proxy(el, {
          set: (target, prop, value) => {
            (target as unknown as Record<string, unknown>)[prop as string] = value;
            return true;
          },
          get: (target, prop) =>
            prop === 'setAttribute'
              ? (name: string, value: string) => (target.attrs[name] = value)
              : (target as unknown as Record<string, unknown>)[prop as string],
        });
      },
    };

    new Function('document', loaderSource)(fakeDocument);

    expect(appended).toHaveLength(2);
    expect(appended[0]?.type).toBe('importmap');
    expect(JSON.parse(appended[0]?.textContent ?? '{}')).toMatchObject({ imports: { react: expect.any(String) } });

    expect(appended[1]?.type).toBe('module');
    expect(appended[1]?.src).toBe('https://widget.marketrix.ai/widget.mjs');
    expect(appended[1]?.attrs).toEqual(
      Object.fromEntries(mtxAttrNames.map(name => [name, attrValues[name] ?? `smoke-${name}`])),
    );
  });
});

describe("embed smoke: the built dist/widget.mjs boots the way a customer's page actually gets it", () => {
  it('adds nothing to window and fires no request when no script[mtx-id] tag is present', async () => {
    const windowKeysBefore = new Set(Object.keys(window));
    const errors: unknown[] = [];
    const warns: unknown[] = [];
    console.error = (...args: unknown[]) => errors.push(args);
    console.warn = (...args: unknown[]) => warns.push(args);
    let fetchCalls = 0;
    globalThis.fetch = (() => {
      fetchCalls++;
      throw new Error('unexpected fetch: no script[mtx-id] tag is present');
    }) as unknown as typeof fetch;

    await importDist();
    await tick();
    await tick();

    expect(fetchCalls).toBe(0);
    expect(document.body.children.length).toBe(0);
    expect(errors).toEqual([]);
    expect(warns).toEqual([]);
    expect(Object.keys(window).filter(k => !windowKeysBefore.has(k))).toEqual([]);
  });

  it('exports exactly the documented runtime surface', async () => {
    const mod = await importDist();
    await tick(); // drains this instance's deferred auto-init no-op before it can fire mid-way through a later test

    expect(Object.keys(mod).sort()).toEqual(
      [
        'MarketrixWidgetPreview',
        'default',
        'getCurrentConfig',
        'initWidget',
        'mountWidget',
        'unmountWidget',
        'updateMarketrixConfig',
      ].sort(),
    );
  });

  it('a documented script[mtx-id] tag drives the widgetPublicSearch lookup to mtx-api-host, mounts a closed-shadow FAB at the documented z-index, and leaks only __mtx onto window', async () => {
    attachHostScriptTag();
    const windowKeysBefore = new Set(Object.keys(window));
    const errors: unknown[] = [];
    console.error = (...args: unknown[]) => errors.push(args);

    const requests: Request[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(input, init);
      requests.push(req);
      // A resolved config also opens the widget<->api chat session (`chatCreate`) and event stream
      // (`widgetStream`, an oRPC `eventIterator` decoded as SSE) — both real, ordinary parts of the same
      // boot this test is pinning, not the credentialed lookup itself, so each gets an honest response
      // rather than the search result every other procedure would choke decoding.
      if (req.url.endsWith('/widgetStream')) {
        return new Response(new ReadableStream({ start: controller => controller.close() }), {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        });
      }
      if (req.url.endsWith('/chatCreate')) return orpcJsonResponse('smoke-chat-id');
      return orpcJsonResponse(searchResult);
    }) as unknown as typeof fetch;

    const { roots, restore } = captureShadowRoots();
    try {
      await importDist();
      expect(requests).toHaveLength(0); // the deferred auto-init tick hasn't run yet

      await tick();
      await tick();

      const searches = requests.filter(r => r.url.endsWith('/widgetPublicSearch'));
      expect(searches).toHaveLength(1);
      expect(searches[0]?.method).toBe('POST');
      expect(requests.every(r => r.url.startsWith(HOST))).toBe(true);

      const host = document.body.querySelector('.marketrix-widget-container');
      expect(host).toBeTruthy();
      const shadow = roots.get(host as Element);
      expect(shadow?.mode).toBe('closed');

      const anchor = shadow?.root.querySelector('.mtx-fab-anchor') as HTMLElement | null;
      expect(anchor).toBeTruthy();
      expect(anchor?.style.zIndex).toBe('2147483002');
      expect(shadow?.root.querySelector('[aria-label="Open"]')).toBeTruthy();

      expect(errors).toEqual([]);
      expect(Object.keys(window).filter(k => !windowKeysBefore.has(k))).toEqual(['__mtx']);
    } finally {
      restore();
    }
  });
});
