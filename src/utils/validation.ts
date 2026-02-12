/**
 * Type Guard Utilities
 *
 * Generic type guard functions for data validation and type checking.
 * These are shared utilities used across the codebase.
 */

// ============================================================================
// Generic Type Guards
// ============================================================================

/**
 * Check if an object has a specific property
 */
export function hasProperty<K extends string>(obj: unknown, key: K): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj;
}

/**
 * Check if a value is a non-null object
 */
export function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Check if a value is an array
 */
export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * Check if a value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Check if a value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * Check if a value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Type guard for WidgetPosition
 */
export function isWidgetPosition(value: unknown): value is 'bottom_left' | 'bottom_right' | 'top_left' | 'top_right' {
  return (
    typeof value === 'string' &&
    (value === 'bottom_left' || value === 'bottom_right' || value === 'top_left' || value === 'top_right')
  );
}

/**
 * Type guard for WidgetMode
 */
export function isWidgetMode(value: unknown): value is 'ai' | 'live' | 'hybrid' {
  return typeof value === 'string' && (value === 'ai' || value === 'live' || value === 'hybrid');
}

/**
 * Check if a value is a plain object (not null, not array)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ============================================================================
// API Response Type Guards
// ============================================================================

import type {
  AgentData,
  ChatResponseData,
  ConnectionData,
  IntegrationData,
  TourData,
  TourStepData,
  WidgetSettingsData,
} from '../sdk';

/**
 * Type guard for ConnectionData
 */
export function isConnectionData(data: unknown): data is ConnectionData {
  if (!isNonNullObject(data)) {
    return false;
  }

  return (
    hasProperty(data, 'tenant_id') &&
    typeof data.tenant_id === 'number' &&
    hasProperty(data, 'name') &&
    typeof data.name === 'string' &&
    hasProperty(data, 'type') &&
    (data.type === 'app' || data.type === 'website')
  );
}

/**
 * Type guard for IntegrationData
 */
export function isIntegrationData(data: unknown): data is IntegrationData {
  if (!isNonNullObject(data)) {
    return false;
  }

  return (
    hasProperty(data, 'connection_id') &&
    typeof data.connection_id === 'number' &&
    hasProperty(data, 'agent_id') &&
    typeof data.agent_id === 'number' &&
    hasProperty(data, 'type') &&
    (data.type === 'widget' || data.type === 'slack') &&
    hasProperty(data, 'status') &&
    typeof data.status === 'string' &&
    hasProperty(data, 'marketrix_id') &&
    typeof data.marketrix_id === 'string' &&
    hasProperty(data, 'marketrix_key') &&
    typeof data.marketrix_key === 'string'
  );
}

/**
 * Type guard for AgentData
 */
export function isAgentData(data: unknown): data is AgentData {
  if (!isNonNullObject(data)) {
    return false;
  }

  return (
    hasProperty(data, 'tenant_id') &&
    typeof data.tenant_id === 'number' &&
    hasProperty(data, 'user_id') &&
    typeof data.user_id === 'number' &&
    hasProperty(data, 'connection_id') &&
    typeof data.connection_id === 'number' &&
    hasProperty(data, 'agent_name') &&
    typeof data.agent_name === 'string' &&
    hasProperty(data, 'agent_type') &&
    (data.agent_type === 'human' || data.agent_type === 'ai') &&
    hasProperty(data, 'agent_voice') &&
    (data.agent_voice === 'male' || data.agent_voice === 'female') &&
    hasProperty(data, 'agent_description') &&
    typeof data.agent_description === 'string' &&
    hasProperty(data, 'status') &&
    (data.status === 'active' || data.status === 'learning' || data.status === 'error')
  );
}

/**
 * Type guard for WidgetSettingsData
 */
export function isWidgetSettingsData(data: unknown): data is WidgetSettingsData {
  if (!isNonNullObject(data)) {
    return false;
  }

  return (
    hasProperty(data, 'widget_enabled') &&
    typeof data.widget_enabled === 'boolean' &&
    hasProperty(data, 'widget_appearance') &&
    typeof data.widget_appearance === 'string' &&
    hasProperty(data, 'widget_position') &&
    typeof data.widget_position === 'string'
  );
}

/**
 * Type guard for TourStepData
 */
export function isTourStepData(data: unknown): data is TourStepData {
  if (!isNonNullObject(data)) {
    return false;
  }

  return (
    hasProperty(data, 'step_number') &&
    typeof data.step_number === 'number' &&
    hasProperty(data, 'action') &&
    typeof data.action === 'string' &&
    hasProperty(data, 'element') &&
    typeof data.element === 'string' &&
    hasProperty(data, 'text') &&
    typeof data.text === 'string'
  );
}

/**
 * Type guard for array of IntegrationData
 */
export function isIntegrationDataArray(data: unknown): data is IntegrationData[] {
  return Array.isArray(data) && data.every(item => isIntegrationData(item));
}

/**
 * Type guard for array of TourStepData
 */
export function isTourStepDataArray(data: unknown): data is TourStepData[] {
  return Array.isArray(data) && data.every(item => isTourStepData(item));
}

/**
 * Type guard for ChatResponseData
 */
export function isChatResponseData(data: unknown): data is ChatResponseData {
  if (!isNonNullObject(data)) {
    return false;
  }

  return hasProperty(data, 'text') && (data.text == null || typeof data.text === 'string');
}

/**
 * Type guard for TourData
 */
export function isTourData(data: unknown): data is TourData {
  if (!isNonNullObject(data)) {
    return false;
  }

  return (
    hasProperty(data, 'connection_id') &&
    typeof data.connection_id === 'number' &&
    hasProperty(data, 'question') &&
    typeof data.question === 'string' &&
    hasProperty(data, 'answer') &&
    Array.isArray(data.answer)
  );
}

/**
 * Type guard for array of TourData
 */
export function isTourDataArray(data: unknown): data is TourData[] {
  return Array.isArray(data) && data.every(item => isTourData(item));
}

/**
 * Type guard for tour answer with steps property
 */
export function isTourAnswerWithSteps(answer: unknown): answer is { steps: unknown } {
  return isObject(answer) && 'steps' in answer;
}

/**
 * Type guard for error response body
 */
export interface ErrorResponseBody {
  error?: string;
  message?: string;
}

export function isErrorResponseBody(body: unknown): body is ErrorResponseBody {
  if (!isNonNullObject(body)) {
    return false;
  }

  return (
    (!hasProperty(body, 'error') || typeof body.error === 'string') &&
    (!hasProperty(body, 'message') || typeof body.message === 'string')
  );
}

// ============================================================================
// DOM Element Type Guards
// ============================================================================

/**
 * Type guard for HTMLElement
 */
export function isHTMLElement(element: Element | null): element is HTMLElement {
  return element !== null && element instanceof HTMLElement;
}

/**
 * Type guard for HTMLInputElement
 */
export function isHTMLInputElement(element: Element | EventTarget | null): element is HTMLInputElement {
  return element !== null && element instanceof HTMLInputElement;
}

/**
 * Type guard for HTMLTextAreaElement
 */
export function isHTMLTextAreaElement(element: Element | EventTarget | null): element is HTMLTextAreaElement {
  return element !== null && element instanceof HTMLTextAreaElement;
}

/**
 * Type guard for HTMLButtonElement
 */
export function isHTMLButtonElement(element: Element | null): element is HTMLButtonElement {
  return element !== null && element instanceof HTMLButtonElement;
}

/**
 * Type guard for HTMLSelectElement
 */
export function isHTMLSelectElement(element: Element | null): element is HTMLSelectElement {
  return element !== null && element instanceof HTMLSelectElement;
}

/**
 * Type guard for HTMLScriptElement
 */
export function isHTMLScriptElement(element: Element | null): element is HTMLScriptElement {
  return element !== null && element instanceof HTMLScriptElement;
}

/**
 * Type guard for EventTarget as HTMLElement
 */
export function isHTMLElementEventTarget(target: EventTarget | null): target is HTMLElement {
  return target !== null && target instanceof HTMLElement;
}

/**
 * Check if code is running in a browser environment
 */
export function isBrowser(): boolean {
  return true;
}
