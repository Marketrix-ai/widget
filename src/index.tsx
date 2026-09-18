/**
 * Public entry point of `@marketrix.ai/widget`: the imperative lifecycle API, the
 * `MarketrixWidgetPreview` dashboard wrapper, and the script-tag auto-init hook. `README.md` is the
 * customer-facing surface these exports make up.
 *
 * `initWidget` mounts the widget into a shadow-DOM container, coalescing concurrent calls onto one
 * in-flight init; `unmountWidget` tears everything back down, including the show-mode overlay that lives
 * outside the shadow root; `updateMarketrixConfig` re-mounts with new settings; `mountWidget` picks the
 * preview or live path based on whether settings or credentials were passed. `widget_enabled` is the
 * kill switch — disabled means no chat id, stream or recording is created at all. Auto-init runs on
 * import, guarded so the package stays importable during a server render.
 */

declare global {
  interface Window {
    __mtx?: { state?: 'initializing' | 'active' } | undefined;
  }
}

import React, { useEffect, useRef } from 'react';
import type { Root } from 'react-dom/client';

import { configureSdk } from './sdk';
import { chatSessionManager } from './services/ChatSessionManager';
import { RrwebSessionRecorder } from './services/RrwebSessionRecorder';
import { stopScreenShare } from './services/ScreenShareService';
import { showModeService } from './services/ShowModeService';
import { type CredentialedConfig, storageService } from './services/StorageService';
import { streamClient } from './services/StreamClient';
import { createConfigFromSettings, loadWidgetConfig } from './services/WidgetService';
import type {
  AddWidgetConfig,
  ClientOwnedConfig,
  MarketrixConfig,
  MarketrixWidgetPreviewProps,
  ValidWidgetConfig,
  WidgetSettingsData,
} from './types';
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
import { errorMessage } from './utils/errors';
import { logWarn } from './utils/log';
import { invalidSettingsMessage, isHTMLElement, parseWidgetSettings } from './utils/validation';

let initPromise: Promise<void> | null = null;
let lifecycleGeneration = 0;
let rrwebSessionRecorder: RrwebSessionRecorder | null = null;

function previewConfig(
  settings: WidgetSettingsData,
  baseConfig: Partial<MarketrixConfig> = {},
): ValidWidgetConfig | null {
  const parsed = parseWidgetSettings(settings);
  if (parsed.invalidFields) {
    console.error(`Marketrix Widget: ${invalidSettingsMessage(parsed.invalidFields)}`);
    return null;
  }
  return { ...createConfigFromSettings(parsed.settings, baseConfig), isPreviewMode: true };
}

function mount(config: ValidWidgetConfig, host: HTMLElement | undefined, previewMode = false): void {
  const { container, mountEl } = createWidgetContainer(host, config.styleNonce);
  const instance = mountWidgetToContainer(mountEl, config, previewMode);
  widgetState.mount = { instance, config, container, host, previewMode };
}

async function initWidgetInternal(
  config: MarketrixConfig,
  container: HTMLElement | undefined,
  generation: number,
): Promise<void> {
  window.__mtx = { state: 'initializing' };

  showHostPageNotice('Loading widget settings...');
  let finalConfig: CredentialedConfig;
  try {
    configureSdk(config.mtxApiHost ?? '');
    finalConfig = await loadWidgetConfig(config);
  } catch (error) {
    if (generation !== lifecycleGeneration) return;
    console.error('Marketrix Widget initialization failed:', error);
    showHostPageNotice(errorMessage(error, 'Failed to initialize widget'), 'error');
    window.__mtx = undefined;
    return;
  }
  if (generation !== lifecycleGeneration) return;
  hideHostPageNotice();

  if (!finalConfig.widget_enabled) {
    window.__mtx = undefined;
    return;
  }

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

  if (window.__mtx?.state) return Promise.resolve();
  if (isWidgetInitialized()) {
    logWarn('Marketrix Widget: already initialized');
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
  streamClient.disconnect();
  rrwebSessionRecorder?.stop();
  rrwebSessionRecorder = null;
  stopScreenShare();
  showModeService.cleanup();

  const active = widgetState.mount;
  widgetState.mount = null;
  if (active) {
    active.instance.unmount();
    active.container.remove();
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

export const MarketrixWidgetPreview: React.FC<MarketrixWidgetPreviewProps> = ({ settings, container }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<Root | null>(null);
  const widgetContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const parentContainer = container ?? containerRef.current ?? document.body;

    if (!parentContainer || !isHTMLElement(parentContainer)) {
      console.error('MarketrixWidgetPreview: Invalid container');
      return;
    }

    const config = previewConfig(settings);
    if (!config) return;

    const { container: widgetContainer, mountEl } = createWidgetContainer(parentContainer, config.styleNonce);

    widgetContainerRef.current = widgetContainer;

    rootRef.current = mountWidgetToContainer(mountEl, config, true);

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
    const { settings: _settings, container: _container, ...restConfig } = config;
    const previewed = previewConfig(config.settings, restConfig);
    if (!previewed) return;
    unmountWidget();
    mount(previewed, container, true);
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
  MarketrixWidgetPreviewProps,
  WidgetSettingsData,
  WidgetState,
} from './types';

export default {
  MarketrixWidgetPreview,
  mountWidget,
  initWidget,
  unmountWidget,
  updateMarketrixConfig,
  getCurrentConfig,
};
