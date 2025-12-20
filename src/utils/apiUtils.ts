/**
 * API Utilities
 *
 * Consolidates API response validation, data extraction, and error handling patterns.
 * Eliminates repetition of response validation and error handling across services.
 */

import { getApiUrl } from '../constants/config';

// ============================================================================
// API Response Helpers
// ============================================================================

/**
 * API Response Body structure (matches SDK's ResBody interface)
 */
interface ApiResponseBody<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Generic API response type - flexible to handle SDK union types
 */
type ApiResponse<T = unknown> = {
  status: number;
  body?: ApiResponseBody<T> | null | unknown;
  [key: string]: unknown;
};

/**
 * Validate API response structure
 * Consolidates the repeated pattern: response.status === 200 && response.body?.success
 */
export function isValidApiResponse<T = unknown>(
  response: ApiResponse<T>
): response is ApiResponse<T> & { status: 200; body: ApiResponseBody<T> } {
  const body = response.body as ApiResponseBody<T> | null | undefined;
  return response.status === 200 && body?.success === true;
}

/**
 * Extract data from API response with validation
 * Consolidates the pattern: isValidApiResponse(response) && response.body.data
 */
export function extractApiData<T>(response: ApiResponse<T>): T | null {
  if (isValidApiResponse(response)) {
    const body = response.body as ApiResponseBody<T>;
    if (body.data !== undefined) {
      return body.data;
    }
  }
  return null;
}

// ============================================================================
// Error Handling Utilities
// ============================================================================

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
    let apiUrl = 'configured API server';
    try {
      apiUrl = getApiUrl();
    } catch {
      // Ignore error if URL not configured yet
    }
    const connectionErrorMessage = `Cannot connect to API server. Please ensure the API server is running at ${apiUrl}. Error: ${errorMessage}`;
    return {
      isValid: false,
      error: connectionErrorMessage,
    };
  }

  return {
    isValid: false,
    error: `${context} failed: ${errorMessage}`,
  };
}
