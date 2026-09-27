/**
 * The widget's one door to the api: `createClient` builds the oRPC client bound to `widgetContract`,
 * `configureSdk` points it at an api host and `getSdk` returns the current client, throwing until one is
 * configured, plus the wire types the widget's own code imports.
 * One published bundle loads on any customer's page, so the api host is set at runtime, and every request
 * omits cookies because the widget authenticates with its `marketrix_id`/`marketrix_key` fields alone.
 */
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';

import type { widgetContract } from './contract';

export type WidgetClient = ContractRouterClient<typeof widgetContract>;

function createClient(apiUrl: string): WidgetClient {
  return createORPCClient(
    new RPCLink({
      url: apiUrl,
      fetch: (request, init) => globalThis.fetch(request, { ...init, credentials: 'omit' }),
    }),
  );
}

let current: { url: string; client: WidgetClient } | null = null;

export const configureSdk = (apiUrl: string) => {
  if (!apiUrl.trim()) throw new Error('API URL is required for SDK configuration');
  if (apiUrl !== current?.url) current = { url: apiUrl, client: createClient(apiUrl) };
};

export function getSdk(): WidgetClient {
  if (!current) throw new Error('SDK used before configureSdk set the api host');
  return current.client;
}

export type { ApplicationWidgetPublicData, InstructionType, WidgetSettingsData } from './contracts/widgetSettings';

export type { WidgetCommand, WidgetEvent, WidgetToolResult } from './contracts/widget';
