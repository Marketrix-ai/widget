/**
 * Widget constants and default values
 *
 * This file contains all default values, enums, and magic strings
 * used throughout the widget. This is the single source of truth
 * for all widget configuration defaults.
 */

import type { WidgetSettingsData } from '../sdk';
import type { LiveFormConfig, WidgetAtmosphereConfig } from '../types';

// Widget mode types
export const WIDGET_MODES = ['ai', 'live', 'hybrid'] as const;
export type WidgetMode = (typeof WIDGET_MODES)[number];

// Widget position types
export const WIDGET_POSITIONS = ['bottom_left', 'bottom_right'] as const;
export type WidgetPosition = (typeof WIDGET_POSITIONS)[number];

// Widget appearance types
export const WIDGET_APPEARANCES = ['default', 'compact', 'full'] as const;
export type WidgetAppearance = (typeof WIDGET_APPEARANCES)[number];

// Widget device types
export const WIDGET_DEVICES = ['desktop', 'mobile', 'desktop_mobile'] as const;
export type WidgetDevice = (typeof WIDGET_DEVICES)[number];

// Avatar status types
export const AVATAR_STATUSES = ['online', 'offline', 'busy', 'away'] as const;
export type AvatarStatus = (typeof AVATAR_STATUSES)[number];

// Streaming avatar status types
export const STREAMING_AVATAR_STATUSES = ['idle', 'typing', 'speaking', 'listening'] as const;
export type StreamingAvatarStatus = (typeof STREAMING_AVATAR_STATUSES)[number];

// Chat mode type (matches SDK InstructionType)
export type ChatMode = 'show' | 'tell' | 'do';
export const CHAT_MODES = ['show', 'tell', 'do'] as const;

// Default widget settings
export const DEFAULT_WIDGET_SETTINGS: WidgetSettingsData = {
  widget_enabled: true,
  widget_appearance: 'default',
  widget_position: 'bottom_right',
  widget_device: 'desktop_mobile',
  widget_header: '🤖 AI Assistant',
  widget_body: "I'm here to help you with any questions or tasks.",
  widget_greeting: "🎉 Welcome! I'm your AI assistant!",
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
};

// Default widget text configuration
export const DEFAULT_WIDGET_TEXT = {
  greeting: 'Hello! How can I help you today?',
  placeholder: 'Show me...',
  header_ai: 'AI Assistant',
  header_live: 'Live Agent',
  body_ai: "I'm here to help you with any questions or tasks.",
  body_live: 'A live agent will be with you shortly.',
  chat_greeting: 'Welcome to our chat! How can I assist you?',
  tour_greeting: 'Welcome! Let me show you around.',
} as const;

// Default widget customization
export const DEFAULT_WIDGET_CUSTOMIZE = {
  colors: {
    primary: '#1BB55B',
    secondary: '#987ADD',
    background: 'linear-gradient(135deg, #1BB55B26 0%, #987ADD30 100%)',
    text: '#333333',
    border: 'rgba(255, 255, 255, 0.2)',
  },
  sizes: {
    width: '320px',
    height: '35rem',
    border_radius: '12px',
    font_size: '14px',
  },
  animations: {
    slide_duration: '300ms',
    fade_duration: '200ms',
    bounce_effect: true,
  },
} as const;

// Default avatar configuration
export const DEFAULT_AVATAR = {
  url: 'https://example.com/avatar.png',
  name: 'Marketrix Assistant',
  status: 'online' as const,
} as const;

// Default widget position configuration
export const DEFAULT_WIDGET_POSITION = {
  position: 'bottom_right' as const,
  offset: { x: 20, y: 20 },
  z_index: 40,
} as const;

// Default device visibility
export const DEFAULT_DEVICE_VISIBILITY = {
  desktop: true,
  tablet: true,
  mobile: true,
} as const;

// Default live form configuration
export const DEFAULT_LIVE_FORM: LiveFormConfig = {
  enabled: true,
  fields: ['name', 'email', 'message'],
  required: ['name', 'email'],
};

// Default advanced settings
export const DEFAULT_ADVANCED_SETTINGS = {
  auto_open_delay: 0,
  session_timeout: 1800000, // 30 minutes
  max_messages: 100,
  typing_indicator: true,
  read_receipts: true,
  sound_notifications: true,
  vibration_enabled: true,
} as const;

// Default themes
export const DEFAULT_THEMES = {
  light: {
    background: '#ffffff',
    text: '#333333',
    border: '#e5e7eb',
    accent: '#1BB55B',
  },
  dark: {
    background: '#1f2937',
    text: '#f9fafb',
    border: '#374151',
    accent: '#10b981',
  },
} as const;

// Default responsive breakpoints
export const DEFAULT_RESPONSIVE_BREAKPOINTS = {
  mobile: '768px',
  tablet: '1024px',
  desktop: '1200px',
} as const;

// Default widget atmosphere configuration
export const DEFAULT_WIDGET_ATMOSPHERE: WidgetAtmosphereConfig = {
  session_time: 0,
  sessionActive: true,
  recorded_time: 0,
  recordActive: false,
  widget_text: DEFAULT_WIDGET_TEXT,
  widget_settings: DEFAULT_WIDGET_SETTINGS,
  widget_type: 'hybrid',
  widget_visible: true,
  widget_customize: DEFAULT_WIDGET_CUSTOMIZE,
  active_avatar: DEFAULT_AVATAR,
  avatar_trigger_time: 5000,
  enable_widget_popup: true,
  avatar_status: 'online',
  widget_mode: 'ai',
  mLive_form: DEFAULT_LIVE_FORM,
  hybrid_agents_on: true,
  hybrid_agents_off: false,
  widget_visible_device: DEFAULT_DEVICE_VISIBILITY,
  streaming_avatar_status: 'idle',
  widget_position: DEFAULT_WIDGET_POSITION,
  enable_ai_tour: true,
  widget_header_ai: 'AI Assistant',
  widget_body_ai: "I'm here to help you with any questions or tasks.",
  widget_header_live: 'Live Agent',
  widget_body_live: 'A live agent will be with you shortly.',
  widget_chat_greeting: 'Welcome to our chat! How can I assist you?',
  widget_tour_greeting: 'Welcome! Let me show you around.',
  inapp_login_url: 'https://app.marketrix.com/login',
  inapp_login_id: 'user123',
  inapp_login_password: 'encrypted_password_hash',
  advanced_settings: DEFAULT_ADVANCED_SETTINGS,
  themes: DEFAULT_THEMES,
  responsive_breakpoints: DEFAULT_RESPONSIVE_BREAKPOINTS,
};

// Color constants
export const COLORS = {
  PRIMARY: '#1BB55B',
  SECONDARY: '#987ADD',
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
  INFO: '#3b82f6',
  WHITE: '#ffffff',
  BLACK: '#000000',
  GRAY_50: '#f9fafb',
  GRAY_100: '#f3f4f6',
  GRAY_200: '#e5e7eb',
  GRAY_300: '#d1d5db',
  GRAY_400: '#9ca3af',
  GRAY_500: '#6b7280',
  GRAY_600: '#4b5563',
  GRAY_700: '#374151',
  GRAY_800: '#1f2937',
  GRAY_900: '#111827',
} as const;

// Animation constants
export const ANIMATIONS = {
  SLIDE_DURATION: '300ms',
  FADE_DURATION: '200ms',
  BOUNCE_EFFECT: true,
  EASING: 'ease-in-out',
} as const;

// Size constants
export const SIZES = {
  WIDGET_WIDTH: '360px',
  WIDGET_HEIGHT: '35rem',
  BORDER_RADIUS: '12px',
  FONT_SIZE: '14px',
  Z_INDEX: 40,
} as const;

// Time constants
export const TIMES = {
  AVATAR_TRIGGER_DELAY: 5000,
  SESSION_TIMEOUT: 1800000, // 30 minutes
  AUTO_OPEN_DELAY: 0,
  TYPING_INDICATOR_DELAY: 1000,
} as const;
