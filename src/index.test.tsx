import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MarketrixWidget, mountWidget, unmountWidget } from './index';
import { WidgetSettingsDataSchema } from './sdk';
import { configManager } from './services/ConfigManager';
import { StreamClient } from './services/StreamClient';
import * as WidgetService from './services/WidgetService';
import { getMockWidgetConfig } from './test/fixtures';

afterEach(() => {
  cleanup();
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

  it('mounts programmatic preview settings without an API fetch', async () => {
    const loadConfig = vi.spyOn(WidgetService, 'loadWidgetConfig');
    const container = document.createElement('div');
    document.body.appendChild(container);

    await act(() =>
      mountWidget({
        settings: WidgetSettingsDataSchema.parse(getMockWidgetConfig()),
        container,
      }),
    );

    expect(loadConfig).not.toHaveBeenCalled();
    expect(container.querySelector('.marketrix-widget-container')).toBeTruthy();
  });

  it('refreshes preview configuration when credentials and API host change', async () => {
    const settings = WidgetSettingsDataSchema.parse(getMockWidgetConfig());
    const saveConfig = vi.spyOn(configManager, 'saveConfig');
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
