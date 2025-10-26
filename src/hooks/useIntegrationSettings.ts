import { useEffect, useState } from 'react';

import type { WidgetSettingsData } from '../sdk';
import { IntegrationService } from '../services/integrationService';
import type { MarketrixConfig } from '../types';

export const useIntegrationSettings = (config: MarketrixConfig) => {
  const [settings, setSettings] = useState<WidgetSettingsData | null>(null);
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

        const integrationService = new IntegrationService(config.marketrixId, config.marketrixKey);

        const integrationData = await integrationService.fetchIntegrationSettings();
        const integrationSettings = integrationData
          ? integrationService.getWidgetSettings(integrationData)
          : null;

        if (integrationSettings) {
          setSettings(integrationSettings);
          console.log('Integration settings loaded:', integrationSettings);
        } else {
          console.warn('No integration settings found, using default configuration');
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch integration settings';
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
