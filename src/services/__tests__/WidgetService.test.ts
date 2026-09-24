/**
 * `loadWidgetConfig` tests: one load is one search and returns one schema-validated config, never a defaults
 * read; an invalid settings response is rejected naming the schema field; a repeat call for the same
 * credentials reuses the cached lookup instead of re-searching, and a failed lookup is never cached so the
 * next call retries against the api. Each case uses its own `mtxId` so the module-level `widgetLookupCache`
 * from one test cannot leak a cached result into another. An unreachable-api error names the configured
 * host.
 */
import { beforeEach, describe, expect, it, vi } from 'bun:test';

import { type ApplicationWidgetPublicData, sdk } from '../../sdk';
import { validSettings } from '../../test/fixtures';
import { mocked, mockSdkModule, restoreModuleAfterAll } from '../../test/vi-compat';
import { loadWidgetConfig } from '../WidgetService';

vi.mock('../../sdk', () => mockSdkModule({ widgetPublicSearch: vi.fn() }));
restoreModuleAfterAll('../../sdk', () => import('../../sdk/index.ts?real'));

const mockSdk = mocked(sdk);
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
    mockSdk.widgetPublicSearch.mockRejectedValue(new Error('Failed to fetch'));

    await expect(
      loadWidgetConfig({ mtxId: 'unreachable-with-host', mtxKey: 'test-key', mtxApiHost: 'https://api.test' }),
    ).rejects.toThrow('Please ensure the API server is running at https://api.test');
  });

  it('loads the widget in one search and returns one schema-validated config', async () => {
    mockSdk.widgetPublicSearch.mockResolvedValue(searchResult());

    const config = await loadWidgetConfig({
      mtxId: 'load-once',
      mtxKey: 'test-key',
      mtxApiHost: 'https://api.test',
      show_widget: false,
    });

    expect(mockSdk.widgetPublicSearch).toHaveBeenCalledTimes(1);
    expect(config).toMatchObject({ mtxId: 'load-once', mtxKey: 'test-key', show_widget: false });
  });

  it('sends only the credential pair to the boot call, never viewport or other host page data', async () => {
    mockSdk.widgetPublicSearch.mockResolvedValue(searchResult());

    await loadWidgetConfig({ mtxId: 'creds-only', mtxKey: 'test-key', mtxApiHost: 'https://api.test' });

    expect(mockSdk.widgetPublicSearch).toHaveBeenCalledWith({
      marketrix_id: 'creds-only',
      marketrix_key: 'test-key',
    });
  });

  it('rejects an invalid merged settings response with the schema field', async () => {
    mockSdk.widgetPublicSearch.mockResolvedValue({
      items: [
        {
          ...activeWidget(),
          widget_settings: { ...settings, widget_position: 'somewhere' } as unknown as typeof settings,
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });

    await expect(
      loadWidgetConfig({ mtxId: 'invalid-settings', mtxKey: 'test-key', mtxApiHost: 'https://api.test' }),
    ).rejects.toThrow(/widget_position/);
    expect(mockSdk.widgetPublicSearch).toHaveBeenCalledTimes(1);
  });

  it('reports a failed search', async () => {
    mockSdk.widgetPublicSearch.mockRejectedValue(new Error('bad credentials'));

    await expect(
      loadWidgetConfig({ mtxId: 'failed-search', mtxKey: 'test-key', mtxApiHost: 'https://api.test' }),
    ).rejects.toThrow(/bad credentials/);
  });

  it('caches the credentialed lookup so a repeat call for the same mtx-id never re-searches', async () => {
    mockSdk.widgetPublicSearch.mockResolvedValue(searchResult());

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

    expect(mockSdk.widgetPublicSearch).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({ show_widget: true });
    expect(second).toMatchObject({ show_widget: false });
  });

  it('shares one in-flight lookup between concurrent callers for the same mtx-id', async () => {
    let resolveSearch!: (value: ReturnType<typeof searchResult>) => void;
    mockSdk.widgetPublicSearch.mockReturnValue(
      new Promise(resolve => {
        resolveSearch = resolve;
      }),
    );

    const first = loadWidgetConfig({ mtxId: 'concurrent', mtxKey: 'test-key', mtxApiHost: 'https://api.test' });
    const second = loadWidgetConfig({ mtxId: 'concurrent', mtxKey: 'test-key', mtxApiHost: 'https://api.test' });
    resolveSearch(searchResult());

    await Promise.all([first, second]);
    expect(mockSdk.widgetPublicSearch).toHaveBeenCalledTimes(1);
  });

  it('never caches a failed lookup, so the next call retries against the api', async () => {
    mockSdk.widgetPublicSearch.mockRejectedValueOnce(new Error('offline'));
    await expect(
      loadWidgetConfig({ mtxId: 'retry-after-failure', mtxKey: 'test-key', mtxApiHost: 'https://api.test' }),
    ).rejects.toThrow('offline');

    mockSdk.widgetPublicSearch.mockResolvedValueOnce(searchResult());
    const config = await loadWidgetConfig({
      mtxId: 'retry-after-failure',
      mtxKey: 'test-key',
      mtxApiHost: 'https://api.test',
    });

    expect(mockSdk.widgetPublicSearch).toHaveBeenCalledTimes(2);
    expect(config).toMatchObject({ mtxId: 'retry-after-failure', isPreviewMode: false });
  });
});
