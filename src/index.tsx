import React, { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { MarketrixWidget as MarketrixWidgetComponent } from './components/MarketrixWidget';
import { getEventsWebSocketUrl } from './constants/config';
import { WidgetProvider } from './context/WidgetContext';
import { configureSdk, type WidgetSettingsData } from './sdk';
import { createConfigFromSettings } from './services/ConfigManager';
import { IntegrationService } from './services/IntegrationService';
import { sessionManager } from './services/SessionManager';
import { SessionRecorder } from './services/SessionRecorder';
import { WidgetValidationService } from './services/ValidationService';
import type { AddWidgetConfig, MarketrixConfig, MarketrixWidgetProps } from './types';
import {
  clearWidgetState,
  createWidgetContainer,
  destroyWidgetContainer,
  getCurrentConfig,
  getWidgetInstance,
  hideWidgetSettingsLoader,
  isProductionWidgetActive,
  isWidgetInitialized,
  mountWidgetToContainer,
  registerAutoInit,
  setCurrentConfig,
  setProductionWidgetActive,
  setProgrammaticInitInProgress,
  setWidgetInstance,
  showWidgetSettingsLoader,
} from './utils/bootstrap';
import { isHTMLElement } from './utils/validation';

// CSS is NOT imported globally here to prevent conflicts with the host app's Tailwind CSS.
// All widget CSS is isolated in Shadow DOM via bootstrap.tsx using 'index.css?inline'.
// This ensures the widget's Tailwind CSS doesn't interfere with the app's responsive breakpoints.

// Global session recorder instance
let sessionRecorder: SessionRecorder | null = null;
let isRecordingInitialized = false; // Flag to prevent multiple SessionRecorder instances

/**
 * Initialize widget with validated configuration
 */
async function initializeWidgetWithConfig(
  config: MarketrixConfig,
  validationResult: { isValid: boolean; error?: string },
): Promise<MarketrixConfig> {
  if (!validationResult.isValid) {
    throw new Error(validationResult.error || 'Widget validation failed');
  }

  showWidgetSettingsLoader('Loading widget settings...');
  try {
    const integrationService = new IntegrationService(config.mtxId, config.mtxKey, config.mtxApp);

    const integrationData = await integrationService.fetchIntegrationSettings();
    const integrationSettings = integrationData ? integrationService.getWidgetSettings(integrationData) : null;

    if (!integrationSettings) {
      throw new Error('IntegrationService did not return widget settings');
    }

    // Validate that all required settings fields exist
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
      key => integrationSettings[key as keyof typeof integrationSettings] === undefined,
    );

    if (missingSettings.length > 0) {
      throw new Error(
        `Widget settings are incomplete. Missing required fields: ${missingSettings.join(', ')}. The API must return all widget settings.`,
      );
    }

    return createConfigFromSettings(integrationSettings, config);
  } catch (err) {
    console.error('Error fetching integration settings:', err);
    throw err;
  } finally {
    hideWidgetSettingsLoader();
  }
}

// Initialize the widget
export const initWidget = async (config: MarketrixConfig, container?: HTMLElement): Promise<void> => {
  // Signal that programmatic initialization is in progress
  setProgrammaticInitInProgress(true);

  // Prevent double initialization
  if (isWidgetInitialized()) {
    console.warn('Marketrix Widget: already initialized');
    setProgrammaticInitInProgress(false);
    return;
  }

  // Singleton guard: prevent duplicate production widgets on same page
  if (isProductionWidgetActive()) {
    console.warn('Marketrix Widget: production widget already active on this page, skipping duplicate initialization');
    setProgrammaticInitInProgress(false);
    return;
  }

  // Configure SDK BEFORE validation
  if (config.mtxApiHost) {
    configureSdk(config.mtxApiHost);
  }

  // Validate configuration
  showWidgetSettingsLoader('Validating widget configuration...');
  const validationService = new WidgetValidationService();
  const validationResult = await validationService.validateConfig(config);

  if (!validationResult.isValid) {
    console.error('Marketrix Widget validation failed:', validationResult.error);
    showWidgetSettingsLoader(validationResult.error || 'Widget validation failed. Please check your configuration.');
    setProgrammaticInitInProgress(false);
    return;
  }

  // Initialize with validated config
  let finalConfig: MarketrixConfig;
  try {
    finalConfig = await initializeWidgetWithConfig(config, validationResult);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to initialize widget';
    showWidgetSettingsLoader(errorMessage);
    setProgrammaticInitInProgress(false);
    return;
  }

  setCurrentConfig(finalConfig);
  // Generate unique container ID for this widget instance
  const containerId = `marketrix-widget-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const { mountEl } = createWidgetContainer(container, containerId);
  const instance = mountWidgetToContainer(mountEl, finalConfig);
  setWidgetInstance(instance);
  // Mark production widget as active (singleton guard)
  setProductionWidgetActive(true);
  // Widget successfully initialized, reset flag
  setProgrammaticInitInProgress(false);

  // Initialize and start session recording
  try {
    // CRITICAL: Prevent multiple SessionRecorder instances per session
    if (sessionRecorder && isRecordingInitialized) {
      console.warn(
        '[Marketrix Widget] ⚠️ SessionRecorder already initialized, skipping creation. Reusing existing instance.',
      );
      return;
    }

    // Stop existing recorder if any (shouldn't happen, but safety check)
    if (sessionRecorder) {
      console.warn('[Marketrix Widget] ⚠️ Stopping existing SessionRecorder before creating new one');
      sessionRecorder.stop();
      sessionRecorder = null;
      isRecordingInitialized = false;
    }

    // CRITICAL: Ensure SessionManager is initialized before creating SessionRecorder
    // SessionManager initializes the tab_id in sessionStorage, which SessionRecorder needs
    const tabId = sessionManager.getTabId();
    if (!tabId?.startsWith('tab_')) {
      console.error('[Marketrix Widget] ❌ SessionManager tab_id not initialized correctly:', tabId);
      console.error('[Marketrix Widget] Expected format: tab_*');
      throw new Error(`SessionManager tab_id not initialized. Got: ${tabId}`);
    }
    console.log('[Marketrix Widget] ✅ SessionManager initialized with tab_id:', tabId);

    // Get RRWeb server URL from mtxApiHost config
    // Priority: finalConfig.mtxApiHost > config.mtxApiHost
    const apiHost = finalConfig.mtxApiHost ?? config.mtxApiHost;

    if (!apiHost || apiHost.trim() === '') {
      const error =
        'API host is required for session recording. Please provide mtxApiHost in the widget configuration.';
      console.error('[Marketrix Widget] ❌', error);
      throw new Error(error);
    }

    const wsUrl = getEventsWebSocketUrl(apiHost);

    console.log('[Marketrix Widget] Using RRWeb server URL:', wsUrl);

    // connectionId (mtxApp) is required for RRWeb uploads
    const connectionId = finalConfig.mtxApp ?? config.mtxApp;
    if (!connectionId) {
      console.warn('[Marketrix Widget] ⚠️ No mtxApp (connectionId) configured - skipping session recording');
      return;
    }
    sessionRecorder = new SessionRecorder(wsUrl, connectionId);
    isRecordingInitialized = true; // Mark as initialized

    // Start recording - it will wait for chat_id to be available
    // The recorder will connect but wait to send metadata until chat_id exists
    sessionRecorder.start().catch(error => {
      console.error('[Marketrix Widget] ❌ Failed to start session recording:', error);
      console.error('[Marketrix Widget] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Reset flag on error so retry is possible
      isRecordingInitialized = false;
      // Don't block widget initialization if recording fails, but log the error
      // The recorder will retry when chat_id becomes available (via reconnection)
    });
  } catch (error) {
    console.error('[Marketrix Widget] Failed to initialize session recording:', error);
    isRecordingInitialized = false; // Reset flag on error
    // Don't block widget initialization if recording fails
  }
};

// Register auto-initialization immediately after function definition
// This ensures the function is available when DOM becomes ready
// Destroy the widget
export const unmountWidget = (): void => {
  const instance = getWidgetInstance();
  if (instance) {
    instance.unmount();
    clearWidgetState();

    const container = document.getElementById('marketrix-widget-container');
    if (container) {
      destroyWidgetContainer(container);
    }

    console.log('Marketrix Widget destroyed');
  }

  // Stop session recording
  if (sessionRecorder) {
    sessionRecorder.stop();
    sessionRecorder = null;
    isRecordingInitialized = false; // Reset flag
    console.log('[Marketrix Widget] Session recording stopped');
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
export const MarketrixWidget: React.FC<MarketrixWidgetProps> = ({
  settings,
  container,
  mtxId,
  mtxKey,
  mtxApiHost,
  mtxAiHost,
}) => {
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

    // Generate unique container ID for this widget instance
    if (!containerIdRef.current) {
      containerIdRef.current = `marketrix-widget-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }

    // Create container and shadow DOM with unique ID
    const { container: widgetContainer, mountEl } = createWidgetContainer(
      parentContainer as HTMLElement,
      containerIdRef.current,
    );

    widgetContainerRef.current = widgetContainer;

    // Create config from settings
    // If settings are provided, this is preview mode
    const config = {
      ...createConfigFromSettings(settings, {
        mtxId,
        mtxKey,
        mtxApiHost,
        mtxAiHost,
      }),
      isPreviewMode: true, // Settings provided = preview mode
      widget_enabled: settings.widget_enabled ?? true, // Ensure widget is enabled in preview
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
        <WidgetProvider previewMode>
          <MarketrixWidgetComponent config={config} />
        </WidgetProvider>
      </React.StrictMode>,
    );

    return () => {
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
  // Signal that programmatic initialization is in progress
  setProgrammaticInitInProgress(true);

  const container = config.container;

  // Detect mode based on provided config
  if ('settings' in config && config.settings !== undefined) {
    // Preview mode: use settings directly, skip API calls and network ops
    // Preview widgets are standalone - don't set global instance or production flag
    const previewConfig = config as Extract<AddWidgetConfig, { settings: WidgetSettingsData }>;
    const { settings, container: _container, ...restConfig } = previewConfig;
    const finalConfig = {
      ...createConfigFromSettings(settings, restConfig),
      isPreviewMode: true,
    };
    // Generate unique container ID for this widget instance
    const containerId = `marketrix-widget-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const { mountEl } = createWidgetContainer(container, containerId);
    // Mount with previewMode=true to disable all network operations
    mountWidgetToContainer(mountEl, finalConfig, true);
    // Don't set global widget instance for preview - it's independent
    // Widget successfully initialized, reset flag
    setProgrammaticInitInProgress(false);
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
      container,
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
      container,
    );
  } else {
    setProgrammaticInitInProgress(false);
    throw new Error(
      'Invalid configuration: provide either settings (preview), mtxId+mtxKey (production), or mtxApp+mtxAgent (dev)',
    );
  }
};

// Register auto-initialization (only in browser)
if (typeof window !== 'undefined') {
  setTimeout(() => {
    try {
      registerAutoInit(initWidget);
    } catch (error) {
      console.debug('Marketrix Widget: Auto-init registration skipped', error);
    }
  }, 0);
}

// Export types for external use
export type { InstructionType } from './sdk';
export type { AddWidgetConfig, ChatMessage, MarketrixConfig, MarketrixWidgetProps, WidgetState } from './types';

// Export default for ES modules
export default {
  MarketrixWidget,
  mountWidget,
  initWidget,
  unmountWidget,
  updateMarketrixConfig,
  getCurrentConfig,
};
