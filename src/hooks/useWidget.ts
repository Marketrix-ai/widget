import { useCallback, useEffect, useMemo } from 'react';

import {
  DEFAULT_MARKETRIX_CONFIG,
  DEFAULT_WIDGET_SETTINGS,
  extractWidgetSettingsFromConfig,
} from '../constants/config';
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

  // Memoize settings
  const marketrixConfig = useMemo<MarketrixConfig>(() => {
    return {
      ...DEFAULT_MARKETRIX_CONFIG,
      ...config,
    };
  }, [config]);

  // Update ConfigManager whenever config changes
  useEffect(() => {
    configManager.saveConfig(marketrixConfig);
  }, [marketrixConfig]);

  // Effective settings
  const effectiveSettings = useMemo<WidgetSettingsData>(() => {
    if (!marketrixConfig) return DEFAULT_WIDGET_SETTINGS;
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
