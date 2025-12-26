import { useCallback, useEffect, useMemo } from 'react';

import { useWidgetContext } from '../context/WidgetContext';
import { configManager } from '../services/ConfigManager';
import type { MarketrixConfig, ValidatedMarketrixConfig } from '../types';

interface UseWidgetProps {
  config?: MarketrixConfig;
}

/**
 * Validates that config has all required widget settings
 * Throws an error if validation fails
 */
function validateWidgetSettings(
  config: MarketrixConfig | undefined
): asserts config is ValidatedMarketrixConfig {
  if (!config) {
    throw new Error('Widget configuration is missing');
  }

  const requiredSettings = [
    'widget_enabled',
    'widget_appearance',
    'widget_position',
    'widget_device',
    'widget_header',
    'widget_body',
    'widget_greeting',
    'widget_feature_tell',
    'widget_feature_show',
    'widget_feature_do',
    'widget_feature_human',
    'widget_background_color',
    'widget_text_color',
    'widget_border_color',
    'widget_accent_color',
    'widget_secondary_color',
    'widget_border_radius',
    'widget_font_size',
    'widget_width',
    'widget_height',
    'widget_shadow',
    'widget_animation_duration',
    'widget_fade_duration',
    'widget_bounce_effect',
    'widget_chips',
  ] as const;

  const missingSettings = requiredSettings.filter(
    (key) => config[key as keyof MarketrixConfig] === undefined
  );

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

  // Validate settings - throws if invalid
  validateWidgetSettings(marketrixConfig);

  // After validation, we know all required fields exist
  const validatedConfig = marketrixConfig as ValidatedMarketrixConfig;

  // Update ConfigManager whenever config changes
  useEffect(() => {
    configManager.saveConfig(validatedConfig);
  }, [validatedConfig]);

  const shouldShowWidget = useCallback(() => {
    return validatedConfig.widget_enabled === true;
  }, [validatedConfig]);

  // Extract preview mode flag from config
  const isPreviewMode = validatedConfig.isPreviewMode ?? false;

  return {
    state,
    config: validatedConfig,
    actions,
    shouldShow: shouldShowWidget(),
    isPreviewMode,
  };
};
