import { useState, useEffect } from 'react';
import { IntegrationService, IntegrationSettings } from '../services/integrationService';
import { MarketrixConfig } from '../types';

export const useIntegrationSettings = (config: MarketrixConfig) => {
  const [settings, setSettings] = useState<IntegrationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!config.marketrixId || !config.marketrixKey) {
        setError('Missing marketrixId or marketrixKey');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Use the API base URL from the config or default to localhost
        const baseUrl = config.apiBaseUrl || 'http://localhost:8080';
        const integrationService = new IntegrationService(
          baseUrl,
          config.marketrixId,
          config.marketrixKey
        );

        const integrationSettings = await integrationService.fetchIntegrationSettings();
        
        if (integrationSettings) {
          setSettings(integrationSettings);
          console.log('Integration settings loaded:', integrationSettings);
        } else {
          console.warn('No integration settings found, using default configuration');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch integration settings';
        setError(errorMessage);
        console.error('Error fetching integration settings:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [config.marketrixId, config.marketrixKey, config.apiBaseUrl]);

  return {
    settings,
    isLoading,
    error,
  };
};
