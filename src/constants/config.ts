import type { MarketrixConfig } from '../types';

/**
 * Get the API URL from config.
 * @param config - MarketrixConfig to extract API URL from
 * @returns API URL string or empty string if not configured
 */
export const getApiUrl = (config?: Partial<MarketrixConfig>): string => {
  if (config?.mtxApiHost) {
    return config.mtxApiHost;
  }
  return '';
};

/**
 * Derives the websocket URL for the agent server
 * Requires config.mtxAiHost to be provided
 * @throws Error if mtxAiHost is not provided
 */
export function getAgentWebSocketUrl(config?: Partial<MarketrixConfig>): string {
  if (!config?.mtxAiHost) {
    throw new Error(
      'Agent server URL is required. Please provide mtxAiHost in the widget configuration.'
    );
  }
  return ensureWebSocketUrl(config.mtxAiHost);
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

/**
 * Converts an API URL to a WebSocket URL for events endpoint
 * If http:// or https:// is provided, converts it appropriately
 * Appends /events path to the URL
 */
export function getEventsWebSocketUrl(apiUrl: string): string {
  // Remove trailing slash if present
  const cleanUrl = apiUrl.trim().replace(/\/$/, '');

  if (cleanUrl.startsWith('ws://') || cleanUrl.startsWith('wss://')) {
    return cleanUrl.endsWith('/events') ? cleanUrl : `${cleanUrl}/events`;
  }
  if (cleanUrl.startsWith('http://')) {
    const wsUrl = cleanUrl.replace('http://', 'ws://');
    return wsUrl.endsWith('/events') ? wsUrl : `${wsUrl}/events`;
  }
  if (cleanUrl.startsWith('https://')) {
    const wssUrl = cleanUrl.replace('https://', 'wss://');
    return wssUrl.endsWith('/events') ? wssUrl : `${wssUrl}/events`;
  }
  // If no protocol, assume ws:// for localhost, wss:// for others
  if (cleanUrl.includes('localhost') || cleanUrl.includes('127.0.0.1')) {
    return `ws://${cleanUrl}/events`;
  }
  return `wss://${cleanUrl}/events`;
}
