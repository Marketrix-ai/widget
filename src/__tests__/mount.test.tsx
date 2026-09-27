/**
 * Tests for the widget's entry paths: the classic loader adds its React import map only when the host's
 * lacks one and injects the module script with the `mtx-*` attributes, a direct module script auto-initializes from its `mtx-*` attributes and
 * requires an API host, and every mounted widget gets its CSS inside the closed shadow root.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'bun:test';

import * as WidgetService from '../services/WidgetService';
import { getMockWidgetConfig } from '../test/fixtures';

const loaderSource = readFileSync(resolve(process.cwd(), 'public/loader.js'), 'utf8');

vi.mock('../index.css?inline', () => ({ default: '.marketrix-widget-container { display: block; }' }));

const appendModuleScript = (attributes: Record<string, string>) => {
  const script = document.createElement('script');
  script.type = 'module';
  script.src = 'https://cdn.test/widget.mjs';
  for (const [name, value] of Object.entries(attributes)) script.setAttribute(name, value);
  document.head.appendChild(script);
};

const MTX_ATTRS = {
  'mtx-id': 'widget-id',
  'mtx-key': 'widget-key',
  'mtx-api-host': 'https://api.test',
  'mtx-use-screenshare': 'false',
};
const ESM_REACT = {
  react: 'https://esm.sh/react@19',
  'react-dom': 'https://esm.sh/react-dom@19',
  'react-dom/client': 'https://esm.sh/react-dom@19/client',
  'react/jsx-runtime': 'https://esm.sh/react@19/jsx-runtime',
};

const runLoader = (...hostMaps: string[]): HTMLScriptElement[] => {
  for (const textContent of hostMaps) {
    const map = document.createElement('script');
    map.type = 'importmap';
    map.textContent = textContent;
    document.head.appendChild(map);
  }
  const loader = document.createElement('script');
  loader.src = 'https://cdn.test/widgets/loader.js';
  loader.async = true;
  for (const [name, value] of Object.entries(MTX_ATTRS)) loader.setAttribute(name, value);
  document.head.appendChild(loader);
  Object.defineProperty(document, 'currentScript', { configurable: true, get: () => loader });
  Function(loaderSource)();
  return [...document.head.querySelectorAll('script')].slice(hostMaps.length + 1);
};

const resetDocument = () => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  window.__mtx = undefined;
};

let mountImportCount = 0;
const importMount = () => import(`../mount.tsx?t=${mountImportCount++}`);

const runAutoInit = async () => {
  const init = vi.spyOn(WidgetService, 'loadWidgetConfig').mockReturnValue(new Promise(() => {}));
  const { autoInitializeWidget } = await importMount();
  autoInitializeWidget();
  return init;
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (document as { currentScript?: unknown }).currentScript;
  resetDocument();
});

describe('widget public entry paths', () => {
  it('keeps the host map, adds the React map it lacks, and forwards only mtx-* attributes to the module', () => {
    const injected = runLoader(JSON.stringify({ imports: { react: 'https://host.test/react.js', host: '/host.js' } }));

    expect(injected.map(node => node.type)).toEqual(['importmap', 'module']);
    expect(JSON.parse(injected[0]?.textContent ?? '{}')).toEqual({ imports: ESM_REACT });
    expect(Object.fromEntries([...(injected[1]?.attributes ?? [])].map(attr => [attr.name, attr.value]))).toEqual({
      type: 'module',
      src: 'https://cdn.test/widgets/widget.mjs',
      ...MTX_ATTRS,
    });
  });

  it('adds no second import map when the host map already supplies React, which Firefox would ignore', () => {
    expect(runLoader(JSON.stringify({ imports: ESM_REACT })).map(node => node.type)).toEqual(['module']);
  });

  it('still loads, adding its own map, over a host import map that is not valid JSON', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(runLoader('{ not json', 'null').map(node => node.type)).toEqual(['importmap', 'module']);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('auto-initializes once from the direct module script attributes', async () => {
    appendModuleScript({
      'mtx-id': 'widget-id',
      'mtx-key': 'widget-key',
      'mtx-api-host': 'https://api.test',
      'mtx-use-screenshare': 'false',
      'mtx-style-nonce': 'csp-nonce-abc',
    });
    const init = await runAutoInit();

    expect(init).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledWith({
      mtxId: 'widget-id',
      mtxKey: 'widget-key',
      mtxApiHost: 'https://api.test',
      use_screenshare: false,
      styleNonce: 'csp-nonce-abc',
    });
  });

  it('refuses to initialize without mtx-api-host, which would post at the host page instead', async () => {
    appendModuleScript({ 'mtx-id': 'widget-id', 'mtx-key': 'widget-key' });
    const init = await runAutoInit();

    expect(init).not.toHaveBeenCalled();
  });

  it('never re-triggers init once the widget is already initializing or active', async () => {
    appendModuleScript({ 'mtx-id': 'widget-id', 'mtx-key': 'widget-key', 'mtx-api-host': 'https://api.test' });
    window.__mtx = { state: 'active' };
    const init = await runAutoInit();

    expect(init).not.toHaveBeenCalled();
  });

  it('does nothing for npm consumers without an auto-init script', async () => {
    vi.useFakeTimers();
    const timer = vi.spyOn(globalThis, 'setTimeout');
    const init = await runAutoInit();

    expect(init).not.toHaveBeenCalled();
    expect(timer).not.toHaveBeenCalled();
    expect(document.getElementById('marketrix-widget-notice-container')).toBeNull();
  });

  it('mounts every widget a parent is given, in this module instance and the next', async () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);

    const first = await importMount();
    first.renderWidget(getMockWidgetConfig(), parent);
    first.renderWidget(getMockWidgetConfig(), parent);

    const reExecuted = await importMount();
    reExecuted.renderWidget(getMockWidgetConfig(), parent);

    expect(parent.querySelectorAll('.marketrix-widget-container')).toHaveLength(3);
  });

  it('owns non-empty widget CSS inside the closed shadow root', async () => {
    const { renderWidget } = await importMount();
    const attach = vi.spyOn(HTMLElement.prototype, 'attachShadow');

    renderWidget(getMockWidgetConfig());

    const styles = (attach.mock.results[0]?.value as ShadowRoot).querySelectorAll('style');
    expect(styles).toHaveLength(1);
    expect(styles[0]?.textContent?.trim()).toBeTruthy();
    expect(document.head.querySelector('style')).toBeNull();
  });

  it('leaves the injected style element without a nonce by default, and applies one when given', async () => {
    const { renderWidget } = await importMount();
    const attach = vi.spyOn(HTMLElement.prototype, 'attachShadow');

    renderWidget(getMockWidgetConfig());
    renderWidget(getMockWidgetConfig({ styleNonce: 'csp-nonce-123' }));

    const [bare, nonced] = attach.mock.results.map(
      result => (result.value as ShadowRoot).querySelector('style')?.nonce,
    );
    expect(bare).toBe('');
    expect(nonced).toBe('csp-nonce-123');
  });

  it.each([
    ['loading', { 'mtx-api-host': 'https://api.test' }],
    ['missing-host', {}],
  ])('applies the style nonce to the %s host-page notice', async (_case, attributes) => {
    appendModuleScript({ 'mtx-id': 'widget-id', 'mtx-key': 'widget-key', 'mtx-style-nonce': 'csp-n', ...attributes });
    const attach = vi.spyOn(HTMLElement.prototype, 'attachShadow');
    await runAutoInit();

    expect((attach.mock.results[0]?.value as ShadowRoot).querySelector('style')?.nonce).toBe('csp-n');
  });
});
