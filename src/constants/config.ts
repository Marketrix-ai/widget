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
