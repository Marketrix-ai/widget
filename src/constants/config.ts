import type { WidgetSettingsData } from '../sdk';
import type { MarketrixConfig } from '../types';

// Mutable configuration for runtime updates
// Initialized to empty strings to enforce runtime configuration
export const Config = {
  API_URL: '',
  AGENT_SERVER_URL: '',
};

/**
 * Update the global API configuration
 */
export const updateApiConfig = (apiUrl?: string, agentUrl?: string) => {
  if (apiUrl) {
    console.log(`[Config] Updating API URL to: ${apiUrl}`);
    Config.API_URL = apiUrl;
  }
  if (agentUrl) {
    console.log(`[Config] Updating Agent Server URL to: ${agentUrl}`);
    Config.AGENT_SERVER_URL = agentUrl;
  }
};

/**
 * Get the configured API URL.
 */
export const getApiUrl = (): string => {
  if (!Config.API_URL) {
    // Return empty string to allow validation service to fail gracefully with specific error
    return '';
  }
  return Config.API_URL;
};

const NON_WIDGET_SETTINGS_KEYS = [
  'mtxId',
  'mtxKey',
  'mtxApp',
  'mtxAgent',
  'mtxApiHost',
  'mtxAiHost',
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
 * Requires either config.mtxAiHost or configured AGENT_SERVER_URL to be provided
 * @throws Error if neither mtxAiHost nor configured AGENT_SERVER_URL is provided
 */
export function getAgentWebSocketUrl(config?: Partial<MarketrixConfig>): string {
  // 1. Check if explicitly provided in config
  if (config?.mtxAiHost) {
    return ensureWebSocketUrl(config.mtxAiHost);
  }

  // 2. Check configured URL
  if (Config.AGENT_SERVER_URL) {
    return ensureWebSocketUrl(Config.AGENT_SERVER_URL);
  }

  // 3. Throw error if neither is provided
  throw new Error(
    'Agent server URL is required. Please provide either mtxAiHost in config or configure mtxAiHost.'
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
