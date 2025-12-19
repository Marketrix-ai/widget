import { useCallback, useEffect, useMemo } from 'react';

import { extractWidgetSettingsFromConfig } from '../constants/config';
import { useWidgetContext } from '../context/WidgetContext';
import { configManager } from '../services/ConfigManager';
import type { MarketrixConfig, WidgetSettingsData } from '../types';
import {
  getWidgetCustomize as getWidgetCustomizeConfig,
  getWidgetPosition as getWidgetPositionConfig,
  getWidgetText as getWidgetTextConfig,
} from '../utils/config';

interface UseWidgetProps {
  config?: MarketrixConfig;
}

export const useWidget = ({ config }: UseWidgetProps = {}) => {
  const { state, actions } = useWidgetContext();

  // Memoize settings - config should already have all settings from API (including defaults)
  const marketrixConfig = useMemo<MarketrixConfig>(() => {
    return config || {};
  }, [config]);

  // Update ConfigManager whenever config changes
  useEffect(() => {
    configManager.saveConfig(marketrixConfig);
  }, [marketrixConfig]);

  // Effective settings - extract from config (which should have all settings from API)
  const effectiveSettings = useMemo<WidgetSettingsData>(() => {
    if (!marketrixConfig) {
      // Return empty settings - should not happen as API always returns defaults
      return {} as WidgetSettingsData;
    }
    return extractWidgetSettingsFromConfig(marketrixConfig);
  }, [marketrixConfig]);

  // Configuration getters
  const getWidgetText = useCallback(() => {
    return getWidgetTextConfig(marketrixConfig);
  }, [marketrixConfig]);

  const getWidgetCustomize = useCallback(() => {
    return getWidgetCustomizeConfig(marketrixConfig);
  }, [marketrixConfig]);

  const getWidgetPosition = useCallback(() => {
    return getWidgetPositionConfig(marketrixConfig);
  }, [marketrixConfig]);

  const shouldShowWidget = useCallback(() => {
    return marketrixConfig?.widget_enabled ?? false;
  }, [marketrixConfig]);

  return {
    state,
    marketrixConfig,
    settings: effectiveSettings,
    actions,
    shouldShow: shouldShowWidget(),
    getWidgetText,
    getWidgetCustomize,
    getWidgetPosition,
  };
};
