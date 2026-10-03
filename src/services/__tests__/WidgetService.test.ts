/**
 * `loadWidgetConfig` tests: one load is one search and returns one schema-validated config, never a defaults
 * read; an invalid settings response is rejected naming the schema field; a repeat call for the same
 * credentials reuses the cached lookup instead of re-searching, and a failed lookup is never cached so the
 * next call retries against the api. The api's 401 for unknown credentials reads as a failed validation. Each case uses its own `mtxId` so the module-level `widgetLookupCache`
 * from one test cannot leak a cached result into another. An unreachable-api error names the configured
 * host.
 */
import { ORPCError } from '@orpc/client';
import { beforeEach, describe, expect, it, vi } from 'bun:test';

import type { ApplicationWidgetPublicData, WidgetClient } from '../../sdk';
import { validSettings } from '../../test/fixtures';
import { mockSdk } from '../../test/vi-compat';
import { loadWidgetConfig } from '../WidgetService';

const widgetPublicSearch = vi.fn<WidgetClient['widgetPublicSearch']>();
mockSdk({ widgetPublicSearch });
const settings = validSettings();

const activeWidget = (overrides: Partial<ApplicationWidgetPublicData> = {}): ApplicationWidgetPublicData => ({
  application_id: 42,
  widget_settings: settings,
  ...overrides,
});
const searchResult = (overrides: Partial<ApplicationWidgetPublicData> = {}) => ({
  items: [activeWidget(overrides)],
  total: 1,
  limit: 20,
  offset: 0,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loadWidgetConfig', () => {
  it('names the configured api host when the api is unreachable', async () => {
    widgetPublicSearch.mockRejectedValue(new Error('Failed to fetch'));

    await expect(
      loadWidgetConfig({ mtxId: 'unreachable-with-host', mtxKey: 'test-key', mtxApiHost: 'https://api.test' }),
    ).rejects.toThrow('Please ensure the API server is running at https://api.test');
  });

  it('loads the widget in one search and returns one schema-validated config', async () => {
    widgetPublicSearch.mockResolvedValue(searchResult());

    const config = await loadWidgetConfig({
      mtxId: 'load-once',
      mtxKey: 'test-key',
      mtxApiHost: 'https://api.test',
      show_widget: false,
    });

    expect(widgetPublicSearch).toHaveBeenCalledTimes(1);
    expect(config).toMatchObject({ mtxId: 'load-once', mtxKey: 'test-key', show_widget: false });
  });

  it('sends only the credential pair to the boot call, never viewport or other host page data', async () => {
    widgetPublicSearch.mockResolvedValue(searchResult());

    await loadWidgetConfig({ mtxId: 'creds-only', mtxKey: 'test-key', mtxApiHost: 'https://api.test' });

    expect(widgetPublicSearch).toHaveBeenCalledWith({
      marketrix_id: 'creds-only',
      marketrix_key: 'test-key',
    });
  });

  it('rejects an invalid merged settings response with the schema field', async () => {
    const offContract = { ...settings };
    Reflect.set(offContract, 'widget_position', 'somewhere');
    widgetPublicSearch.mockResolvedValue(searchResult({ widget_settings: offContract }));

    await expect(
      loadWidgetConfig({ mtxId: 'invalid-settings', mtxKey: 'test-key', mtxApiHost: 'https://api.test' }),
    ).rejects.toThrow(/widget_position/);
    expect(widgetPublicSearch).toHaveBeenCalledTimes(1);
  });

  it("reports the api's refusal of unknown credentials as a failed validation", async () => {
    widgetPublicSearch.mockRejectedValue(new ORPCError('UNAUTHORIZED', { message: 'Invalid widget credentials' }));

    await expect(
      loadWidgetConfig({ mtxId: 'failed-search', mtxKey: 'test-key', mtxApiHost: 'https://api.test' }),
    ).rejects.toThrow('Widget validation failed: Invalid widget credentials');
  });

  it('caches the credentialed lookup so a repeat call for the same mtx-id never re-searches', async () => {
    widgetPublicSearch.mockResolvedValue(searchResult());

    const first = await loadWidgetConfig({
      mtxId: 'cache-me',
      mtxKey: 'test-key',
      mtxApiHost: 'https://api.test',
      show_widget: true,
    });
    const second = await loadWidgetConfig({
      mtxId: 'cache-me',
      mtxKey: 'test-key',
      mtxApiHost: 'https://api.test',
      show_widget: false,
    });

    expect(widgetPublicSearch).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({ show_widget: true });
    expect(second).toMatchObject({ show_widget: false });
  });

  it('shares one in-flight lookup between concurrent callers for the same mtx-id', async () => {
    let resolveSearch!: (value: ReturnType<typeof searchResult>) => void;
    widgetPublicSearch.mockReturnValue(
      new Promise(resolve => {
        resolveSearch = resolve;
      }),
    );

    const first = loadWidgetConfig({ mtxId: 'concurrent', mtxKey: 'test-key', mtxApiHost: 'https://api.test' });
    const second = loadWidgetConfig({ mtxId: 'concurrent', mtxKey: 'test-key', mtxApiHost: 'https://api.test' });
    resolveSearch(searchResult());

    await Promise.all([first, second]);
    expect(widgetPublicSearch).toHaveBeenCalledTimes(1);
  });

  it('never caches a failed lookup, so the next call retries against the api', async () => {
    widgetPublicSearch.mockRejectedValueOnce(new Error('offline'));
    await expect(
      loadWidgetConfig({ mtxId: 'retry-after-failure', mtxKey: 'test-key', mtxApiHost: 'https://api.test' }),
    ).rejects.toThrow('offline');

    widgetPublicSearch.mockResolvedValueOnce(searchResult());
    const config = await loadWidgetConfig({
      mtxId: 'retry-after-failure',
      mtxKey: 'test-key',
      mtxApiHost: 'https://api.test',
    });

    expect(widgetPublicSearch).toHaveBeenCalledTimes(2);
    expect(config).toMatchObject({ mtxId: 'retry-after-failure', isPreviewMode: false });
  });
});
