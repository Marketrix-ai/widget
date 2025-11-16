import { type FetchApiOptions, initClient } from '@ts-rest/core';

import { VITE_API_URL } from '../constants/config';
import { hasProperty } from '../utils/typeGuards';
import { contract } from './routes';

let authToken: string | null = null;
const client = initClient(contract, {
  baseUrl: VITE_API_URL,
  baseHeaders: {
    Authorization: (_options: FetchApiOptions) => (authToken ? `Bearer ${authToken}` : ''),
  },
  jsonQuery: true,
});

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

// SDK with auth token management methods
export const sdk = Object.assign(client, {
  setAuthToken: (token: string) => {
    authToken = token;
  },
  clearAuthToken: () => {
    authToken = null;
  },
  getAuthToken: () => authToken,
  parse,
});

// Export all types from schema
export * from './schema';

// Export contract from routes
export { contract } from './routes';
