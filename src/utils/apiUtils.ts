import type { MarketrixConfig } from '../types';

function isConnectionError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return (
    errorMessage.includes('Failed to fetch') ||
    errorMessage.includes('ERR_CONNECTION_REFUSED') ||
    errorMessage.includes('NetworkError') ||
    errorMessage.includes('Network request failed')
  );
}

export function extractErrorMessage(error: unknown, fallback = 'Unknown error'): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return fallback;
}

export function handleApiError(
  error: unknown,
  context = 'Operation',
  config?: Partial<MarketrixConfig>,
): {
  isValid: false;
  error: string;
} {
  const errorMessage = extractErrorMessage(error);

  if (isConnectionError(error)) {
    const apiUrl = config?.mtxApiHost || 'configured API server';
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
