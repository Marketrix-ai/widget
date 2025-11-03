// Chat mode type (matches SDK InstructionType)
export type ChatMode = 'show' | 'tell' | 'do';

// Re-export SDK types for proper type usage
export type {
  IntegrationData,
  AgentData,
  ConnectionData,
  UserData,
  TenantData,
  WidgetSettingsData,
} from '../sdk';

/**
 * MarketrixConfig - Based on actual SDK types
 *
 * This interface represents the minimal configuration needed to initialize
 * the widget, using actual SDK entity types where possible.
 */
export interface MarketrixConfig {
  // Core SDK fields (from IntegrationEntitySchema)
  // Either marketrixId/marketrixKey OR agentId/connectionId must be provided
  marketrixId?: string; // maps to marketrix_id from SDK
  marketrixKey?: string; // maps to marketrix_key from SDK
  
  // Alternative: Direct agent and connection IDs (when marketrixId/marketrixKey not available)
  agentId?: number; // Direct agent ID from agent table
  connectionId?: number; // Direct connection ID from connection table

  // Optional API configuration
  apiBaseUrl?: string;

  // Widget-specific configuration (not in SDK, but needed for widget functionality)
  position?: 'bottom_left' | 'bottom_right';
  theme?: 'light' | 'dark';
  enabledModes?: ChatMode[];

  // Atmosphere configuration for widget-specific features not in SDK
  atmosphere?: WidgetAtmosphereConfig;
}

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: Date;
  mode?: ChatMode;
}

export interface WidgetState {
  isOpen: boolean;
  isMinimized: boolean;
  isLoading: boolean;
  messages: ChatMessage[];
  currentMode: ChatMode;
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
  message?: string;
  mode?: ChatMode;
  marketrixId?: string;
  marketrixKey?: string;
  connection_id?: number;
  question?: string;
}

export interface SendMessageResponse {
  messageId: string;
  response: string;
  mode: ChatMode;
  timestamp: Date;
}

export type Theme = 'light' | 'dark';

// Widget position type (derived from SDK schema)
export type WidgetPosition = 'bottom_left' | 'bottom_right';

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
  position?: 'bottom_left' | 'bottom_right';
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

// WidgetChipConfig moved to types/widget.ts

// WidgetSettingsConfig is now replaced by WidgetSettingsData from SDK
// All widget-specific types are now in types/widget.ts

/**
 * WidgetAtmosphereConfig - Widget-specific configuration not in SDK
 *
 * This interface contains all the widget-specific configuration that is not
 * provided by the SDK but is needed for widget functionality.
 */
export interface WidgetAtmosphereConfig {
  // Session and recording controls
  session_time: number;
  sessionActive: boolean;
  recorded_time: number;
  recordActive: boolean;

  // Widget display and behavior
  widget_text: WidgetTextConfig;
  widget_settings: import('../sdk').WidgetSettingsData; // From SDK
  widget_type: 'ai' | 'live' | 'hybrid';
  widget_visible: boolean;
  widget_customize: WidgetCustomizeConfig;
  widget_mode: 'ai' | 'live' | 'hybrid';
  widget_position: WidgetPositionConfig;
  widget_visible_device: DeviceVisibilityConfig;

  // Avatar configuration
  active_avatar: AvatarConfig;
  avatar_trigger_time: number;
  avatar_status: 'online' | 'offline' | 'busy' | 'away';
  streaming_avatar_status: 'idle' | 'typing' | 'speaking' | 'listening';

  // Widget interactions
  enable_widget_popup: boolean;
  enable_ai_tour: boolean;

  // Live form configuration
  mLive_form: LiveFormConfig;

  // Hybrid agent controls
  hybrid_agents_on: boolean;
  hybrid_agents_off: boolean;

  // Widget text content
  widget_header_ai: string;
  widget_body_ai: string;
  widget_header_live: string;
  widget_body_live: string;
  widget_chat_greeting: string;
  widget_tour_greeting: string;

  // Authentication (for backward compatibility)
  inapp_login_url: string;
  inapp_login_id: string;
  inapp_login_password: string;

  // Advanced configuration
  advanced_settings: AdvancedSettingsConfig;
  themes: ThemeConfig;
  responsive_breakpoints: ResponsiveBreakpointsConfig;
}

// Re-export SDK types for convenience
export type { TourData } from '../sdk';
