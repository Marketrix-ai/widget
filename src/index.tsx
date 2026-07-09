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
import type { RrwebSessionRecorder } from './services/RrwebSessionRecorder';
import { ValidationService } from './services/ValidationService';
import { WidgetService } from './services/WidgetService';
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
  setProgrammaticInitInProgress,
  setWidgetInstance,
  showWidgetSettingsLoader,
} from './utils/bootstrap';
import { isHTMLElement } from './utils/validation';

// CSS is not imported globally — it's isolated in Shadow DOM via bootstrap.tsx ('index.css?inline')
// so the widget's Tailwind doesn't collide with the host app's.

// Session recording disabled: the recorder is never auto-started. These remain so the public
// startRecording/stopRecording/getRecordingState API still compiles.
let rrwebSessionRecorder: RrwebSessionRecorder | null = null;
let recordingStartPromise: Promise<void> | null = null; // in-flight start() — guards concurrent starts, enables safe teardown
let initPromise: Promise<void> | null = null; // guards concurrent initWidget() calls from duplicating widgets

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

    const widgetData = await widgetService.widgetSettingsGet();
    const widgetSettings = widgetData ? widgetService.getWidgetSettings(widgetData) : null;

    if (!widgetSettings) {
      throw new Error('WidgetService did not return widget settings');
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

// Call only via initWidget(), which guards with initPromise.
async function initWidgetInternal(config: MarketrixConfig, container?: HTMLElement): Promise<void> {
  setProgrammaticInitInProgress(true);

  // window-level guard survives ES module re-execution
  window.__mtx = { state: 'initializing' };

  if (config.mtxApiHost) {
    configureSdk(config.mtxApiHost);
  }

  showWidgetSettingsLoader('Validating widget configuration...');
  const validationService = new ValidationService();
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
  const { mountEl } = createWidgetContainer(container);
  const instance = mountWidgetToContainer(mountEl, finalConfig);
  setWidgetInstance(instance);
  setProgrammaticInitInProgress(false);
  window.__mtx = { state: 'active' };

  // Session recording intentionally disabled: recorder is never auto-started, so no rrweb/* is sent.
}

export const initWidget = async (config: MarketrixConfig, container?: HTMLElement): Promise<void> => {
  // window-level guard survives ES module re-execution (fresh module-level vars)
  if (window.__mtx?.state) {
    return;
  }
  // concurrent callers await the in-flight init instead of starting a duplicate
  if (initPromise) {
    return initPromise;
  }
  if (isWidgetInitialized()) {
    console.warn('Marketrix Widget: already initialized');
    return;
  }

  // set promise first so concurrent callers always get Promise<void>, not null
  initPromise = initWidgetInternal(config, container);
  try {
    await initPromise;
  } finally {
    initPromise = null;
  }
};

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

  // stops recording only if started manually via startRecording() (auto-start is disabled → usually a no-op)
  if (rrwebSessionRecorder) {
    rrwebSessionRecorder.stop();
    rrwebSessionRecorder = null;
    recordingStartPromise = null;
    console.log('[Marketrix Widget] Session recording stopped');
  }

  initPromise = null;
  window.__mtx = undefined;

  hideWidgetSettingsLoader();
};

// Stops recording without unmounting; keeps the recorder instance so startRecording() can resume.
export const stopRecording = (): void => {
  if (!rrwebSessionRecorder) return;
  rrwebSessionRecorder.stop();
  console.log('[Marketrix Widget] Session recording stopped (toggle)');
};

// Safe to call while a start is in-flight — awaits the pending start instead of racing a concurrent one.
// Throws if the recorder was never created (e.g. missing mtxApiHost/mtxApp).
export const startRecording = async (): Promise<void> => {
  if (!rrwebSessionRecorder) {
    throw new Error('Session recording not available. Ensure the widget is initialized with mtxApiHost and mtxApp.');
  }
  // an in-flight start (auto-start or previous call) — wait for it, then bail if it left us active
  if (recordingStartPromise) {
    await recordingStartPromise.catch(() => {});
    if (rrwebSessionRecorder?.isActive()) return;
  }
  if (rrwebSessionRecorder.isActive()) return;

  const promise = rrwebSessionRecorder.start();
  recordingStartPromise = promise;
  try {
    await promise;
  } finally {
    if (recordingStartPromise === promise) recordingStartPromise = null;
  }
};

export const getRecordingState = (): boolean => {
  return rrwebSessionRecorder?.isActive() ?? false;
};

export const updateMarketrixConfig = async (newConfig: Partial<MarketrixConfig>): Promise<void> => {
  if (isWidgetInitialized()) {
    const currentConfig = getCurrentConfig();
    if (!currentConfig) {
      throw new Error('Widget not initialized');
    }
    const updatedConfig = { ...currentConfig, ...newConfig };
    unmountWidget();
    await initWidget(updatedConfig);
  }
};

export { getCurrentConfig };

// Preview-mode React component: renders the widget into a parent container with its own shadow DOM.
export const MarketrixWidget: React.FC<MarketrixWidgetProps> = ({ settings, container, mtxId, mtxKey, mtxApiHost }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<Root | null>(null);
  const widgetContainerRef = useRef<HTMLElement | null>(null);
  const containerIdRef = useRef<string | null>(null);

  useEffect(() => {
    const parentContainer = container ?? containerRef?.current?.parentElement ?? document.body;

    if (!parentContainer || !isHTMLElement(parentContainer)) {
      console.error('MarketrixWidget: Invalid container');
      return;
    }

    if (!containerIdRef.current) {
      containerIdRef.current = `marketrix-widget-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }

    const { container: widgetContainer, mountEl } = createWidgetContainer(
      parentContainer as HTMLElement,
      containerIdRef.current,
    );

    widgetContainerRef.current = widgetContainer;

    const config = {
      ...createConfigFromSettings(settings, {
        mtxId,
        mtxKey,
        mtxApiHost,
      }),
      isPreviewMode: true,
      widget_enabled: settings.widget_enabled ?? true,
    };

    if (rootRef.current) {
      rootRef.current.unmount();
      rootRef.current = null;
    }

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

  // with an explicit container the useEffect mounts into it; otherwise render a mount-point div
  if (container) {
    return null;
  }

  return <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }} />;
};

export const mountWidget = async (config: AddWidgetConfig): Promise<void> => {
  setProgrammaticInitInProgress(true);

  const container = config.container;

  if ('settings' in config && config.settings !== undefined) {
    // preview mode: standalone, no API/network ops, doesn't set the global production instance
    const previewConfig = config as Extract<AddWidgetConfig, { settings: WidgetSettingsData }>;
    const { settings, container: _container, ...restConfig } = previewConfig;
    const finalConfig = {
      ...createConfigFromSettings(settings, restConfig),
      isPreviewMode: true,
    };
    const { mountEl } = createWidgetContainer(container);
    mountWidgetToContainer(mountEl, finalConfig, true);
    setProgrammaticInitInProgress(false);
  } else if ('mtxId' in config && config.mtxId !== undefined && config.mtxKey !== undefined) {
    // production mode: marketrix credentials
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
  } else if ('mtxApp' in config && config.mtxApp !== undefined) {
    // dev mode: application ID
    const devConfig = config as Extract<AddWidgetConfig, { mtxApp: number }>;
    const { mtxApp, container: _container, ...restConfig } = devConfig;
    await initWidget(
      {
        mtxApp,
        ...restConfig,
      },
      container,
    );
  } else {
    setProgrammaticInitInProgress(false);
    throw new Error(
      'Invalid configuration: provide either settings (preview), mtxId+mtxKey (production), or mtxApp (dev)',
    );
  }
};

if (typeof window !== 'undefined') {
  setTimeout(() => {
    try {
      registerAutoInit(initWidget);
    } catch (error) {
      console.debug('Marketrix Widget: Auto-init registration skipped', error);
    }
  }, 0);
}

export type { InstructionType } from './sdk';
export type { AddWidgetConfig, ChatMessage, MarketrixConfig, MarketrixWidgetProps, WidgetState } from './types';

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
