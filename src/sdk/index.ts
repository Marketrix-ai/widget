import { type FetchApiOptions, initClient } from '@ts-rest/core';

import { Config } from '../constants/config';
import { hasProperty } from '../utils/validation';
import { contract } from './routes';

let authToken: string | null = null;

// Initialize the client with a placeholder or Config.API_URL if already set
let client = initClient(contract, {
  baseUrl: Config.API_URL || 'https://api.placeholder.invalid',
  baseHeaders: {
    Authorization: (_options: FetchApiOptions) => (authToken ? `Bearer ${authToken}` : ''),
  },
  jsonQuery: true,
});

/**
 * Re-initialize the SDK client with a new base URL
 */
export const configureSdk = (apiUrl: string) => {
  if (apiUrl && apiUrl !== Config.API_URL) {
    console.log(`[SDK] Reconfiguring API URL to: ${apiUrl}`);

    // Create new client instance
    const newClient = initClient(contract, {
      baseUrl: apiUrl,
      baseHeaders: {
        Authorization: (_options: FetchApiOptions) => (authToken ? `Bearer ${authToken}` : ''),
      },
      jsonQuery: true,
    });

    // Mutate the 'client' reference if possible, or update the proxy target?
    // Since 'client' is locally scoped, we need to ensure 'sdk' uses the new one.
    // The previous implementation used a proxy or object assignment.
    // Let's rely on the proxy approach which is robust.
    client = newClient;
  }
};

interface ResBody {
  success: boolean;
  data?: unknown;
  error?: string;
  message?: string;
}

interface Res {
  status: number;
  body?: ResBody | unknown;
}

// Helper type to extract data type from response
type ExtractData<T extends Res> = T extends { body: { data?: infer D } } ? D : never;

function isResBody(body: unknown): body is ResBody {
  if (!hasProperty(body, 'success')) {
    return false;
  }

  if (typeof body.success !== 'boolean') {
    return false;
  }

  if (hasProperty(body, 'error') && typeof body.error !== 'string') {
    return false;
  }

  if (hasProperty(body, 'message') && typeof body.message !== 'string') {
    return false;
  }

  return true;
}

const parse = <T extends Res>(res: T): ExtractData<T> => {
  if (!isResBody(res.body)) {
    throw new Error('Invalid response body structure');
  }

  if (res.status >= 200 && res.status < 400 && res.body.success) {
    // Type assertion needed for conditional type inference
    // TypeScript cannot infer conditional types from runtime checks
    // but we've validated the structure with isResBody
    return res.body.data as ExtractData<T>;
  }

  const err = res.body.error ?? res.body.message ?? 'Request failed';
  console.error('API Error:', err);
  throw new Error(err);
};

// Base object for auth methods and dynamic config
const sdkExtras = {
  setAuthToken: (token: string) => {
    authToken = token;
  },
  clearAuthToken: () => {
    authToken = null;
  },
  getAuthToken: () => authToken,
  parse,
  configure: configureSdk,
  // Add other methods that might be expected on sdk like `logCreate` which come from client
};

// Create a proxy to forward calls to the current client instance
export const sdk = new Proxy({} as typeof client & typeof sdkExtras, {
  get(_target, prop) {
    // Check extras first
    if (prop in sdkExtras) {
      return sdkExtras[prop as keyof typeof sdkExtras];
    }
    // Forward to current client instance
    const value = client[prop as keyof typeof client];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

// Export all types from schema
export * from './schema';

// Export contract from routes
export { contract } from './routes';
