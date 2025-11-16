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

// Widget state management types
// WidgetState is defined in types/index.ts - import it from there
export type { WidgetState } from './index';
