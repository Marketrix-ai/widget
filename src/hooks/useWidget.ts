import { useCallback, useEffect, useMemo } from 'react';

import { useWidgetContext } from '../context/WidgetContext';
import { WidgetSettingsDataSchema } from '../sdk';
import { configManager } from '../services/ConfigManager';
import type { MarketrixConfig, WidgetSettingsData } from '../types';

interface UseWidgetProps {
  config?: MarketrixConfig;
}

/**
 * Type guard that validates config has all required widget settings
 * Throws an error if validation fails
 */
function validateWidgetSettings(
  config: MarketrixConfig | undefined
): asserts config is MarketrixConfig & Required<Pick<MarketrixConfig, keyof WidgetSettingsData>> {
  if (!config) {
    throw new Error('Widget configuration is missing');
  }

  const requiredKeys = Object.keys(WidgetSettingsDataSchema.shape) as Array<
    keyof WidgetSettingsData
  >;
  const missingSettings = requiredKeys.filter((key) => config[key] === undefined);

  if (missingSettings.length > 0) {
    throw new Error(
      `Widget settings are incomplete. Missing required fields: ${missingSettings.join(', ')}`
    );
  }
}

export const useWidget = ({ config }: UseWidgetProps = {}) => {
  const { state, actions } = useWidgetContext();

  // Memoize config - should already have all settings from API (including defaults)
  const marketrixConfig = useMemo<MarketrixConfig>(() => {
    return config || {};
  }, [config]);

  // Validate settings - throws if invalid, TypeScript narrows the type
  validateWidgetSettings(marketrixConfig);

  // After validation, TypeScript knows all required fields exist
  // Update ConfigManager whenever config changes
  useEffect(() => {
    configManager.saveConfig(marketrixConfig);
  }, [marketrixConfig]);

  const shouldShowWidget = useCallback(() => {
    return marketrixConfig.widget_enabled === true;
  }, [marketrixConfig]);

  // Extract preview mode flag from config
  const isPreviewMode = marketrixConfig.isPreviewMode ?? false;

  return {
    state,
    config: marketrixConfig,
    actions,
    shouldShow: shouldShowWidget(),
    isPreviewMode,
  };
};
