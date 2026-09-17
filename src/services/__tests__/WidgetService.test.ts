/**
 * `loadWidgetConfig` tests: one load is one search and returns one schema-validated config, never a defaults
 * read; an invalid settings response is rejected naming the schema field; the inactive-widget diagnostic is
 * preserved; a repeat call for the same credentials reuses the cached lookup instead of re-searching, and a
 * failed lookup is never cached so the next call retries against the api. Each case uses its own `mtxId` so
 * the module-level `widgetLookupCache` from one test cannot leak a cached result into another. A missing
 * `mtxId` OR `mtxKey` (either alone, not just both) is refused before any search, and an unreachable-api
 * error names the configured host, falling back to a generic phrase only when none was configured.
 */
import { beforeEach, describe, expect, it, vi } from 'bun:test';

import { sdk } from '../../sdk';
import { validSettings } from '../../test/fixtures';
import { mocked, mockSdkModule, restoreModuleAfterAll } from '../../test/vi-compat';
import { loadWidgetConfig } from '../WidgetService';

vi.mock('../../sdk', () => mockSdkModule({ widgetPublicSearch: vi.fn() }));
restoreModuleAfterAll('../../sdk', () => import('../../sdk/index.ts?real'));

const mockSdk = mocked(sdk);
const settings = validSettings();
const activeWidget = (id: string) => ({
  id: 7,
  application_id: 42,
  settings,
  status: 'active' as const,
  marketrix_id: id,
  marketrix_key: 'test-key',
  created_at: new Date(),
  updated_at: new Date(),
});
const searchResult = (id: string) => ({ items: [activeWidget(id)], total: 1, limit: 20, offset: 0 });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loadWidgetConfig', () => {
  it.each([
    ['mtxId', { mtxKey: 'test-key' }],
    ['mtxKey', { mtxId: 'missing-the-other' }],
  ])('refuses to search when %s alone is missing', async (_label, config) => {
    await expect(loadWidgetConfig(config)).rejects.toThrow('Please provide mtxId + mtxKey');
    expect(mockSdk.widgetPublicSearch).not.toHaveBeenCalled();
  });

  it('names the configured api host when the api is unreachable', async () => {
    mockSdk.widgetPublicSearch.mockRejectedValue(new Error('Failed to fetch'));

    await expect(
      loadWidgetConfig({ mtxId: 'unreachable-with-host', mtxKey: 'test-key', mtxApiHost: 'https://api.test' }),
    ).rejects.toThrow('Please ensure the API server is running at https://api.test');
  });

  it('falls back to a generic phrase when no api host was configured', async () => {
    mockSdk.widgetPublicSearch.mockRejectedValue(new Error('Failed to fetch'));

    await expect(loadWidgetConfig({ mtxId: 'unreachable-no-host', mtxKey: 'test-key' })).rejects.toThrow(
      'Please ensure the API server is running at configured API server',
    );
  });

  it('loads the widget in one search and returns one schema-validated config', async () => {
    mockSdk.widgetPublicSearch.mockResolvedValue(searchResult('load-once'));

    const config = await loadWidgetConfig({ mtxId: 'load-once', mtxKey: 'test-key', show_widget: false });

    expect(mockSdk.widgetPublicSearch).toHaveBeenCalledTimes(1);
    expect(config).toMatchObject({ mtxId: 'load-once', mtxKey: 'test-key', mtxApp: 42, show_widget: false });
  });

  it('rejects an invalid merged settings response with the schema field', async () => {
    mockSdk.widgetPublicSearch.mockResolvedValue({
      items: [
        {
          ...activeWidget('invalid-settings'),
          settings: { ...settings, widget_position: 'somewhere' } as unknown as typeof settings,
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });

    await expect(loadWidgetConfig({ mtxId: 'invalid-settings', mtxKey: 'test-key' })).rejects.toThrow(
      /widget_position/,
    );
    expect(mockSdk.widgetPublicSearch).toHaveBeenCalledTimes(1);
  });

  it('reports a failed search', async () => {
    mockSdk.widgetPublicSearch.mockRejectedValue(new Error('bad credentials'));

    await expect(loadWidgetConfig({ mtxId: 'failed-search', mtxKey: 'test-key' })).rejects.toThrow(/bad credentials/);
  });

  it('preserves the inactive-widget diagnostic without reading the application', async () => {
    mockSdk.widgetPublicSearch.mockResolvedValue({
      items: [{ application_id: 42, settings, status: 'suspended' }],
      total: 1,
      limit: 20,
      offset: 0,
    });

    await expect(loadWidgetConfig({ mtxId: 'inactive', mtxKey: 'test-key' })).rejects.toThrow(
      'Found widget(s) but none are active',
    );
  });

  it('caches the credentialed lookup so a repeat call for the same mtx-id never re-searches', async () => {
    mockSdk.widgetPublicSearch.mockResolvedValue(searchResult('cache-me'));

    const first = await loadWidgetConfig({ mtxId: 'cache-me', mtxKey: 'test-key', show_widget: true });
    const second = await loadWidgetConfig({ mtxId: 'cache-me', mtxKey: 'test-key', show_widget: false });

    expect(mockSdk.widgetPublicSearch).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({ mtxApp: 42, show_widget: true });
    expect(second).toMatchObject({ mtxApp: 42, show_widget: false });
  });

  it('shares one in-flight lookup between concurrent callers for the same mtx-id', async () => {
    let resolveSearch!: (value: ReturnType<typeof searchResult>) => void;
    mockSdk.widgetPublicSearch.mockReturnValue(
      new Promise(resolve => {
        resolveSearch = resolve;
      }),
    );

    const first = loadWidgetConfig({ mtxId: 'concurrent', mtxKey: 'test-key' });
    const second = loadWidgetConfig({ mtxId: 'concurrent', mtxKey: 'test-key' });
    resolveSearch(searchResult('concurrent'));

    await Promise.all([first, second]);
    expect(mockSdk.widgetPublicSearch).toHaveBeenCalledTimes(1);
  });

  it('never caches a failed lookup, so the next call retries against the api', async () => {
    mockSdk.widgetPublicSearch.mockRejectedValueOnce(new Error('offline'));
    await expect(loadWidgetConfig({ mtxId: 'retry-after-failure', mtxKey: 'test-key' })).rejects.toThrow('offline');

    mockSdk.widgetPublicSearch.mockResolvedValueOnce(searchResult('retry-after-failure'));
    const config = await loadWidgetConfig({ mtxId: 'retry-after-failure', mtxKey: 'test-key' });

    expect(mockSdk.widgetPublicSearch).toHaveBeenCalledTimes(2);
    expect(config).toMatchObject({ mtxApp: 42 });
  });
});
