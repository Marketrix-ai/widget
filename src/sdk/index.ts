import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';

import type { widgetContract } from './contract';

let authToken: string | null = null;
let currentApiUrl: string = '';
let client: ContractRouterClient<typeof widgetContract>;

function createClient(apiUrl: string): ContractRouterClient<typeof widgetContract> {
  const link = new RPCLink({
    url: apiUrl,
    headers: () => {
      const headers: Record<string, string> = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      return headers;
    },
  });

  return createORPCClient(link);
}

// Initialize with empty client - must be configured via configureSdk() before use
client = createClient('');

/**
 * Re-initialize the SDK client with a new base URL
 * Must be called before any SDK operations
 */
export const configureSdk = (apiUrl: string) => {
  if (!apiUrl?.trim()) throw new Error('API URL is required for SDK configuration');

  if (apiUrl !== currentApiUrl) {
    console.log(`[SDK] Reconfiguring API URL to: ${apiUrl}`);
    currentApiUrl = apiUrl;
    client = createClient(apiUrl);
  }
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
  configure: configureSdk,
};

type SdkExtras = typeof sdkExtras;

// Create a proxy to forward calls to the current client instance.
// oRPC's client is a deep Proxy that intercepts all string property accesses
// (including .bind, .call, etc.) as route path segments, so we must not call
// .bind() on it — just return the property directly.
export const sdk = new Proxy({} as ContractRouterClient<typeof widgetContract> & SdkExtras, {
  get(_target, prop) {
    if (prop in sdkExtras) {
      return sdkExtras[prop as keyof typeof sdkExtras];
    }
    return client[prop as keyof typeof client];
  },
});

// Runtime value re-exports (used by services, tests, and widget stream handler)
export { WidgetSettingsDataSchema } from './contracts/entities';
export { WidgetEventSchema } from './contracts/widget';

// Type-only re-exports from entities
export type {
  ApplicationData,
  InstructionType,
  UserData,
  WidgetChip,
  WidgetData,
  WidgetSettingsData,
  WorkspaceData,
} from './contracts/entities';

// Type-only re-exports from widget contract
export type { WidgetCommand, WidgetEvent, WidgetSettingsKey } from './contracts/widget';

// Type-only export: the oRPC client builds requests from the proxied path and
// never needs the `widgetContract` VALUE at runtime.
export type { widgetContract } from './contract';
