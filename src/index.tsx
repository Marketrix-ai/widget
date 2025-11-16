import './index.css';

import { WidgetValidationService } from './services/widgetValidationService';
import type { MarketrixConfig } from './types';
import { registerAutoInit } from './utils/autoInit';
import { mergeConfigWithDefaultAtmosphere } from './utils/configHelpers';
import { configManager } from './utils/ConfigManager';
import {
  createWidgetContainer,
  destroyWidgetContainer,
  mountWidget,
} from './utils/widgetInitializer';
import {
  clearWidgetState,
  getCurrentConfig as getCurrentConfigFromLifecycle,
  getWidgetInstance,
  isWidgetInitialized,
  setCurrentConfig,
  setWidgetInstance,
} from './utils/widgetLifecycle';
import { hideWidgetSettingsLoader, showWidgetSettingsLoader } from './utils/widgetLoader';

// Initialize the widget
export const initMarketrixWidget = async (config: MarketrixConfig): Promise<void> => {
  // Prevent double initialization
  if (isWidgetInitialized()) {
    console.warn('Marketrix Widget: already initialized');
    return;
  }

  const validationService = new WidgetValidationService();
  let finalConfig: MarketrixConfig;

  // Path 1: marketrixId + marketrixKey
  if (config.marketrixId && config.marketrixKey) {
    showWidgetSettingsLoader('Validating widget configuration...');

    const validationResult = await validationService.validateWidget(
      config.marketrixId,
      config.marketrixKey
    );

    if (!validationResult.isValid) {
      console.error('Marketrix Widget validation failed:', validationResult.error);
      showWidgetSettingsLoader(
        validationResult.error || 'Widget validation failed. Please check your configuration.'
      );
      return;
    }

    hideWidgetSettingsLoader();
    // Hook will fetch settings from API or return defaults
    finalConfig = config;
  }
  // Path 2: connectionId + agentId
  else if (config.connectionId && config.agentId) {
    showWidgetSettingsLoader('Validating agent and connection...');

    const validationResult = await validationService.validateByAgentAndConnection(
      config.agentId,
      config.connectionId
    );

    if (!validationResult.isValid) {
      console.error('Agent and Connection validation failed:', validationResult.error);
      showWidgetSettingsLoader(
        validationResult.error ||
          'Unable to validate agent and connection. Please check the provided IDs.'
      );
      return;
    }

    hideWidgetSettingsLoader();

    // Use default settings for connectionId/agentId path
    finalConfig = mergeConfigWithDefaultAtmosphere(config, true);

    console.log('✅ Using default widget settings for connectionId/agentId path');
  } else {
    // Neither path is valid
    showWidgetSettingsLoader(
      'Please provide either (marketrix-id + marketrix-key) OR (marketrix-agent + marketrix-connection-id)'
    );
    return;
  }

  // Initialize ConfigManager with finalConfig before widget renders
  if (finalConfig.atmosphere) {
    configManager.saveConfig(finalConfig.atmosphere);
  }

  // Store current config
  setCurrentConfig(finalConfig);

  // Create container and mount widget
  const { mountEl } = createWidgetContainer();
  const instance = mountWidget(mountEl, finalConfig);
  setWidgetInstance(instance);

  console.log('Marketrix Widget initialized successfully');
};

// Register auto-initialization immediately after function definition
// This ensures the function is available when DOM becomes ready
registerAutoInit(initMarketrixWidget);

// Destroy the widget
export const destroyMarketrixWidget = (): void => {
  const instance = getWidgetInstance();
  if (instance) {
    instance.unmount();
    clearWidgetState();

    // Remove container
    destroyWidgetContainer();

    console.log('Marketrix Widget destroyed');
  }

  // Also hide loader if present
  hideWidgetSettingsLoader();
};

// Update widget configuration
export const updateMarketrixConfig = async (newConfig: Partial<MarketrixConfig>): Promise<void> => {
  if (isWidgetInitialized()) {
    // Re-initialize with updated config
    const currentConfig = getCurrentConfigFromLifecycle();
    if (!currentConfig) {
      throw new Error('Widget not initialized');
    }
    const updatedConfig = { ...currentConfig, ...newConfig };
    destroyMarketrixWidget();
    await initMarketrixWidget(updatedConfig);
  }
};

// Get current configuration
export const getCurrentConfig = (): MarketrixConfig => {
  const config = getCurrentConfigFromLifecycle();
  if (!config) {
    throw new Error('Widget not initialized');
  }
  return config;
};

// Export types for external use
export type { ChatMessage, ChatMode, MarketrixConfig, Theme, WidgetState } from './types';

// Export default for ES modules
export default {
  initMarketrixWidget,
  destroyMarketrixWidget,
  updateMarketrixConfig,
  getCurrentConfig,
};
