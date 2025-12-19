import type { WidgetSettingsData } from '../sdk';
import type { MarketrixConfig } from '../types';

export const VITE_API_URL = import.meta.env.VITE_API_URL || '';
export const VITE_AGENT_SERVER_URL = import.meta.env.VITE_AGENT_SERVER_URL || '';

const NON_WIDGET_SETTINGS_KEYS = [
  'marketrixId',
  'marketrixKey',
  'agentId',
  'connectionId',
  'apiBaseUrl',
  'agentServerUrl',
  'widget_position_offset',
  'widget_position_z_index',
] as const;

function extractWidgetSettingsFields(
  config: Partial<MarketrixConfig>
): Partial<WidgetSettingsData> {
  const result = { ...config } as Partial<WidgetSettingsData>;
  for (const key of NON_WIDGET_SETTINGS_KEYS) {
    delete (result as Record<string, unknown>)[key];
  }
  return result;
}

/**
 * Extract widget settings from MarketrixConfig
 * Settings should already include defaults from API, so we just extract the widget-specific fields
 */
export function extractWidgetSettingsFromConfig(
  config: Partial<MarketrixConfig>
): WidgetSettingsData {
  // Extract widget settings fields - config should already have all settings from API (including defaults)
  return extractWidgetSettingsFields(config) as WidgetSettingsData;
}

/**
 * Derives the websocket URL for the agent server
 * Requires either config.agentServerUrl or VITE_AGENT_SERVER_URL to be provided
 * @throws Error if neither agentServerUrl nor VITE_AGENT_SERVER_URL is provided
 */
export function getAgentWebSocketUrl(config?: Partial<MarketrixConfig>): string {
  // 1. Check if explicitly provided in config
  if (config?.agentServerUrl) {
    return ensureWebSocketUrl(config.agentServerUrl);
  }

  // 2. Check environment variable
  if (VITE_AGENT_SERVER_URL) {
    return ensureWebSocketUrl(VITE_AGENT_SERVER_URL);
  }

  // 3. Throw error if neither is provided
  throw new Error(
    'Agent server URL is required. Please provide either agentServerUrl in config or set VITE_AGENT_SERVER_URL environment variable.'
  );
}

/**
 * Ensures the URL is a websocket URL (ws:// or wss://)
 * If http:// or https:// is provided, converts it appropriately
 */
function ensureWebSocketUrl(url: string): string {
  // Remove trailing slash if present
  const cleanUrl = url.trim().replace(/\/$/, '');

  if (cleanUrl.startsWith('ws://') || cleanUrl.startsWith('wss://')) {
    return cleanUrl.endsWith('/widget') ? cleanUrl : `${cleanUrl}/widget`;
  }
  if (cleanUrl.startsWith('http://')) {
    const wsUrl = cleanUrl.replace('http://', 'ws://');
    return wsUrl.endsWith('/widget') ? wsUrl : `${wsUrl}/widget`;
  }
  if (cleanUrl.startsWith('https://')) {
    const wssUrl = cleanUrl.replace('https://', 'wss://');
    return wssUrl.endsWith('/widget') ? wssUrl : `${wssUrl}/widget`;
  }
  // If no protocol, assume ws:// for localhost, wss:// for others
  if (cleanUrl.includes('localhost') || cleanUrl.includes('127.0.0.1')) {
    return `ws://${cleanUrl}/widget`;
  }
  return `wss://${cleanUrl}/widget`;
}
