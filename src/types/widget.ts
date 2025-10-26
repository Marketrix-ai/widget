/**
 * Widget-specific type definitions
 * 
 * This file contains widget-specific types that extend or complement
 * the SDK types. All core types should be imported from the SDK.
 */

// Re-export all SDK types for convenience
export type {
  IntegrationData,
  WidgetSettingsData,
  TourData,
  TourStep,
  TourAnswer,
  ConnectionData,
  AgentData,
  UserData,
  TenantData,
} from '../sdk';

// Widget-specific type extensions
export interface WidgetChipConfig {
  chip_mode: 'show' | 'tell' | 'do';
  chip_text: string;
}

export interface WidgetComponentProps {
  config: import('./index').MarketrixConfig;
  settings?: WidgetSettingsData;
  isOpen?: boolean;
  isLoading?: boolean;
  error?: string;
}

export interface WidgetHookReturn<T = unknown> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch?: () => Promise<void>;
}

// Widget state management types
export interface WidgetState {
  isOpen: boolean;
  isMinimized: boolean;
  isLoading: boolean;
  messages: import('./index').ChatMessage[];
  currentMode: import('./index').ChatMode;
  agentAvailable: boolean;
  error?: string;
}

// Widget configuration validation types
export interface WidgetConfigValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Widget event types
export interface WidgetEvents {
  onOpen?: () => void;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onMessage?: (message: string, mode: import('./index').ChatMode) => void;
  onModeChange?: (mode: import('./index').ChatMode) => void;
  onError?: (error: string) => void;
}

// Widget theme types
export interface WidgetTheme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    border: string;
    accent: string;
  };
  sizes: {
    width: string;
    height: string;
    borderRadius: string;
    fontSize: string;
  };
  animations: {
    slideDuration: string;
    fadeDuration: string;
    bounceEffect: boolean;
  };
}

// Widget device detection types
export interface DeviceInfo {
  type: 'desktop' | 'tablet' | 'mobile';
  width: number;
  height: number;
  userAgent: string;
}

// Widget analytics types
export interface WidgetAnalytics {
  sessionId: string;
  userId?: string;
  events: WidgetEvent[];
  startTime: Date;
  endTime?: Date;
}

export interface WidgetEvent {
  type: 'open' | 'close' | 'message' | 'mode_change' | 'error';
  timestamp: Date;
  data?: Record<string, unknown>;
}
