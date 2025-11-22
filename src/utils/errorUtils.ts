/**
 * Error Handling Utilities
 *
 * Centralized error handling and logging utilities to reduce code duplication
 * and ensure consistent error handling patterns across the widget.
 */

import { createLogger } from './logger';

const log = createLogger('ErrorUtils');

/**
 * Execute a function safely with error handling
 * Returns the result or undefined if an error occurs
 */
export function safeExecute<T>(fn: () => T, errorMessage: string, defaultValue?: T): T | undefined {
  try {
    return fn();
  } catch (error) {
    logError('safeExecute', error, { errorMessage, defaultValue });
    return defaultValue;
  }
}

/**
 * Execute an async function safely with error handling
 * Returns the result or undefined if an error occurs
 */
export async function safeExecuteAsync<T>(
  fn: () => Promise<T>,
  errorMessage: string,
  defaultValue?: T
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    logError('safeExecuteAsync', error, { errorMessage, defaultValue });
    return defaultValue;
  }
}

/**
 * Centralized error logging
 */
export function logError(
  context: string,
  error: unknown,
  additionalInfo?: Record<string, unknown>
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  log.error(`${context}: ${errorMessage}`, {
    ...additionalInfo,
    stack: errorStack,
  });
}

/**
 * Centralized warning logging
 */
export function logWarning(
  context: string,
  message: string,
  additionalInfo?: Record<string, unknown>
): void {
  log.warn(`${context}: ${message}`, additionalInfo || {});
}

/**
 * Extract error message from unknown error type
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Unknown error';
}
