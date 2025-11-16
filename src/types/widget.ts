/**
 * Widget-specific type definitions
 *
 * This file contains widget-specific types that extend or complement
 * the SDK types. All core types should be imported from the SDK.
 */

// Re-export all SDK types for convenience
export type {
  AgentData,
  ConnectionData,
  IntegrationData,
  TenantData,
  TourData,
  UserData,
  WidgetSettingsData,
} from '../sdk';

// Import types from index for local use
import type { ChatMode, MarketrixConfig, WidgetSettingsData } from './index';

// Widget-specific type extensions
export interface WidgetChipConfig {
  chip_mode: 'show' | 'tell' | 'do';
  chip_text: string;
}

export interface WidgetComponentProps {
  config: MarketrixConfig;
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
// WidgetState is defined in types/index.ts - import it from there
export type { WidgetState } from './index';

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
  onMessage?: (message: string, mode: ChatMode) => void;
  onModeChange?: (mode: ChatMode) => void;
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
