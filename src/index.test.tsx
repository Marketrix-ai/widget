import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { initWidget, MarketrixWidget, mountWidget, unmountWidget, updateMarketrixConfig } from './index';
import { WidgetSettingsDataSchema } from './sdk';
import * as ScreenShareService from './services/ScreenShareService';
import { storageService } from './services/StorageService';
import { StreamClient } from './services/StreamClient';
import * as WidgetService from './services/WidgetService';
import { getMockWidgetConfig } from './test/fixtures';

afterEach(() => {
  cleanup();
  unmountWidget();
  vi.clearAllTimers();
  vi.restoreAllMocks();
  document.head.replaceChildren();
  document.body.replaceChildren();
  window.__mtx = undefined;
});

describe('public widget lifecycle', () => {
  it('disconnects the stream on public unmount', () => {
    const disconnect = vi.spyOn(StreamClient.getInstance(), 'disconnect');

    unmountWidget();

    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('ends an in-flight screen share on public unmount', () => {
    const stopScreenShare = vi.spyOn(ScreenShareService, 'stopScreenShare');

    unmountWidget();

    expect(stopScreenShare).toHaveBeenCalledOnce();
  });

  it('mounts programmatic preview settings without an API fetch and owns its cleanup', async () => {
    const loadConfig = vi.spyOn(WidgetService, 'loadWidgetConfig');
    const container = document.createElement('div');
    const replacement = document.createElement('div');
    const unrelated = document.createElement('div');
    unrelated.className = 'marketrix-widget-container';
    document.body.append(container, replacement, unrelated);

    await act(() =>
      mountWidget({
        settings: WidgetSettingsDataSchema.parse(getMockWidgetConfig()),
        container,
      }),
    );

    expect(loadConfig).not.toHaveBeenCalled();
    expect(container.querySelector('.marketrix-widget-container')).toBeTruthy();

    await act(() =>
      mountWidget({
        settings: WidgetSettingsDataSchema.parse(getMockWidgetConfig()),
        container: replacement,
      }),
    );

    expect(container.querySelector('.marketrix-widget-container')).toBeNull();
    expect(replacement.querySelector('.marketrix-widget-container')).toBeTruthy();

    unmountWidget();

    expect(replacement.querySelector('.marketrix-widget-container')).toBeNull();
    expect(unrelated).toBeInTheDocument();
  });

  it('lets a preview invalidate pending production initialization', async () => {
    const settings = WidgetSettingsDataSchema.parse(getMockWidgetConfig());
    let resolveProduction!: (config: typeof settings & { mtxId: string; mtxKey: string; mtxApp: number }) => void;
    vi.spyOn(WidgetService, 'loadWidgetConfig').mockReturnValueOnce(
      new Promise(resolve => {
        resolveProduction = resolve;
      }),
    );
    const productionContainer = document.createElement('div');
    const previewContainer = document.createElement('div');
    document.body.append(productionContainer, previewContainer);

    const production = initWidget(
      { mtxId: 'production', mtxKey: 'key', mtxApiHost: 'https://api.test' },
      productionContainer,
    );
    await act(() => mountWidget({ settings, container: previewContainer }));
    resolveProduction({ ...settings, mtxId: 'production', mtxKey: 'key', mtxApp: 1 });
    await production;

    expect(productionContainer.querySelector('.marketrix-widget-container')).toBeNull();
    expect(previewContainer.querySelectorAll('.marketrix-widget-container')).toHaveLength(1);
  });

  it('refuses production init without an API host instead of posting at the host page', async () => {
    const load = vi.spyOn(WidgetService, 'loadWidgetConfig');
    const container = document.createElement('div');
    document.body.append(container);

    await initWidget({ mtxId: 'no-host', mtxKey: 'key' }, container);

    expect(load).not.toHaveBeenCalled();
    expect(container.querySelector('.marketrix-widget-container')).toBeNull();
    expect(window.__mtx).toBeUndefined();
  });

  it('stops short of mounting, connecting or recording when the resolved config is disabled', async () => {
    const settings = WidgetSettingsDataSchema.parse(getMockWidgetConfig({ widget_enabled: false }));
    const load = vi.spyOn(WidgetService, 'loadWidgetConfig').mockResolvedValue({
      ...settings,
      mtxId: 'disabled',
      mtxKey: 'key',
      mtxApp: 1,
    });
    const container = document.createElement('div');
    document.body.append(container);

    await initWidget({ mtxId: 'disabled', mtxKey: 'key', mtxApiHost: 'https://api.test' }, container);

    expect(load).toHaveBeenCalledOnce();
    expect(container.querySelector('.marketrix-widget-container')).toBeNull();
    expect(window.__mtx).toBeUndefined();
  });

  it('cancels stale production initialization and shares one in-flight promise', async () => {
    const settings = WidgetSettingsDataSchema.parse(getMockWidgetConfig());
    let resolveFirst!: (config: typeof settings & { mtxId: string; mtxKey: string; mtxApp: number }) => void;
    let resolveSecond!: (config: typeof settings & { mtxId: string; mtxKey: string; mtxApp: number }) => void;
    const firstLoad = new Promise<typeof settings & { mtxId: string; mtxKey: string; mtxApp: number }>(resolve => {
      resolveFirst = resolve;
    });
    const secondLoad = new Promise<typeof settings & { mtxId: string; mtxKey: string; mtxApp: number }>(resolve => {
      resolveSecond = resolve;
    });
    vi.spyOn(WidgetService, 'loadWidgetConfig').mockReturnValueOnce(firstLoad).mockReturnValueOnce(secondLoad);
    const firstContainer = document.createElement('div');
    const secondContainer = document.createElement('div');
    const unrelated = document.createElement('div');
    unrelated.className = 'marketrix-widget-container';
    document.body.append(firstContainer, secondContainer, unrelated);

    const first = initWidget({ mtxId: 'first', mtxKey: 'first-key', mtxApiHost: 'https://api.test' }, firstContainer);
    const concurrent = initWidget(
      { mtxId: 'ignored', mtxKey: 'ignored-key', mtxApiHost: 'https://api.test' },
      secondContainer,
    );

    expect(concurrent).toBe(first);
    expect(WidgetService.loadWidgetConfig).toHaveBeenCalledOnce();

    unmountWidget();
    const second = initWidget(
      { mtxId: 'second', mtxKey: 'second-key', mtxApiHost: 'https://api.test' },
      secondContainer,
    );
    resolveFirst({ ...settings, mtxId: 'first', mtxKey: 'first-key', mtxApp: 1 });
    await first;

    expect(firstContainer.querySelector('.marketrix-widget-container')).toBeNull();
    expect(secondContainer.querySelector('.marketrix-widget-container')).toBeNull();

    resolveSecond({ ...settings, mtxId: 'second', mtxKey: 'second-key', mtxApp: 2 });
    await second;

    expect(secondContainer.querySelector('.marketrix-widget-container')).toBeTruthy();

    unmountWidget();

    expect(secondContainer.querySelector('.marketrix-widget-container')).toBeNull();
    expect(unrelated).toBeInTheDocument();
  });

  it('re-mounts an updated config into the container it was given, not the body', async () => {
    const settings = WidgetSettingsDataSchema.parse(getMockWidgetConfig());
    vi.spyOn(WidgetService, 'loadWidgetConfig').mockImplementation(async config => ({
      ...settings,
      ...config,
      mtxApp: 1,
    }));
    const container = document.createElement('div');
    document.body.append(container);

    await act(() => initWidget({ mtxId: 'first', mtxKey: 'key', mtxApiHost: 'https://api.test' }, container));
    expect(container.querySelector('.marketrix-widget-container')).toBeTruthy();

    await act(() => updateMarketrixConfig({ mtxKey: 'rotated' }));

    expect(container.querySelectorAll('.marketrix-widget-container')).toHaveLength(1);
    expect(document.body.querySelector(':scope > .marketrix-widget-container')).toBeNull();
  });

  it('keeps an imperative preview a preview when its config is updated', async () => {
    const settings = WidgetSettingsDataSchema.parse(getMockWidgetConfig());
    const loadConfig = vi.spyOn(WidgetService, 'loadWidgetConfig');
    const container = document.createElement('div');
    document.body.append(container);

    await act(() => mountWidget({ settings, container }));
    await act(() => updateMarketrixConfig({ userId: 7 }));

    expect(loadConfig).not.toHaveBeenCalled();
    expect(container.querySelectorAll('.marketrix-widget-container')).toHaveLength(1);
  });

  it('stores the credentials production was initialized with', async () => {
    const settings = WidgetSettingsDataSchema.parse(getMockWidgetConfig());
    vi.spyOn(WidgetService, 'loadWidgetConfig').mockImplementation(async config => ({
      ...settings,
      ...config,
      mtxId: 'prod-id',
      mtxKey: 'prod-key',
      mtxApp: 1,
    }));
    const container = document.createElement('div');
    document.body.appendChild(container);

    await act(() => initWidget({ mtxId: 'prod-id', mtxKey: 'prod-key', mtxApiHost: 'https://api.test' }, container));

    expect(storageService.getCredentialedConfig()).toMatchObject({ mtxId: 'prod-id', mtxKey: 'prod-key' });
  });

  it('leaves the stored production credentials alone when a preview mounts beside it', async () => {
    const settings = WidgetSettingsDataSchema.parse(getMockWidgetConfig());
    storageService.setConfig({ ...settings, mtxId: 'prod-id', mtxKey: 'prod-key' });
    const preview = document.createElement('div');
    document.body.appendChild(preview);

    render(<MarketrixWidget settings={settings} container={preview} />);
    await waitFor(() => expect(preview.querySelector('.marketrix-widget-container')).toBeTruthy());

    expect(storageService.getCredentialedConfig()).toMatchObject({ mtxId: 'prod-id', mtxKey: 'prod-key' });
  });

  it('with no container prop, mounts into its own rendered div rather than beside it', async () => {
    const settings = WidgetSettingsDataSchema.parse(getMockWidgetConfig());

    const { container: renderedRoot } = render(<MarketrixWidget settings={settings} />);
    const ownDiv = renderedRoot.firstElementChild as HTMLElement;

    await waitFor(() => expect(ownDiv.querySelector('.marketrix-widget-container')).toBeTruthy());
    expect(renderedRoot.querySelectorAll(':scope > .marketrix-widget-container')).toHaveLength(0);
  });
});
