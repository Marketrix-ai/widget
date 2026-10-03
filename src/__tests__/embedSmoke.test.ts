/**
 * Boots the built `dist/widget.mjs` — never the source — in a jsdom host document carrying the README's
 * `script[mtx-id]` tag. Covers the exported runtime surface, the closed-shadow FAB mount and z-index, and that
 * no request fires before a host script tag triggers auto-init. Each run copies the build into its own scratch
 * directory under `dist/`, so parallel runs in one checkout never share one.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { StandardRPCJsonSerializer, StandardRPCSerializer } from '@orpc/client/standard';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';

import { validSettings } from '../test/fixtures';

const testDir = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(testDir, '../..');
const distPath = resolve(root, 'dist/widget.mjs');
const readme = readFileSync(resolve(root, 'README.md'), 'utf8');

const readmeSnippet = readme.match(/```html\n(<script[\s\S]*?<\/script>)\n```/)?.[1];
if (!readmeSnippet) throw new Error('README.md script-tag install snippet not found — update this test');
const mtxAttrNames = [...readmeSnippet.matchAll(/\s(mtx-[a-z-]+)="/g)].flatMap(m => m[1] ?? []);
if (mtxAttrNames.length === 0)
  throw new Error('README.md script-tag snippet carries no mtx-* attributes — update this test');

const namedExportsSnippet = readme.match(/```ts\nimport \{\n([\s\S]*?)\n\} from '@marketrix\.ai\/widget';\n```/)?.[1];
if (!namedExportsSnippet) throw new Error('README.md programmatic-API import snippet not found — update this test');
const documentedExportNames = namedExportsSnippet
  .split(',')
  .map(name => name.trim())
  .filter(Boolean);
if (documentedExportNames.length === 0)
  throw new Error('README.md programmatic-API import snippet carries no named exports — update this test');

let scratchDir = '';
let caseCounter = 0;
const importDist = async (): Promise<string[]> => {
  const file = resolve(scratchDir, `case-${++caseCounter}.mjs`);
  writeFileSync(file, readFileSync(distPath));
  return exportNames(await import(pathToFileURL(file).href));
};
const exportNames = (mod: unknown): string[] => (typeof mod === 'object' && mod !== null ? Object.keys(mod) : []);
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
  application_id: 42,
  widget_settings: settings,
};
const searchResult = { items: [activeWidget], total: 1, limit: 20, offset: 0 };

const realConsoleError = console.error;
const realConsoleWarn = console.warn;
const realFetch = globalThis.fetch;

beforeAll(() => {
  if (!existsSync(distPath))
    throw new Error(`${distPath} is missing — run \`bun run build\` before \`bun test\` (ci runs build first)`);
  scratchDir = mkdtempSync(resolve(root, 'dist/.smoke-'));
});

afterAll(() => {
  rmSync(scratchDir, { recursive: true, force: true });
});

afterEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  delete window.__mtx;
  globalThis.fetch = realFetch;
  console.error = realConsoleError;
  console.warn = realConsoleWarn;
});

describe("embed smoke: the built dist/widget.mjs boots the way a customer's page actually gets it", () => {
  it('adds nothing to window and fires no request when no script[mtx-id] tag is present', async () => {
    const windowKeysBefore = new Set(Object.keys(window));
    const errors: string[] = [];
    const warns: string[] = [];
    console.error = (message: unknown) => errors.push(String(message));
    console.warn = (message: unknown) => warns.push(String(message));
    let fetchCalls = 0;
    globalThis.fetch = Object.assign(
      (): Promise<Response> => {
        fetchCalls++;
        throw new Error('unexpected fetch: no script[mtx-id] tag is present');
      },
      { preconnect: realFetch.preconnect },
    );

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
    const exportNames = await importDist();
    await tick();

    expect(exportNames.sort()).toEqual([...documentedExportNames].sort());
  });

  it('a documented script[mtx-id] tag drives the widgetPublicSearch lookup to mtx-api-host, mounts a closed-shadow FAB at the documented z-index, and leaks only __mtx onto window', async () => {
    attachHostScriptTag();
    const windowKeysBefore = new Set(Object.keys(window));
    const errors: string[] = [];
    console.error = (message: unknown) => errors.push(String(message));

    const requests: Request[] = [];
    const fetchSmoke = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const req = input instanceof Request ? input : new Request(input, init);
      requests.push(req);
      if (req.url.endsWith('/widgetStream')) {
        return new Response(new ReadableStream({ start: controller => controller.close() }), {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        });
      }
      if (req.url.endsWith('/chatCreate')) return orpcJsonResponse('smoke-chat-id');
      return orpcJsonResponse(searchResult);
    };
    globalThis.fetch = Object.assign(fetchSmoke, { preconnect: realFetch.preconnect });

    const { roots, restore } = captureShadowRoots();
    try {
      await importDist();
      expect(requests).toHaveLength(0);

      await tick();
      await tick();

      const searches = requests.filter(r => r.url.endsWith('/widgetPublicSearch'));
      expect(searches).toHaveLength(1);
      expect(searches[0]?.method).toBe('POST');
      expect(requests.every(r => r.url.startsWith(HOST))).toBe(true);

      const host = document.body.querySelector('.marketrix-widget-container');
      if (!host) throw new Error('the widget mounted no host container');
      const shadow = roots.get(host);
      expect(shadow?.mode).toBe('closed');

      const anchor = shadow?.root.querySelector<HTMLElement>('.mtx-fab-anchor');
      expect(anchor).toBeTruthy();
      expect(anchor?.style.zIndex).toBe('2147483002');
      expect(shadow?.root.querySelector('[aria-label="Open chat"]')).toBeTruthy();

      expect(errors).toEqual([]);
      expect(Object.keys(window).filter(k => !windowKeysBefore.has(k))).toEqual(['__mtx']);
    } finally {
      restore();
    }
  });
});
