declare global {
  interface Window {
    __mtx?: { state?: 'initializing' | 'active' };
  }
}

import React, { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { MarketrixWidget as MarketrixWidgetComponent } from './components/MarketrixWidget';
import { WidgetProviders } from './context/WidgetProviders';
import { configureSdk, type WidgetSettingsData } from './sdk';
import { createConfigFromSettings } from './services/ConfigManager';
import { SessionRecorder } from './services/SessionRecorder';
import { storageService } from './services/StorageService';
import { StreamClient } from './services/StreamClient';
import { WidgetValidationService } from './services/ValidationService';
import { WidgetService } from './services/WidgetService';
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
let isRecorderStarting = false; // Flag to prevent concurrent initRecorder() calls
// Tracks in-flight start() promise to prevent concurrent starts and enable safe stop/teardown
let recordingStartPromise: Promise<void> | null = null;
// Prevents concurrent initWidget() calls from creating duplicate widgets
let initPromise: Promise<void> | null = null;
// AbortController for marketrix:chatid listener — abort on unmount to remove listener
let recordingAbortController: AbortController | null = null;

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
    const widgetService = new WidgetService(config.mtxId, config.mtxKey, config.mtxApp);

    const widgetData = await widgetService.fetchWidgetSettings();
    const widgetSettings = widgetData ? widgetService.getWidgetSettings(widgetData) : null;

    if (!widgetSettings) {
      throw new Error('WidgetService did not return widget settings');
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
      key => widgetSettings[key as keyof typeof widgetSettings] === undefined,
    );

    if (missingSettings.length > 0) {
      throw new Error(
        `Widget settings are incomplete. Missing required fields: ${missingSettings.join(', ')}. The API must return all widget settings.`,
      );
    }

    return createConfigFromSettings(widgetSettings, config);
  } catch (err) {
    console.error('Error fetching widget settings:', err);
    throw err;
  } finally {
    hideWidgetSettingsLoader();
  }
}

/**
 * Internal init implementation. Call only via initWidget() which guards with initPromise.
 */
async function initWidgetInternal(config: MarketrixConfig, container?: HTMLElement): Promise<void> {
  setProgrammaticInitInProgress(true);

  if (isWidgetInitialized()) {
    console.warn('Marketrix Widget: already initialized');
    setProgrammaticInitInProgress(false);
    return;
  }

  if (isProductionWidgetActive()) {
    console.warn('Marketrix Widget: production widget already active on this page, skipping duplicate initialization');
    setProgrammaticInitInProgress(false);
    return;
  }

  // Window-level guard survives ES module re-execution
  window.__mtx = { state: 'initializing' };

  if (config.mtxApiHost) {
    configureSdk(config.mtxApiHost);
  }

  showWidgetSettingsLoader('Validating widget configuration...');
  const validationService = new WidgetValidationService();
  const validationResult = await validationService.validateConfig(config);

  if (!validationResult.isValid) {
    console.error('Marketrix Widget validation failed:', validationResult.error);
    showWidgetSettingsLoader(validationResult.error || 'Widget validation failed. Please check your configuration.');
    setProgrammaticInitInProgress(false);
    window.__mtx = undefined;
    return;
  }

  let finalConfig: MarketrixConfig;
  try {
    finalConfig = await initializeWidgetWithConfig(config, validationResult);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to initialize widget';
    showWidgetSettingsLoader(errorMessage);
    setProgrammaticInitInProgress(false);
    window.__mtx = undefined;
    return;
  }

  setCurrentConfig(finalConfig);
  const containerId = `marketrix-widget-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const { mountEl } = createWidgetContainer(container, containerId);
  const instance = mountWidgetToContainer(mountEl, finalConfig);
  setWidgetInstance(instance);
  setProductionWidgetActive(true);
  setProgrammaticInitInProgress(false);
  window.__mtx = { state: 'active' };

  try {
    if (sessionRecorder && isRecordingInitialized) {
      console.warn(
        '[Marketrix Widget] ⚠️ SessionRecorder already initialized, skipping creation. Reusing existing instance.',
      );
      return;
    }

    if (sessionRecorder) {
      console.warn('[Marketrix Widget] ⚠️ Stopping existing SessionRecorder before creating new one');
      sessionRecorder.stop();
      sessionRecorder = null;
      isRecordingInitialized = false;
    }

    recordingAbortController = new AbortController();

    // SessionRecorder now requires chatId at construction (uses HTTP POST).
    // We need both applicationId and chatId before creating the recorder.
    const initRecorder = (applicationId: number, chatId: string) => {
      if (sessionRecorder && isRecordingInitialized) return; // Already initialized
      if (isRecorderStarting) return;
      isRecorderStarting = true;

      try {
        sessionRecorder = new SessionRecorder(chatId, applicationId);
        isRecordingInitialized = true;

        // Start recording immediately — chatId is already available
        const recorder = sessionRecorder;
        recordingStartPromise = recorder
          .start()
          .catch(error => {
            if (sessionRecorder !== recorder) return;
            console.error('[Marketrix Widget] Failed to start session recording:', error);
            isRecordingInitialized = false;
          })
          .finally(() => {
            isRecorderStarting = false;
            if (sessionRecorder !== recorder) return;
            recordingStartPromise = null;
          });
      } catch {
        isRecorderStarting = false;
      }
    };

    const initRecorderWhenChatIdReady = (applicationId: number) => {
      const existingChatId = storageService.getChatId();
      if (existingChatId) {
        console.log('[Marketrix Widget] chat_id already in storage, initializing recorder immediately');
        initRecorder(applicationId, existingChatId);
      } else {
        console.log('[Marketrix Widget] Waiting for chat_id before initializing recorder...');
        window.addEventListener(
          'marketrix:chatid',
          () => {
            const chatId = storageService.getChatId();
            if (chatId) {
              console.log('[Marketrix Widget] chat_id created, initializing recorder');
              initRecorder(applicationId, chatId);
            }
          },
          { once: true, signal: recordingAbortController?.signal },
        );
      }
    };

    const applicationId = finalConfig.mtxApp ?? config.mtxApp;
    if (applicationId) {
      // applicationId available from config
      initRecorderWhenChatIdReady(applicationId);
    } else {
      // applicationId not in config — wait for it from the stream's registered event
      console.log(
        '[Marketrix Widget] No mtxApp (applicationId) in config, waiting for application_id from stream registration...',
      );
      const streamClient = StreamClient.getInstance();
      const callbacks = {
        onRegistered: (applicationId: number | undefined) => {
          if (applicationId) {
            console.log('[Marketrix Widget] Received application_id from stream:', applicationId);
            initRecorderWhenChatIdReady(applicationId);
          } else {
            console.warn('[Marketrix Widget] ⚠️ Stream registered without application_id — cannot start recording');
          }
          streamClient.removeCallbacks(callbacks);
        },
      };
      streamClient.addCallbacks(callbacks);
    }
  } catch (error) {
    console.error('[Marketrix Widget] Failed to initialize session recording:', error);
    isRecordingInitialized = false;
  }
}

// Initialize the widget
let isInitializing = false; // Atomic flag to prevent TOCTOU race condition

export const initWidget = async (config: MarketrixConfig, container?: HTMLElement): Promise<void> => {
  // Window-level guard survives ES module re-execution (fresh module-level vars)
  if (window.__mtx?.state) {
    return;
  }
  // Check for existing initialization or initialization in progress
  if (initPromise) {
    return initPromise;
  }
  if (isInitializing) {
    return Promise.resolve();
  }
  if (isWidgetInitialized()) {
    console.warn('Marketrix Widget: already initialized');
    return;
  }
  if (isProductionWidgetActive()) {
    console.warn('Marketrix Widget: production widget already active on this page, skipping duplicate initialization');
    return;
  }

  // Set promise first so concurrent callers always get Promise<void>, not null
  initPromise = initWidgetInternal(config, container);
  isInitializing = true;
  try {
    await initPromise;
  } finally {
    initPromise = null;
    isInitializing = false;
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

    const container = document.querySelector('.marketrix-widget-container');
    if (container) {
      destroyWidgetContainer(container as HTMLElement);
    }

    console.log('Marketrix Widget destroyed');
  }

  recordingAbortController?.abort();
  recordingAbortController = null;

  // Stop session recording (SessionRecorder.stop() aborts in-flight start via stopRequested)
  if (sessionRecorder) {
    sessionRecorder.stop();
    sessionRecorder = null;
    isRecordingInitialized = false;
    isRecorderStarting = false;
    recordingStartPromise = null;
    console.log('[Marketrix Widget] Session recording stopped');
  }

  initPromise = null;
  window.__mtx = undefined;

  // Also hide loader if present
  hideWidgetSettingsLoader();
};

/**
 * Stop RRWeb session recording without unmounting the widget.
 * Keeps the SessionRecorder instance so recording can be restarted with startRecording().
 * SessionRecorder.stop() aborts in-flight start() via stopRequested.
 */
export const stopRecording = (): void => {
  if (!sessionRecorder) return;
  sessionRecorder.stop();
  console.log('[Marketrix Widget] Session recording stopped (toggle)');
};

/**
 * Start RRWeb session recording. Use after stopRecording() to resume, or when recording was not started on init.
 * Safe to call while auto-start is in-flight — awaits the pending start instead of creating a concurrent one.
 * @throws Error if session recorder was never created (e.g. missing mtxApiHost/mtxApp).
 */
export const startRecording = async (): Promise<void> => {
  if (!sessionRecorder) {
    throw new Error('Session recording not available. Ensure the widget is initialized with mtxApiHost and mtxApp.');
  }
  // If a start is already in-flight (auto-start or previous call), wait for it
  if (recordingStartPromise) {
    await recordingStartPromise.catch(() => {});
    // After it settles, check if recording is already active
    if (sessionRecorder?.isActive()) return;
  }
  // Already recording — no-op (SessionRecorder.start checks too, but avoid the promise tracking overhead)
  if (sessionRecorder.isActive()) return;

  const promise = sessionRecorder.start();
  recordingStartPromise = promise;
  try {
    await promise;
  } finally {
    if (recordingStartPromise === promise) recordingStartPromise = null;
  }
};

/**
 * Returns whether RRWeb session recording is currently active.
 */
export const getRecordingState = (): boolean => {
  return sessionRecorder?.isActive() ?? false;
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
export const MarketrixWidget: React.FC<MarketrixWidgetProps> = ({ settings, container, mtxId, mtxKey, mtxApiHost }) => {
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
      <WidgetProviders previewMode>
        <MarketrixWidgetComponent config={config} />
      </WidgetProviders>,
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
    // Dev mode: use application and agent IDs
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
  startRecording,
  stopRecording,
  getRecordingState,
};
