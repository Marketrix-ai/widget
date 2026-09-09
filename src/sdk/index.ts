/**
 * The widget's one door to the api: the oRPC client bound to `widgetContract`, plus the schemas and types
 * the embedding page consumes.
 *
 * Contents: `createClient` builds an oRPC client for one api host; `configureSdk` points the SDK at that
 * host and MUST be called before any SDK operation, because one published bundle is loaded from any
 * customer's page and so carries no baked-in api host; `sdk` is a Proxy over the current client, so a
 * caller may hold one stable reference across reconfiguration.
 *
 * The `widgetContract` re-export is type-only: the oRPC client builds each request from the proxied
 * property path, so the contract value itself never ships in the bundle.
 */
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';

import type { widgetContract } from './contract';

function createClient(apiUrl: string): ContractRouterClient<typeof widgetContract> {
  return createORPCClient(new RPCLink({ url: apiUrl }));
}

let currentApiUrl = '';
let client = createClient('');

export const configureSdk = (apiUrl: string) => {
  if (!apiUrl?.trim()) throw new Error('API URL is required for SDK configuration');

  if (apiUrl !== currentApiUrl) {
    currentApiUrl = apiUrl;
    client = createClient(apiUrl);
  }
};

export const sdk = new Proxy({} as ContractRouterClient<typeof widgetContract>, {
  get(_target, prop) {
    return client[prop as keyof typeof client];
  },
});

export { WidgetSettingsDataSchema } from './contracts/entities';
export { WidgetEventSchema } from './contracts/widget';

export type { InstructionType, WidgetData, WidgetSettingsData } from './contracts/entities';

export type { WidgetCommand, WidgetEvent } from './contracts/widget';

export type { widgetContract } from './contract';
