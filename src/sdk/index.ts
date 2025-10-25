import { type FetchApiOptions, initClient } from '@ts-rest/core';

import { API_URL_GLOBAL_SET } from '../config';
import { contract } from './routes';

let authToken: string | null = null;
const client = initClient(contract, {
  baseUrl: API_URL_GLOBAL_SET.API_END_POINT,
  baseHeaders: {
    Authorization: (_options: FetchApiOptions) => (authToken ? `Bearer ${authToken}` : ''),
  },
  jsonQuery: true,
});

type ResBody = { success: boolean; data?: unknown; error?: string; message?: string };
type Res = { status: number; body?: ResBody | unknown };

const parse = <T extends Res>(res: T): T extends { body: { data?: infer D } } ? D : never => {
  const b = res.body as ResBody;
  if (res.status >= 200 && res.status < 400 && b?.success) {
    return b.data as T extends { body: { data?: infer D } } ? D : never;
  }
  const err = b?.error ?? b?.message ?? 'Request failed';
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

// Export raw client for backward compatibility
export { IntegrationService } from './integrationService';
export * from './schema';
