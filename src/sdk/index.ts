/**
 * The widget's one door to the api: `createClient` builds the oRPC client bound to `widgetContract`,
 * `configureSdk` points it at an api host and `sdk` proxies the current client, plus the wire types
 * the embedding page consumes.
 * One published bundle loads on any customer's page, so the api host is set at runtime, and every request
 * omits cookies because the widget authenticates with its `marketrix_id`/`marketrix_key` fields alone.
 */
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';

import type { widgetContract } from './contract';

function createClient(apiUrl: string): ContractRouterClient<typeof widgetContract> {
  return createORPCClient(
    new RPCLink({
      url: apiUrl,
      fetch: (request, init) => globalThis.fetch(request, { ...init, credentials: 'omit' }),
    }),
  );
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

export type { ApplicationWidgetPublicData, InstructionType, WidgetSettingsData } from './contracts/widgetSettings';

export type { WidgetCommand, WidgetEvent } from './contracts/widget';
