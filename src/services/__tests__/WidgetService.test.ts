import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sdk, WidgetSettingsDataSchema } from '../../sdk';
import { getMockWidgetConfig } from '../../test/fixtures';
import { loadWidgetConfig } from '../WidgetService';

vi.mock('../../sdk', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    sdk: {
      applicationGet: vi.fn(),
      widgetDefaultGet: vi.fn(),
      widgetSearch: vi.fn(),
    },
  };
});

const mockSdk = vi.mocked(sdk);
const settings = WidgetSettingsDataSchema.parse(getMockWidgetConfig());
const activeWidget = {
  id: 7,
  application_id: 42,
  type: 'widget' as const,
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
  mockSdk.applicationGet.mockResolvedValue({ id: 42 } as Awaited<ReturnType<typeof sdk.applicationGet>>);
  mockSdk.widgetDefaultGet.mockResolvedValue(settings);
});

describe('loadWidgetConfig', () => {
  it('loads the widget once and returns one schema-validated config', async () => {
    const config = await loadWidgetConfig({ mtxId: 'test-id', mtxKey: 'test-key', show_widget: false });

    expect(mockSdk.widgetSearch).toHaveBeenCalledOnce();
    expect(mockSdk.applicationGet).toHaveBeenCalledWith({ application_id: 42 });
    expect(mockSdk.widgetDefaultGet).toHaveBeenCalledWith({ type: 'widget' });
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

  it('preserves the inactive-widget diagnostic without loading defaults or the application', async () => {
    mockSdk.widgetSearch.mockResolvedValue({
      items: [
        {
          id: 7,
          application_id: 42,
          type: 'widget',
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
    expect(mockSdk.applicationGet).not.toHaveBeenCalled();
    expect(mockSdk.widgetDefaultGet).not.toHaveBeenCalled();
  });
});
