/**
 * The widget's one door to the api: the oRPC client bound to `widgetContract`, plus the wire types the
 * widget reads. `configureSdk` points it at one api host and must run first, since one published bundle
 * serves every customer and carries no baked-in host; `sdk` proxies the current client so a caller can
 * hold one reference across reconfiguration.
 *
 * Every request omits credentials: the widget authenticates with `marketrix_id`/`marketrix_key` fields,
 * and a script embedded on an arbitrary host page has no business sending that page's cookies.
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

export type { ApplicationWidgetPublicData, InstructionType, WidgetSettingsData } from './contracts/entities';

export type { WidgetCommand, WidgetEvent } from './contracts/widget';
