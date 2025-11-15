import { useEffect, useState } from 'react';

import { DEFAULT_WIDGET_SETTINGS } from '../config';
import type { WidgetSettingsData } from '../sdk';
import { IntegrationService } from '../services/integrationService';
import type { MarketrixConfig } from '../types';
import { isWidgetSettingsData } from '../utils/typeGuards';

export const useIntegrationSettings = (config: MarketrixConfig) => {
  const [settings, setSettings] = useState<WidgetSettingsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      // Path 1: marketrixId + marketrixKey
      if (config.marketrixId && config.marketrixKey) {
        try {
          setIsLoading(true);
          setError(null);

          const integrationService = new IntegrationService(
            config.marketrixId,
            config.marketrixKey
          );

          const integrationData = await integrationService.fetchIntegrationSettings();
          const integrationSettings = integrationData
            ? integrationService.getWidgetSettings(integrationData)
            : null;

          if (integrationSettings) {
            setSettings(integrationSettings);
            console.log('Integration settings loaded from API:', integrationSettings);
          } else {
            // API returned no settings, use defaults
            console.log('No integration settings found in API, using default settings');
            setSettings(DEFAULT_WIDGET_SETTINGS);
          }
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : 'Failed to fetch integration settings';
          setError(errorMessage);
          console.error('Error fetching integration settings:', err);
          // On error, still provide defaults
          setSettings(DEFAULT_WIDGET_SETTINGS);
        } finally {
          setIsLoading(false);
        }
      }
      // Path 2: connectionId + agentId (default settings from atmosphere)
      else if (config.connectionId && config.agentId) {
        if (config.atmosphere?.widget_settings) {
          const widgetSettings = config.atmosphere.widget_settings;
          if (isWidgetSettingsData(widgetSettings)) {
            console.log('Using default widget settings from atmosphere config');
            setSettings(widgetSettings);
            setIsLoading(false);
            return;
          }
        }
        // No settings in atmosphere (shouldn't happen, but handle gracefully)
        setError('Missing widget settings in atmosphere config');
        setIsLoading(false);
      } else {
        // Neither path is valid
        setError('Missing marketrixId/marketrixKey or connectionId/agentId');
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [
    config.marketrixId,
    config.marketrixKey,
    config.connectionId,
    config.agentId,
    config.apiBaseUrl,
    config.atmosphere?.widget_settings,
  ]);

  return {
    settings,
    isLoading,
    error,
  };
};
