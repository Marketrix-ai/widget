/**
 * `loadWidgetConfig` tests: one load is one search and returns one schema-validated config, never a defaults
 * read; an invalid settings response is rejected naming the schema field, and the inactive-widget diagnostic is
 * preserved.
 */
import { beforeEach, describe, expect, it, vi } from 'bun:test';

import { sdk } from '../../sdk';
import { validSettings } from '../../test/fixtures';
import { mocked, restoreModuleAfterAll } from '../../test/vi-compat';
import { loadWidgetConfig } from '../WidgetService';

vi.mock('../../sdk', () => ({
  sdk: {
    widgetPublicSearch: vi.fn(),
  },
}));
restoreModuleAfterAll('../../sdk', () => import('../../sdk/index.ts?real'));

const mockSdk = mocked(sdk);
const settings = validSettings();
const activeWidget = {
  id: 7,
  application_id: 42,
  settings,
  status: 'active' as const,
  marketrix_id: 'test-id',
  marketrix_key: 'test-key',
  created_at: new Date(),
  updated_at: new Date(),
};
const searchResult = {
  items: [activeWidget],
  total: 1,
  limit: 20,
  offset: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSdk.widgetPublicSearch.mockResolvedValue(searchResult);
});

describe('loadWidgetConfig', () => {
  it('loads the widget in one search and returns one schema-validated config', async () => {
    const config = await loadWidgetConfig({ mtxId: 'test-id', mtxKey: 'test-key', show_widget: false });

    expect(mockSdk.widgetPublicSearch).toHaveBeenCalledTimes(1);
    expect(config).toMatchObject({ mtxId: 'test-id', mtxKey: 'test-key', mtxApp: 42, show_widget: false });
  });

  it('rejects an invalid merged settings response with the schema field', async () => {
    mockSdk.widgetPublicSearch.mockResolvedValue({
      ...searchResult,
      items: [
        { ...activeWidget, settings: { ...settings, widget_position: 'somewhere' } as unknown as typeof settings },
      ],
    });

    await expect(loadWidgetConfig({ mtxId: 'test-id', mtxKey: 'test-key' })).rejects.toThrow(/widget_position/);
    expect(mockSdk.widgetPublicSearch).toHaveBeenCalledTimes(1);
  });

  it('reports a failed search', async () => {
    mockSdk.widgetPublicSearch.mockRejectedValue(new Error('bad credentials'));

    await expect(loadWidgetConfig({ mtxId: 'test-id', mtxKey: 'test-key' })).rejects.toThrow(/bad credentials/);
  });

  it('preserves the inactive-widget diagnostic without reading the application', async () => {
    mockSdk.widgetPublicSearch.mockResolvedValue({
      items: [{ application_id: 42, settings, status: 'suspended' }],
      total: 1,
      limit: 20,
      offset: 0,
    });

    await expect(loadWidgetConfig({ mtxId: 'test-id', mtxKey: 'test-key' })).rejects.toThrow(
      'Found widget(s) but none are active',
    );
  });
});
