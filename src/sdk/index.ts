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

client = createClient('');

/** Must be called before any SDK operation — the widget has no baked-in API host. */
export const configureSdk = (apiUrl: string) => {
  if (!apiUrl?.trim()) throw new Error('API URL is required for SDK configuration');

  if (apiUrl !== currentApiUrl) {
    console.log(`[SDK] Reconfiguring API URL to: ${apiUrl}`);
    currentApiUrl = apiUrl;
    client = createClient(apiUrl);
  }
};

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

export const sdk = new Proxy({} as ContractRouterClient<typeof widgetContract> & SdkExtras, {
  get(_target, prop) {
    if (prop in sdkExtras) {
      return sdkExtras[prop as keyof typeof sdkExtras];
    }
    return client[prop as keyof typeof client];
  },
});

export { WidgetSettingsDataSchema } from './contracts/entities';
export { WidgetEventSchema } from './contracts/widget';

export type {
  ApplicationData,
  InstructionType,
  UserData,
  WidgetChip,
  WidgetData,
  WidgetSettingsData,
  WorkspaceData,
} from './contracts/entities';

export type { WidgetCommand, WidgetEvent, WidgetSettingsKey } from './contracts/widget';

// Type-only: the oRPC client builds requests from the proxied path, so the contract value never ships.
export type { widgetContract } from './contract';
