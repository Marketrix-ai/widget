import type { InstructionType, WidgetSettingsData } from '../sdk';

// Re-export SDK types for proper type usage
export type {
  AgentData,
  ConnectionData,
  InstructionType,
  IntegrationData,
  TenantData,
  UserData,
  WidgetChip,
  WidgetSettingsData,
} from '../sdk';

// Alias for backward compatibility (ChatMode is the same as InstructionType)
export type ChatMode = InstructionType;

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
  position?: WidgetPosition;
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

// Widget position type (derived from SDK schema)
export type WidgetPosition = WidgetSettingsData['widget_position'];

export interface WidgetPositionConfig {
  position?: WidgetPosition;
  offset?: {
    x?: number;
    y?: number;
  };
  z_index?: number;
}

/**
 * WidgetAtmosphereConfig - Widget-specific configuration not in SDK
 *
 * This interface contains only API settings (widget_settings) and essential runtime state.
 * All styling comes from widget_settings (from API).
 */
export interface WidgetAtmosphereConfig {
  // Widget settings from API (or defaults for connectionId/agentId path)
  widget_settings: WidgetSettingsData;

  // Essential runtime state
  session_time: number;
  sessionActive: boolean;
  recorded_time: number;
  recordActive: boolean;
  widget_visible: boolean;
  widget_mode: 'ai' | 'live' | 'hybrid';
  avatar_status: 'online' | 'offline' | 'busy' | 'away';
  streaming_avatar_status: 'idle' | 'typing' | 'speaking' | 'listening';

  // Local-only styling (offset/z_index only, position value comes from widget_settings.widget_position)
  widget_position: WidgetPositionConfig;
}

// Re-export SDK types for convenience
export type { TourData } from '../sdk';
