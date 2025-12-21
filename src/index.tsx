import React, { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { MarketrixWidget as MarketrixWidgetComponent } from './components/MarketrixWidget';
import { updateApiConfig } from './constants/config';
import { WidgetProvider } from './context/WidgetContext';
import { configureSdk, type WidgetSettingsData } from './sdk';
import { createConfigFromSettings } from './services/ConfigManager';
import { IntegrationService } from './services/IntegrationService';
import { WidgetValidationService } from './services/ValidationService';
import type { AddWidgetConfig, MarketrixConfig, MarketrixWidgetProps } from './types';
import {
  clearWidgetState,
  createWidgetContainer,
  destroyWidgetContainer,
  getCurrentConfig,
  getWidgetInstance,
  hideWidgetSettingsLoader,
  isWidgetInitialized,
  mountWidgetToContainer,
  registerAutoInit,
  setCurrentConfig,
  setWidgetInstance,
  showWidgetSettingsLoader,
} from './utils/bootstrap';
import { isHTMLElement } from './utils/validation';

// CSS is NOT imported globally here to prevent conflicts with the host app's Tailwind CSS.
// All widget CSS is isolated in Shadow DOM via bootstrap.tsx using 'index.css?inline'.
// This ensures the widget's Tailwind CSS doesn't interfere with the app's responsive breakpoints.

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
    const integrationService = new IntegrationService(config.mtxId, config.mtxKey, config.mtxApp);

    const integrationData = await integrationService.fetchIntegrationSettings();
    const integrationSettings = integrationData
      ? integrationService.getWidgetSettings(integrationData)
      : null;

    // API should always return settings (including defaults), but handle fallback just in case
    if (integrationSettings) {
      return createConfigFromSettings(integrationSettings, config);
    }
    // Fallback: if API didn't return settings, use empty settings
    // This should rarely happen as API now returns defaults for widget searches
    return createConfigFromSettings({} as WidgetSettingsData, config);
  } catch (err) {
    console.error('Error fetching integration settings:', err);
    return createConfigFromSettings({} as WidgetSettingsData, config);
  } finally {
    hideWidgetSettingsLoader();
  }
}

// Initialize the widget
export const initWidget = async (
  config: MarketrixConfig,
  container?: HTMLElement
): Promise<void> => {
  // Prevent double initialization
  if (isWidgetInitialized()) {
    console.warn('Marketrix Widget: already initialized');
    return;
  }

  // Configure SDK and global config BEFORE validation
  if (config.mtxApiHost || config.mtxAiHost) {
    if (config.mtxApiHost) {
      configureSdk(config.mtxApiHost);
    }
    updateApiConfig(config.mtxApiHost, config.mtxAiHost);
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
  // Generate unique container ID for this widget instance (Bug 2 fix)
  const containerId = `marketrix-widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const { mountEl } = createWidgetContainer(container, containerId);
  const instance = mountWidgetToContainer(mountEl, finalConfig);
  setWidgetInstance(instance);
};

// Destroy the widget
export const unmountWidget = (): void => {
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
    const currentConfig = getCurrentConfig();
    if (!currentConfig) {
      throw new Error('Widget not initialized');
    }
    const updatedConfig = { ...currentConfig, ...newConfig };
    unmountWidget();
    await initWidget(updatedConfig);
  }
};

// Re-export lifecycle config getter (no wrapper / no alias)
export { getCurrentConfig };

/**
 * MarketrixWidget - React component for preview mode
 * Renders widget into parent container with shadow DOM
 */
export const MarketrixWidget: React.FC<MarketrixWidgetProps> = ({ settings, container }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<Root | null>(null);
  const widgetContainerRef = useRef<HTMLElement | null>(null);
  const containerIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Determine where to mount
    const parentContainer = container ?? containerRef?.current?.parentElement ?? document.body;

    if (!parentContainer || !isHTMLElement(parentContainer)) {
      console.error('MarketrixWidget: Invalid container');
      return;
    }

    // Generate unique container ID for this widget instance (Bug 2 fix)
    if (!containerIdRef.current) {
      containerIdRef.current = `marketrix-widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Create container and shadow DOM with unique ID
    const { container: widgetContainer, mountEl } = createWidgetContainer(
      parentContainer as HTMLElement,
      containerIdRef.current
    );

    widgetContainerRef.current = widgetContainer;

    // Create config from settings
    // If settings are provided, this is preview mode
    const config = {
      ...createConfigFromSettings(settings),
      isPreviewMode: true, // Settings provided = preview mode
    };

    // Unmount existing root if it exists (handles settings changes)
    if (rootRef.current) {
      rootRef.current.unmount();
      rootRef.current = null;
    }

    // Mount widget
    const root = createRoot(mountEl);
    rootRef.current = root;

    root.render(
      <React.StrictMode>
        <WidgetProvider>
          <MarketrixWidgetComponent config={config} />
        </WidgetProvider>
      </React.StrictMode>
    );

    return () => {
      // Cleanup
      if (rootRef.current) {
        rootRef.current.unmount();
        rootRef.current = null;
      }
      if (widgetContainerRef.current) {
        destroyWidgetContainer(widgetContainerRef.current);
        widgetContainerRef.current = null;
        containerIdRef.current = null;
      }
    };
  }, [settings, container]);

  // If container is provided, return null (mounting handled in useEffect)
  // Otherwise, return a div that will be mounted into its parent
  if (container) {
    return null;
  }

  return <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }} />;
};

/**
 * addWidget - Function that auto-detects mode and initializes widget
 * Supports preview, production, and dev modes
 */
export const mountWidget = async (config: AddWidgetConfig): Promise<void> => {
  const container = config.container;

  // Detect mode based on provided config
  if ('settings' in config && config.settings !== undefined) {
    // Preview mode: use settings directly, skip API calls
    const previewConfig = config as Extract<AddWidgetConfig, { settings: WidgetSettingsData }>;
    const { settings, container: _container, ...restConfig } = previewConfig;
    const finalConfig = createConfigFromSettings(settings, restConfig);
    setCurrentConfig(finalConfig);
    // Generate unique container ID for this widget instance (Bug 2 fix)
    const containerId = `marketrix-widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const { mountEl } = createWidgetContainer(container, containerId);
    const instance = mountWidgetToContainer(mountEl, finalConfig);
    setWidgetInstance(instance);
  } else if ('mtxId' in config && config.mtxId !== undefined && config.mtxKey !== undefined) {
    // Production mode: use marketrix credentials
    const prodConfig = config as Extract<AddWidgetConfig, { mtxId: string; mtxKey: string }>;
    const { mtxId, mtxKey, container: _container, ...restConfig } = prodConfig;
    await initWidget(
      {
        mtxId,
        mtxKey,
        ...restConfig,
      },
      container
    );
  } else if ('mtxApp' in config && config.mtxApp !== undefined && config.mtxAgent !== undefined) {
    // Dev mode: use agent and connection IDs
    const devConfig = config as Extract<AddWidgetConfig, { mtxApp: number; mtxAgent: number }>;
    const { mtxApp, mtxAgent, container: _container, ...restConfig } = devConfig;
    await initWidget(
      {
        mtxApp,
        mtxAgent,
        ...restConfig,
      },
      container
    );
  } else {
    throw new Error(
      'Invalid configuration: provide either settings (preview), mtxId+mtxKey (production), or mtxApp+mtxAgent (dev)'
    );
  }
};

// Register auto-initialization - deferred to avoid breaking Next.js SSR
// This runs only in browser environment after module is loaded
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // Use setTimeout to defer execution and ensure exports are available first
  setTimeout(() => {
    try {
      registerAutoInit(initWidget);
    } catch (error) {
      // Silently fail if auto-init registration fails (e.g., during SSR)
      console.debug('Marketrix Widget: Auto-init registration skipped', error);
    }
  }, 0);
}

// Export types for external use
export type { InstructionType } from './sdk';
export type {
  AddWidgetConfig,
  ChatMessage,
  MarketrixConfig,
  MarketrixWidgetProps,
  WidgetState,
} from './types';

// Export default for ES modules
export default {
  MarketrixWidget,
  mountWidget,
  initWidget,
  unmountWidget,
  updateMarketrixConfig,
  getCurrentConfig,
};
