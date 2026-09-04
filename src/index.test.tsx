import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { initWidget, MarketrixWidget, mountWidget, unmountWidget } from './index';
import { WidgetSettingsDataSchema } from './sdk';
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

  it('refreshes preview configuration when credentials and API host change', async () => {
    const settings = WidgetSettingsDataSchema.parse(getMockWidgetConfig());
    const saveConfig = vi.spyOn(storageService, 'setConfig');
    const container = document.createElement('div');
    document.body.appendChild(container);

    const view = render(
      <MarketrixWidget settings={settings} container={container} mtxId='first' mtxKey='first-key' mtxApiHost='one' />,
    );
    await waitFor(() => expect(saveConfig).toHaveBeenLastCalledWith(expect.objectContaining({ mtxId: 'first' })));

    view.rerender(
      <MarketrixWidget settings={settings} container={container} mtxId='second' mtxKey='second-key' mtxApiHost='two' />,
    );

    await waitFor(() =>
      expect(saveConfig).toHaveBeenLastCalledWith(
        expect.objectContaining({ mtxId: 'second', mtxKey: 'second-key', mtxApiHost: 'two' }),
      ),
    );
  });
});
