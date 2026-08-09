import { act, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mountWidget, unmountWidget } from './index';
import { WidgetSettingsDataSchema } from './sdk';
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
    const fetchSettings = vi.spyOn(WidgetService, 'fetchWidgetSettings');
    const container = document.createElement('div');
    document.body.appendChild(container);

    await act(() =>
      mountWidget({
        settings: WidgetSettingsDataSchema.parse(getMockWidgetConfig()),
        container,
      }),
    );

    expect(fetchSettings).not.toHaveBeenCalled();
    expect(container.querySelector('.marketrix-widget-container')).toBeTruthy();
  });
});
