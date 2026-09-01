declare global {
  interface Window {
    __mtx?: { state?: 'initializing' | 'active' };
  }
}

import React, { useEffect, useRef } from 'react';
import type { Root } from 'react-dom/client';

import { configureSdk } from './sdk';
import { chatSessionManager } from './services/ChatSessionManager';
import { RrwebSessionRecorder } from './services/RrwebSessionRecorder';
import { StreamClient } from './services/StreamClient';
import { createConfigFromSettings, loadWidgetConfig } from './services/WidgetService';
import type { AddWidgetConfig, MarketrixConfig, MarketrixWidgetProps } from './types';
import {
  createWidgetContainer,
  getCurrentConfig,
  hideWidgetSettingsLoader,
  isWidgetInitialized,
  mountWidgetToContainer,
  registerAutoInit,
  showWidgetSettingsLoader,
  widgetState,
} from './utils/bootstrap';
import { isHTMLElement } from './utils/validation';

let initPromise: Promise<void> | null = null;
let lifecycleGeneration = 0;
let ownedWidgetContainer: HTMLElement | null = null;
let rrwebSessionRecorder: RrwebSessionRecorder | null = null;

/** The one production/imperative-preview mount: owns the container and the module-global instance. */
function mount(config: MarketrixConfig, container: HTMLElement | undefined, previewMode = false): void {
  const { container: widgetContainer, mountEl } = createWidgetContainer(container);
  ownedWidgetContainer = widgetContainer;
  widgetState.instance = mountWidgetToContainer(mountEl, config, previewMode);
  widgetState.config = config;
  widgetState.programmaticInit = false;
}

// Call only via initWidget(), which guards with initPromise.
async function initWidgetInternal(
  config: MarketrixConfig,
  container: HTMLElement | undefined,
  generation: number,
): Promise<void> {
  widgetState.programmaticInit = true;

  window.__mtx = { state: 'initializing' };

  if (config.mtxApiHost) {
    configureSdk(config.mtxApiHost);
  }

  showWidgetSettingsLoader('Loading widget settings...');
  let finalConfig: MarketrixConfig;
  try {
    finalConfig = await loadWidgetConfig(config);
  } catch (error) {
    if (generation !== lifecycleGeneration) return;
    console.error('Marketrix Widget initialization failed:', error);
    showWidgetSettingsLoader(error instanceof Error ? error.message : 'Failed to initialize widget');
    widgetState.programmaticInit = false;
    window.__mtx = undefined;
    return;
  }
  if (generation !== lifecycleGeneration) return;
  hideWidgetSettingsLoader();

  mount(finalConfig, container);
  window.__mtx = { state: 'active' };

  if (finalConfig.widget_recording && finalConfig.mtxApp) {
    void (async () => {
      try {
        await StreamClient.getInstance().waitUntilRegistered();
        if (generation !== lifecycleGeneration) return;
        const chatId = await chatSessionManager.getOrCreateChatId();
        if (generation !== lifecycleGeneration) return;
        const recorder = new RrwebSessionRecorder(chatId, finalConfig.mtxApp as number);
        rrwebSessionRecorder = recorder;
        await recorder.start();
        if (generation !== lifecycleGeneration) {
          recorder.stop();
          if (rrwebSessionRecorder === recorder) rrwebSessionRecorder = null;
        }
      } catch (error) {
        if (generation === lifecycleGeneration) console.error('Failed to start session recording:', error);
      }
    })();
  }
}

export const initWidget = (config: MarketrixConfig, container?: HTMLElement): Promise<void> => {
  if (initPromise) return initPromise;

  // window-level guard survives ES module re-execution, which resets module-level vars.
  if (window.__mtx?.state) return Promise.resolve();
  if (isWidgetInitialized()) {
    console.warn('Marketrix Widget: already initialized');
    return Promise.resolve();
  }

  const generation = ++lifecycleGeneration;
  const pending = initWidgetInternal(config, container, generation);
  initPromise = pending;
  void pending.then(
    () => {
      if (initPromise === pending) initPromise = null;
    },
    () => {
      if (initPromise === pending) initPromise = null;
    },
  );
  return pending;
};

export const unmountWidget = (): void => {
  lifecycleGeneration++;
  StreamClient.getInstance().disconnect();
  rrwebSessionRecorder?.stop();
  rrwebSessionRecorder = null;
  const instance = widgetState.instance;
  if (instance) instance.unmount();
  widgetState.instance = null;
  widgetState.config = null;

  if (ownedWidgetContainer) {
    ownedWidgetContainer.remove();
    ownedWidgetContainer = null;
  }
  if (instance) console.log('Marketrix Widget destroyed');

  initPromise = null;
  window.__mtx = undefined;
  widgetState.programmaticInit = false;

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

    const { container: widgetContainer, mountEl } = createWidgetContainer(
      parentContainer as HTMLElement,
      containerIdRef.current,
    );

    widgetContainerRef.current = widgetContainer;

    rootRef.current = mountWidgetToContainer(
      mountEl,
      { ...createConfigFromSettings(settings, { mtxId, mtxKey, mtxApiHost }), isPreviewMode: true },
      true,
    );

    return () => {
      if (rootRef.current) {
        rootRef.current.unmount();
        rootRef.current = null;
      }
      if (widgetContainerRef.current) {
        widgetContainerRef.current.remove();
        widgetContainerRef.current = null;
        containerIdRef.current = null;
      }
    };
  }, [settings, container, mtxId, mtxKey, mtxApiHost]);

  if (container) {
    return null;
  }

  return <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }} />;
};

export const mountWidget = async (config: AddWidgetConfig): Promise<void> => {
  const container = config.container;

  if (config.settings !== undefined) {
    unmountWidget();
    widgetState.programmaticInit = true;
    // Preview: no network, and deliberately no global production instance.
    const { settings, container: _container, ...restConfig } = config;
    mount({ ...createConfigFromSettings(settings, restConfig), isPreviewMode: true }, container, true);
  } else if (config.mtxId !== undefined && config.mtxKey !== undefined) {
    const { container: _container, ...restConfig } = config;
    await initWidget(restConfig, container);
  } else {
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
