/**
 * Default Widget Settings
 *
 * Default widget settings to be used when marketrix_id and marketrix_key
 * are not available but connection_id and agent_id are valid
 */

import type { WidgetSettingsData } from '../sdk';

export const DEFAULT_FALLBACK_WIDGET_SETTINGS: WidgetSettingsData = {
  widget_enabled: true,
  widget_appearance: 'default',
  widget_position: 'bottom_left',
  widget_device: 'desktop_mobile',
  widget_header: 'AI Assistant',
  widget_body: 'How can I help you today?',
  widget_greeting: 'Hello! How can I assist you?',
  widget_feature_tell: true,
  widget_feature_show: true,
  widget_feature_do: true,
  widget_feature_human: false,
  widget_background_color: 'linear-gradient(135deg, #1BB55B55 0%, #987ADD65 100%)',
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
  widget_chips: [],
};

