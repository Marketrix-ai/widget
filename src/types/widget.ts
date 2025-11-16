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
  WidgetChip,
  WidgetSettingsData,
} from '../sdk';

// Import types from index for local use
import type { ChatMode, MarketrixConfig, WidgetSettingsData } from './index';

// WidgetChip is now exported from SDK, no need for WidgetChipConfig

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
