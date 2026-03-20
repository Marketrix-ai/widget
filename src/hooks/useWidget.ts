import { useCallback, useEffect, useMemo } from 'react';

import { useWidgetContext } from '../context/WidgetContext';
import { WidgetSettingsDataSchema } from '../sdk';
import { configManager } from '../services/ConfigManager';
import type { MarketrixConfig, WidgetSettingsData } from '../types';

export type ValidWidgetConfig = MarketrixConfig & Required<Pick<MarketrixConfig, keyof WidgetSettingsData>>;

interface UseWidgetProps {
  config?: MarketrixConfig;
}

function isConfigComplete(config: MarketrixConfig): config is ValidWidgetConfig {
  const requiredKeys = Object.keys(WidgetSettingsDataSchema.shape) as Array<keyof WidgetSettingsData>;
  return requiredKeys.every(key => config[key] !== undefined);
}

export const useWidget = ({ config }: UseWidgetProps = {}) => {
  const { state, actions } = useWidgetContext();

  const marketrixConfig = useMemo<MarketrixConfig>(() => {
    return config || {};
  }, [config]);

  const configValid = isConfigComplete(marketrixConfig);

  useEffect(() => {
    if (configValid) {
      configManager.saveConfig(marketrixConfig);
    }
  }, [marketrixConfig, configValid]);

  const shouldShowWidget = useCallback(() => {
    return configValid && marketrixConfig.widget_enabled === true;
  }, [marketrixConfig, configValid]);

  const isPreviewMode = marketrixConfig.isPreviewMode ?? false;

  return {
    state,
    // Cast is safe: callers must check configValid before accessing widget setting fields.
    // The asserts-based validation was removed because throwing mid-render breaks React's
    // hook count invariant (React error #310).
    config: marketrixConfig as ValidWidgetConfig,
    actions,
    shouldShow: shouldShowWidget(),
    isPreviewMode,
    configValid,
  };
};
