/**
 * API Response Helpers
 *
 * Consolidates common API response validation patterns to follow DRY principle.
 * Eliminates repetition of response.status === 200 && response.body?.success checks.
 */

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

/**
 * Check if response has error
 */
export function hasApiError<T>(response: ApiResponse<T>): boolean {
  return !isValidApiResponse(response);
}
