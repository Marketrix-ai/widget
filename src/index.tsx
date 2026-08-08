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
import { chatSessionManager } from './services/ChatSessionManager';
import { createConfigFromSettings } from './services/ConfigManager';
import { RrwebSessionRecorder } from './services/RrwebSessionRecorder';
import { StreamClient } from './services/StreamClient';
import { validateConfig } from './services/ValidationService';
import { fetchWidgetSettings, getWidgetSettings } from './services/WidgetService';
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

let initPromise: Promise<void> | null = null;
let rrwebSessionRecorder: RrwebSessionRecorder | null = null;
let widgetMounted = false;

async function initializeWidgetWithConfig(
  config: MarketrixConfig,
  validationResult: { isValid: boolean; error?: string },
): Promise<MarketrixConfig> {
  if (!validationResult.isValid) {
    throw new Error(validationResult.error || 'Widget validation failed');
  }

  showWidgetSettingsLoader('Loading widget settings...');
  try {
    const widgetData = await fetchWidgetSettings(config.mtxId, config.mtxKey);
    const widgetSettings = widgetData ? getWidgetSettings(widgetData) : null;

    if (!widgetSettings) {
      throw new Error('Widget settings request did not return settings');
    }

    const requiredSettings = [
      'widget_enabled',
      'widget_appearance',
      'widget_position',
      'widget_device',
      'widget_header',
      'widget_body',
      'widget_greeting',
      'widget_greeting_toast',
      'widget_recording',
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

    return { ...createConfigFromSettings(widgetSettings, config), mtxApp: widgetData?.application_id ?? config.mtxApp };
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

  window.__mtx = { state: 'initializing' };

  if (config.mtxApiHost) {
    configureSdk(config.mtxApiHost);
  }

  showWidgetSettingsLoader('Validating widget configuration...');
  const validationResult = await validateConfig(config);

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
  widgetMounted = true;

  if (finalConfig.widget_recording && finalConfig.mtxApp) {
    void StreamClient.getInstance()
      .waitUntilRegistered()
      .then(async () => {
        if (!widgetMounted) return;
        const chatId = await chatSessionManager.getOrCreateChatId();
        if (!widgetMounted) return;
        rrwebSessionRecorder = new RrwebSessionRecorder(chatId, finalConfig.mtxApp as number);
        await rrwebSessionRecorder.start();
      })
      .catch(error => console.error('Failed to start session recording:', error));
  }
}

export const initWidget = async (config: MarketrixConfig, container?: HTMLElement): Promise<void> => {
  // window-level guard survives ES module re-execution, which resets module-level vars.
  if (window.__mtx?.state) {
    return;
  }
  if (initPromise) {
    return initPromise;
  }
  if (isWidgetInitialized()) {
    console.warn('Marketrix Widget: already initialized');
    return;
  }

  // Assign before awaiting so concurrent callers see the promise, not null.
  initPromise = initWidgetInternal(config, container);
  try {
    await initPromise;
  } finally {
    initPromise = null;
  }
};

export const unmountWidget = (): void => {
  widgetMounted = false;
  rrwebSessionRecorder?.stop();
  rrwebSessionRecorder = null;
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

  initPromise = null;
  window.__mtx = undefined;

  hideWidgetSettingsLoader();
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

// Preview-mode React entry point — mounts its own shadow DOM inside the parent container.
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

    const {
      container: widgetContainer,
      shadowRoot,
      mountEl,
    } = createWidgetContainer(parentContainer as HTMLElement, containerIdRef.current);

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
      <WidgetProviders previewMode portalContainer={shadowRoot}>
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

  // An explicit container is mounted into by the effect; otherwise render a mount point.
  if (container) {
    return null;
  }

  return <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }} />;
};

export const mountWidget = async (config: AddWidgetConfig): Promise<void> => {
  setProgrammaticInitInProgress(true);

  const container = config.container;

  if ('settings' in config && config.settings !== undefined) {
    // Preview: no network, and deliberately no global production instance.
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
  } else {
    setProgrammaticInitInProgress(false);
    throw new Error('Invalid configuration: provide either settings (preview) or mtxId+mtxKey (production)');
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
};
