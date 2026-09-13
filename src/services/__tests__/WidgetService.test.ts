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
    widgetSearch: vi.fn(),
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
  page: 1,
  limit: 20,
  total_pages: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSdk.widgetSearch.mockResolvedValue(searchResult);
});

describe('loadWidgetConfig', () => {
  it('loads the widget in one search and returns one schema-validated config', async () => {
    const config = await loadWidgetConfig({ mtxId: 'test-id', mtxKey: 'test-key', show_widget: false });

    expect(mockSdk.widgetSearch).toHaveBeenCalledOnce();
    expect(config).toMatchObject({ mtxId: 'test-id', mtxKey: 'test-key', mtxApp: 42, show_widget: false });
  });

  it('rejects an invalid merged settings response with the schema field', async () => {
    mockSdk.widgetSearch.mockResolvedValue({
      ...searchResult,
      items: [{ ...activeWidget, settings: { ...settings, widget_position: 'somewhere' } as typeof settings }],
    });

    await expect(loadWidgetConfig({ mtxId: 'test-id', mtxKey: 'test-key' })).rejects.toThrow(/widget_position/);
    expect(mockSdk.widgetSearch).toHaveBeenCalledOnce();
  });

  it('reports a failed search', async () => {
    mockSdk.widgetSearch.mockRejectedValue(new Error('bad credentials'));

    await expect(loadWidgetConfig({ mtxId: 'test-id', mtxKey: 'test-key' })).rejects.toThrow(/bad credentials/);
  });

  it('preserves the inactive-widget diagnostic without reading the application', async () => {
    mockSdk.widgetSearch.mockResolvedValue({
      items: [
        {
          id: 7,
          application_id: 42,
          settings,
          status: 'inactive',
          marketrix_id: 'test-id',
          marketrix_key: 'test-key',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      total_pages: 1,
    });

    await expect(loadWidgetConfig({ mtxId: 'test-id', mtxKey: 'test-key' })).rejects.toThrow(
      'Found widget(s) but none are active',
    );
  });
});
