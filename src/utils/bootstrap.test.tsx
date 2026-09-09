/**
 * Entry-path tests: the classic loader preserves host React importmap entries and injects the module;
 * a direct module script auto-initializes once from its `mtx-*` attributes and refuses without
 * `mtx-api-host`; npm consumers get no auto-init; every widget a parent mounts is owned in this module
 * instance and the next; and the widget CSS lands, non-empty, inside the closed shadow root.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const loaderSource = readFileSync(resolve(process.cwd(), 'public/loader.js'), 'utf8');

vi.mock('../index.css?inline', () => ({ default: '.marketrix-widget-container { display: block; }' }));

const appendModuleScript = (attributes: Record<string, string>) => {
  const script = document.createElement('script');
  script.type = 'module';
  script.src = 'https://cdn.test/widget.mjs';
  for (const [name, value] of Object.entries(attributes)) script.setAttribute(name, value);
  document.head.appendChild(script);
};

const resetDocument = () => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  window.__mtx = undefined;
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.resetModules();
  resetDocument();
});

describe('widget public entry paths', () => {
  it('preserves host React mappings and injects the configured module from the classic loader', () => {
    const importMap = document.createElement('script');
    importMap.type = 'importmap';
    importMap.textContent = JSON.stringify({ imports: { react: 'https://host.test/react.js', host: '/host.js' } });
    document.head.appendChild(importMap);

    const loader = document.createElement('script');
    loader.src = 'https://cdn.test/widgets/loader.js';
    loader.setAttribute('mtx-id', 'widget-id');
    loader.setAttribute('mtx-key', 'widget-key');
    loader.setAttribute('mtx-api-host', 'https://api.test');
    loader.setAttribute('mtx-use-screenshare', 'false');
    document.head.appendChild(loader);
    vi.spyOn(document, 'currentScript', 'get').mockReturnValue(loader);

    Function(loaderSource)();

    const maps = [...document.querySelectorAll('script[type="importmap"]')].map(node =>
      JSON.parse(node.textContent ?? '{}'),
    );
    expect(maps).toEqual([
      { imports: { react: 'https://host.test/react.js', host: '/host.js' } },
      {
        imports: {
          react: 'https://esm.sh/react@19',
          'react-dom': 'https://esm.sh/react-dom@19',
          'react-dom/client': 'https://esm.sh/react-dom@19/client',
          'react/jsx-runtime': 'https://esm.sh/react@19/jsx-runtime',
        },
      },
    ]);
    const modules = document.querySelectorAll('script[type="module"]');
    expect(modules).toHaveLength(1);
    expect(modules[0]).toMatchObject({ src: 'https://cdn.test/widgets/widget.mjs' });
    expect(
      Object.fromEntries(
        ['mtx-id', 'mtx-key', 'mtx-api-host', 'mtx-use-screenshare'].map(name => [name, modules[0].getAttribute(name)]),
      ),
    ).toEqual({
      'mtx-id': 'widget-id',
      'mtx-key': 'widget-key',
      'mtx-api-host': 'https://api.test',
      'mtx-use-screenshare': 'false',
    });
  });

  it('auto-initializes once from the direct module script attributes', async () => {
    appendModuleScript({
      'mtx-id': 'widget-id',
      'mtx-key': 'widget-key',
      'mtx-api-host': 'https://api.test',
      'mtx-use-screenshare': 'false',
    });
    const init = vi.fn().mockResolvedValue(undefined);
    const { autoInitializeWidget } = await import('./bootstrap');

    autoInitializeWidget(init);

    expect(init).toHaveBeenCalledOnce();
    expect(init).toHaveBeenCalledWith({
      mtxId: 'widget-id',
      mtxKey: 'widget-key',
      mtxApiHost: 'https://api.test',
      use_screenshare: false,
    });
  });

  it('refuses to initialize without mtx-api-host, which would post at the host page instead', async () => {
    appendModuleScript({ 'mtx-id': 'widget-id', 'mtx-key': 'widget-key' });
    const init = vi.fn().mockResolvedValue(undefined);
    const { autoInitializeWidget } = await import('./bootstrap');

    autoInitializeWidget(init);

    expect(init).not.toHaveBeenCalled();
  });

  it('does nothing for npm consumers without an auto-init script', async () => {
    vi.useFakeTimers();
    const init = vi.fn().mockResolvedValue(undefined);
    const timer = vi.spyOn(globalThis, 'setTimeout');
    const { autoInitializeWidget } = await import('./bootstrap');

    autoInitializeWidget(init);

    expect(init).not.toHaveBeenCalled();
    expect(timer).not.toHaveBeenCalled();
    expect(document.getElementById('marketrix-widget-notice-container')).toBeNull();
  });

  it('mounts every widget a parent is given, in this module instance and the next', async () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);

    const first = await import('./bootstrap');
    first.createWidgetContainer(parent);
    first.createWidgetContainer(parent);

    vi.resetModules();
    const reExecuted = await import('./bootstrap');
    reExecuted.createWidgetContainer(parent);

    expect(parent.querySelectorAll('.marketrix-widget-container')).toHaveLength(3);
  });

  it('owns non-empty widget CSS inside the closed shadow root', async () => {
    const { createWidgetContainer } = await import('./bootstrap');

    const { shadowRoot } = createWidgetContainer();

    const styles = shadowRoot.querySelectorAll('style');
    expect(styles).toHaveLength(1);
    expect(styles[0].textContent?.trim()).toBeTruthy();
    expect(document.head.querySelector('style')).toBeNull();
  });
});
