/**
 * Error Handling Utilities
 *
 * Consolidates common error handling patterns to follow DRY principle.
 * Eliminates repetition of connection error detection and error message extraction.
 */

import { VITE_API_URL } from '../config';

/**
 * Check if error is a connection/network error
 * Consolidates the repeated pattern across widgetValidationService and other services
 */
export function isConnectionError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return (
    errorMessage.includes('Failed to fetch') ||
    errorMessage.includes('ERR_CONNECTION_REFUSED') ||
    errorMessage.includes('NetworkError') ||
    errorMessage.includes('Network request failed')
  );
}

/**
 * Extract error message from unknown error type
 * Consolidates error instanceof Error ? error.message : String(error)
 */
export function extractErrorMessage(error: unknown, fallback = 'Unknown error'): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return fallback;
}

/**
 * Create connection error message
 * Consolidates the repeated connection error message pattern
 */
export function createConnectionErrorMessage(error: unknown): string {
  const errorMessage = extractErrorMessage(error);
  return `Cannot connect to API server. Please ensure the API server is running at ${VITE_API_URL}. Error: ${errorMessage}`;
}

/**
 * Handle API error with consistent error message extraction
 */
export function handleApiError(
  error: unknown,
  context = 'Operation'
): {
  isValid: false;
  error: string;
} {
  const errorMessage = extractErrorMessage(error);

  if (isConnectionError(error)) {
    return {
      isValid: false,
      error: createConnectionErrorMessage(error),
    };
  }

  return {
    isValid: false,
    error: `${context} failed: ${errorMessage}`,
  };
}
