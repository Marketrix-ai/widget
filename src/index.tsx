import './index.css';

import type { WidgetSettingsData } from './sdk';
import { createConfigFromSettings } from './services/core/ConfigManager';
import { WidgetValidationService } from './services/core/WidgetValidationService';
import { IntegrationService } from './services/integrationService';
import type { MarketrixConfig } from './types';
import { registerAutoInit } from './utils/autoInit';
import {
  clearWidgetState,
  createWidgetContainer,
  destroyWidgetContainer,
  getCurrentConfig as getCurrentConfigFromLifecycle,
  getWidgetInstance,
  hideWidgetSettingsLoader,
  isWidgetInitialized,
  mountWidget,
  setCurrentConfig,
  setWidgetInstance,
  showWidgetSettingsLoader,
} from './utils/widgetInitializer';

/**
 * Initialize widget with validated configuration
 */
async function initializeWidgetWithConfig(
  config: MarketrixConfig,
  validationResult: { isValid: boolean; error?: string }
): Promise<MarketrixConfig> {
  if (!validationResult.isValid) {
    throw new Error(validationResult.error || 'Widget validation failed');
  }

  showWidgetSettingsLoader('Loading widget settings...');
  try {
    const integrationService = new IntegrationService(
      config.marketrixId,
      config.marketrixKey,
      config.connectionId
    );

    const integrationData = await integrationService.fetchIntegrationSettings();
    const integrationSettings = integrationData
      ? integrationService.getWidgetSettings(integrationData)
      : null;

    return integrationSettings
      ? createConfigFromSettings(integrationSettings, config)
      : createConfigFromSettings({} as WidgetSettingsData, config);
  } catch (err) {
    console.error('Error fetching integration settings:', err);
    return createConfigFromSettings({} as WidgetSettingsData, config);
  } finally {
    hideWidgetSettingsLoader();
  }
}

// Initialize the widget
export const initMarketrixWidget = async (config: MarketrixConfig): Promise<void> => {
  // Prevent double initialization
  if (isWidgetInitialized()) {
    console.warn('Marketrix Widget: already initialized');
    return;
  }

  // Validate configuration
  showWidgetSettingsLoader('Validating widget configuration...');
  const validationService = new WidgetValidationService();
  const validationResult = await validationService.validateConfig(config);

  if (!validationResult.isValid) {
    console.error('Marketrix Widget validation failed:', validationResult.error);
    showWidgetSettingsLoader(
      validationResult.error || 'Widget validation failed. Please check your configuration.'
    );
    return;
  }

  // Initialize with validated config
  let finalConfig: MarketrixConfig;
  try {
    finalConfig = await initializeWidgetWithConfig(config, validationResult);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to initialize widget';
    showWidgetSettingsLoader(errorMessage);
    return;
  }

  setCurrentConfig(finalConfig);
  const { mountEl } = createWidgetContainer();
  const instance = mountWidget(mountEl, finalConfig);
  setWidgetInstance(instance);
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
export type { InstructionType } from './sdk';
export type { ChatMessage, MarketrixConfig, WidgetState } from './types';

// Export default for ES modules
export default {
  initMarketrixWidget,
  destroyMarketrixWidget,
  updateMarketrixConfig,
  getCurrentConfig,
};
