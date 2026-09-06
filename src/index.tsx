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
import { type CredentialedConfig, storageService } from './services/StorageService';
import { StreamClient } from './services/StreamClient';
import { createConfigFromSettings, loadWidgetConfig } from './services/WidgetService';
import type { AddWidgetConfig, ClientOwnedConfig, MarketrixConfig, MarketrixWidgetProps } from './types';
import {
  autoInitializeWidget,
  createWidgetContainer,
  getCurrentConfig,
  hideHostPageNotice,
  isWidgetInitialized,
  mountWidgetToContainer,
  showHostPageNotice,
  widgetState,
} from './utils/bootstrap';
import { isHTMLElement } from './utils/validation';

let initPromise: Promise<void> | null = null;
let lifecycleGeneration = 0;
let rrwebSessionRecorder: RrwebSessionRecorder | null = null;

/** The one production/imperative-preview mount. */
function mount(config: MarketrixConfig, host: HTMLElement | undefined, previewMode = false): void {
  const { container, mountEl } = createWidgetContainer(host);
  const instance = mountWidgetToContainer(mountEl, config, previewMode);
  widgetState.mount = { instance, config, container, host, previewMode };
}

// Call only via initWidget(), which guards with initPromise.
async function initWidgetInternal(
  config: MarketrixConfig,
  container: HTMLElement | undefined,
  generation: number,
): Promise<void> {
  window.__mtx = { state: 'initializing' };

  showHostPageNotice('Loading widget settings...');
  let finalConfig: CredentialedConfig;
  try {
    // Production only: every preview path mounts directly and never reaches here. There is no default
    // host, so leaving the SDK unconfigured would resolve each request against the HOST PAGE's origin.
    configureSdk(config.mtxApiHost ?? '');
    finalConfig = await loadWidgetConfig(config);
  } catch (error) {
    if (generation !== lifecycleGeneration) return;
    console.error('Marketrix Widget initialization failed:', error);
    showHostPageNotice(error instanceof Error ? error.message : 'Failed to initialize widget', 'error');
    window.__mtx = undefined;
    return;
  }
  if (generation !== lifecycleGeneration) return;
  hideHostPageNotice();

  storageService.setConfig(finalConfig);
  mount(finalConfig, container);
  window.__mtx = { state: 'active' };

  if (finalConfig.widget_recording && finalConfig.mtxApp) {
    void (async () => {
      try {
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

  const active = widgetState.mount;
  widgetState.mount = null;
  if (active) {
    active.instance.unmount();
    active.container.remove();
    console.log('Marketrix Widget destroyed');
  }

  initPromise = null;
  window.__mtx = undefined;

  hideHostPageNotice();
};

export const updateMarketrixConfig = async (
  newConfig: ClientOwnedConfig & { mtxId?: string; mtxKey?: string },
): Promise<void> => {
  const active = widgetState.mount;
  if (!active) return;

  const { config, host, previewMode } = active;
  const updatedConfig = { ...config, ...newConfig };
  unmountWidget();
  if (previewMode) mount(updatedConfig, host, true);
  else await initWidget(updatedConfig, host);
};

export { getCurrentConfig };

// Preview-mode React entry point — mounts its own shadow DOM inside the parent container.
export const MarketrixWidget: React.FC<MarketrixWidgetProps> = ({ settings, container }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<Root | null>(null);
  const widgetContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const parentContainer = container ?? containerRef?.current?.parentElement ?? document.body;

    if (!parentContainer || !isHTMLElement(parentContainer)) {
      console.error('MarketrixWidget: Invalid container');
      return;
    }

    const { container: widgetContainer, mountEl } = createWidgetContainer(parentContainer);

    widgetContainerRef.current = widgetContainer;

    rootRef.current = mountWidgetToContainer(
      mountEl,
      { ...createConfigFromSettings(settings), isPreviewMode: true },
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
      }
    };
  }, [settings, container]);

  if (container) {
    return null;
  }

  return <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }} />;
};

export const mountWidget = async (config: AddWidgetConfig): Promise<void> => {
  const container = config.container;

  if (config.settings !== undefined) {
    unmountWidget();
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
      autoInitializeWidget(initWidget);
    } catch (error) {
      console.error('Marketrix Widget: Auto-init registration failed', error);
    }
  }, 0);
}

export type { InstructionType } from './sdk';
export type {
  AddWidgetConfig,
  ChatMessage,
  ClientOwnedConfig,
  MarketrixConfig,
  MarketrixWidgetProps,
  WidgetState,
} from './types';

export default {
  MarketrixWidget,
  mountWidget,
  initWidget,
  unmountWidget,
  updateMarketrixConfig,
  getCurrentConfig,
};
