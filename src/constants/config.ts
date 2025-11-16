import type { WidgetSettingsData } from '../sdk';
import type { MarketrixConfig } from '../types';

export const VITE_API_URL = import.meta.env.VITE_API_URL || '';

const NON_WIDGET_SETTINGS_KEYS = [
  'marketrixId',
  'marketrixKey',
  'agentId',
  'connectionId',
  'apiBaseUrl',
  'widget_position_offset',
  'widget_position_z_index',
] as const;

function extractWidgetSettingsFields(
  config: Partial<MarketrixConfig>
): Partial<WidgetSettingsData> {
  const result = { ...config } as Partial<WidgetSettingsData>;
  for (const key of NON_WIDGET_SETTINGS_KEYS) {
    delete (result as Record<string, unknown>)[key];
  }
  return result;
}

export const DEFAULT_MARKETRIX_CONFIG: MarketrixConfig = {
  widget_enabled: true,
  widget_appearance: 'default',
  widget_position: 'bottom_right',
  widget_device: 'desktop_mobile',
  widget_header: '🤖 AI Assistant',
  widget_body: 'How can I help you today?',
  widget_greeting: '🎉 Hi there!',
  widget_feature_tell: true,
  widget_feature_show: true,
  widget_feature_do: true,
  widget_feature_human: true,
  widget_background_color: 'linear-gradient(135deg, #1BB55B45 0%, #987ADD45 100%)',
  widget_text_color: '#333333',
  widget_border_color: 'rgba(255, 255, 255, 0.3)',
  widget_accent_color: '#1BB55B',
  widget_secondary_color: '#987ADD',
  widget_border_radius: '12px',
  widget_font_size: '14px',
  widget_width: '360px',
  widget_height: '35rem',
  widget_shadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
  widget_animation_duration: '300ms',
  widget_fade_duration: '200ms',
  widget_bounce_effect: true,
  widget_chips: [
    {
      chip_mode: 'tell',
      chip_text: 'Tell me about your services',
    },
    {
      chip_mode: 'show',
      chip_text: 'Show me pricing',
    },
    {
      chip_mode: 'do',
      chip_text: 'Schedule a demo',
    },
  ],
  widget_position_offset: { x: 20, y: 20 },
  widget_position_z_index: 40,
};

export const DEFAULT_WIDGET_SETTINGS: WidgetSettingsData = extractWidgetSettingsFields(
  DEFAULT_MARKETRIX_CONFIG
) as WidgetSettingsData;

export function extractWidgetSettingsFromConfig(
  config: Partial<MarketrixConfig>
): WidgetSettingsData {
  return {
    ...DEFAULT_WIDGET_SETTINGS,
    ...extractWidgetSettingsFields(config),
  };
}
