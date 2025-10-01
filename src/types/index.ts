export interface MarketrixConfig {
  marketrixId: string;
  marketrixKey: string;
  apiBaseUrl?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  theme?: 'light' | 'dark';
  avatarUrl?: string;
  agentName?: string;
  enabledModes?: ('show' | 'tell' | 'do')[];
  
  // Extended atmosphere controls
  session_time?: number;
  sessionActive?: boolean;
  recorded_time?: number;
  recordActive?: boolean;
  widget_text?: WidgetTextConfig;
  widget_type?: 'ai' | 'live' | 'hybrid';
  widget_visible?: boolean;
  widget_customize?: WidgetCustomizeConfig;
  active_avatar?: AvatarConfig;
  avatar_trigger_time?: number;
  enable_widget_popup?: boolean;
  avatar_status?: 'online' | 'offline' | 'busy' | 'away';
  widget_mode?: 'ai' | 'live' | 'hybrid';
  mLive_form?: LiveFormConfig;
  hybrid_agents_on?: boolean;
  hybrid_agents_off?: boolean;
  widget_visible_device?: DeviceVisibilityConfig;
  streaming_avatar_status?: 'idle' | 'typing' | 'speaking' | 'listening';
  widget_position?: WidgetPositionConfig;
  enable_ai_tour?: boolean;
  widget_header_ai?: string;
  widget_body_ai?: string;
  widget_header_live?: string;
  widget_body_live?: string;
  widget_chat_greeting?: string;
  widget_tour_greeting?: string;
  inapp_login_url?: string;
  inapp_login_id?: string;
  inapp_login_password?: string;
  advanced_settings?: AdvancedSettingsConfig;
  themes?: ThemeConfig;
  responsive_breakpoints?: ResponsiveBreakpointsConfig;
}

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: Date;
  mode?: 'show' | 'tell' | 'do';
}

export interface WidgetState {
  isOpen: boolean;
  isMinimized: boolean;
  isLoading: boolean;
  messages: ChatMessage[];
  currentMode: 'show' | 'tell' | 'do';
  agentAvailable: boolean;
  error?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface SendMessageRequest {
  message: string;
  mode: 'show' | 'tell' | 'do';
  marketrixId: string;
  marketrixKey: string;
}

export interface SendMessageResponse {
  messageId: string;
  response: string;
  mode: 'show' | 'tell' | 'do';
  timestamp: Date;
}

export type WidgetPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
export type ChatMode = 'show' | 'tell' | 'do';
export type Theme = 'light' | 'dark';

// Extended configuration interfaces
export interface WidgetTextConfig {
  greeting?: string;
  placeholder?: string;
  header_ai?: string;
  header_live?: string;
  body_ai?: string;
  body_live?: string;
  chat_greeting?: string;
  tour_greeting?: string;
}

export interface WidgetCustomizeConfig {
  colors?: {
    primary?: string;
    secondary?: string;
    background?: string;
    text?: string;
    border?: string;
  };
  sizes?: {
    width?: string;
    height?: string;
    border_radius?: string;
    font_size?: string;
  };
  animations?: {
    slide_duration?: string;
    fade_duration?: string;
    bounce_effect?: boolean;
  };
}

export interface AvatarConfig {
  url?: string;
  name?: string;
  status?: 'online' | 'offline' | 'busy' | 'away';
}

export interface LiveFormConfig {
  enabled?: boolean;
  fields?: string[];
  required?: string[];
}

export interface DeviceVisibilityConfig {
  desktop?: boolean;
  tablet?: boolean;
  mobile?: boolean;
}

export interface WidgetPositionConfig {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  offset?: {
    x?: number;
    y?: number;
  };
  z_index?: number;
}

export interface AdvancedSettingsConfig {
  auto_open_delay?: number;
  session_timeout?: number;
  max_messages?: number;
  typing_indicator?: boolean;
  read_receipts?: boolean;
  sound_notifications?: boolean;
  vibration_enabled?: boolean;
}

export interface ThemeConfig {
  light?: {
    background?: string;
    text?: string;
    border?: string;
    accent?: string;
  };
  dark?: {
    background?: string;
    text?: string;
    border?: string;
    accent?: string;
  };
}

export interface ResponsiveBreakpointsConfig {
  mobile?: string;
  tablet?: string;
  desktop?: string;
}

export interface WidgetChipConfig {
  chip_mode: 'show' | 'tell' | 'do';
  chip_text: string;
}

export interface WidgetSettingsConfig {
  widget_enabled: boolean;
  widget_appearance: 'default' | 'compact' | 'full';
  widget_position: 'bottom-left' | 'bottom-right';
  widget_device: 'desktop' | 'mobile' | 'desktop_mobile';
  widget_header: string;
  widget_body: string;
  widget_greeting: string;
  widget_feature_tell: boolean;
  widget_feature_show: boolean;
  widget_feature_do: boolean;
  widget_feature_request_human: boolean;
  widget_background_color: string;
  widget_text_color: string;
  widget_border_color: string;
  widget_accent_color: string;
  widget_secondary_color: string;
  widget_border_radius: string;
  widget_font_size: string;
  widget_width: string;
  widget_height: string;
  widget_shadow: string;
  widget_animation_duration: string;
  widget_fade_duration: string;
  widget_bounce_effect: boolean;
  widget_z_index: number;
  widget_chips: WidgetChipConfig[];
}

// Widget atmosphere configuration interface
export interface WidgetAtmosphereConfig {
  session_time: number;
  sessionActive: boolean;
  recorded_time: number;
  recordActive: boolean;
  widget_text: WidgetTextConfig;
  widget_settings: WidgetSettingsConfig;
  widget_type: 'ai' | 'live' | 'hybrid';
  widget_visible: boolean;
  widget_customize: WidgetCustomizeConfig;
  active_avatar: AvatarConfig;
  avatar_trigger_time: number;
  enable_widget_popup: boolean;
  avatar_status: 'online' | 'offline' | 'busy' | 'away';
  widget_mode: 'ai' | 'live' | 'hybrid';
  mLive_form: LiveFormConfig;
  hybrid_agents_on: boolean;
  hybrid_agents_off: boolean;
  widget_visible_device: DeviceVisibilityConfig;
  streaming_avatar_status: 'idle' | 'typing' | 'speaking' | 'listening';
  widget_position: WidgetPositionConfig;
  enable_ai_tour: boolean;
  widget_header_ai: string;
  widget_body_ai: string;
  widget_header_live: string;
  widget_body_live: string;
  widget_chat_greeting: string;
  widget_tour_greeting: string;
  inapp_login_url: string;
  inapp_login_id: string;
  inapp_login_password: string;
  advanced_settings: AdvancedSettingsConfig;
  themes: ThemeConfig;
  responsive_breakpoints: ResponsiveBreakpointsConfig;
}
