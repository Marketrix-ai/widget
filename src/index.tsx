/**
 * Public entry point of the embeddable widget package (`@marketrix.ai/widget`): the imperative
 * lifecycle API, the React preview component, and the script-tag auto-init hook. Everything a host
 * page or `app` can reach is exported here — the named exports README documents, the public config
 * and message types, `getCurrentConfig` re-exported from `utils/bootstrap`, and the same functions
 * again as a default object.
 *
 * Contents:
 * - `mount` — the one production/imperative-preview mount: builds the shadow-DOM container, renders
 *   into it, and records the live instance in `widgetState.mount`.
 * - `initWidgetInternal` — the production path: configure the SDK, load remote settings, mount, then
 *   optionally start session recording. Call it only through `initWidget()`, which owns the guards.
 * - `initWidget` — guarded, coalescing production entry.
 * - `unmountWidget` — tears down stream, recorder, screen share and the mounted tree.
 * - `updateMarketrixConfig` — re-mounts the live widget with client-owned settings merged in, staying
 *   on whichever path (preview or production) the current mount came from.
 * - `MarketrixWidgetPreview` — React wrapper for the dashboard preview: validates settings, mounts a
 *   preview instance, unmounts it again when `settings`/`container` change.
 * - `mountWidget` — the npm-facing entry, dispatching on config shape: `settings` → preview,
 *   `mtxId` + `mtxKey` → production, neither → throw.
 *
 * Why it is shaped this way:
 * - `configureSdk` runs on the production path only — every preview path mounts directly and never
 *   reaches it. There is no default host, so an unconfigured SDK would resolve each request against
 *   the HOST PAGE's origin.
 * - `widget_enabled` is the kill switch: unlike `show_widget`/`widget_appearance` (hidden but still
 *   initialized), disabled means off — no chat id, no stream, no recording.
 * - `window.__mtx` is the singleton guard because it survives ES-module re-execution, which resets
 *   module-level vars; `initPromise` only coalesces concurrent calls within one module instance.
 * - Every init and every unmount bumps `lifecycleGeneration`, so an init still in flight — or a
 *   recorder that finishes starting after teardown — abandons its work instead of mounting over, or
 *   logging against, a newer lifecycle.
 * - With no `container` prop, `MarketrixWidgetPreview` mounts into the div it renders below, never
 *   into that div's parent: the parent would size the widget to the wrong box and leave the rendered
 *   div an empty, dead sibling.
 * - The `settings` branch of `mountWidget` is preview: no network, and deliberately no global
 *   production instance.
 * - Auto-init runs on import, browser-guarded so the package stays importable from a server render and
 *   deferred a tick so every export exists before `autoInitializeWidget` scans for the host's
 *   `script[mtx-id]` tag; a registration failure logs rather than surfacing as an unhandled error.
 */

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
import { stopScreenShare } from './services/ScreenShareService';
import { type CredentialedConfig, storageService } from './services/StorageService';
import { StreamClient } from './services/StreamClient';
import { createConfigFromSettings, loadWidgetConfig } from './services/WidgetService';
import type {
  AddWidgetConfig,
  ClientOwnedConfig,
  MarketrixConfig,
  MarketrixWidgetPreviewProps,
  ValidWidgetConfig,
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
import { invalidSettingsMessage, isHTMLElement, parseWidgetSettings } from './utils/validation';

let initPromise: Promise<void> | null = null;
let lifecycleGeneration = 0;
let rrwebSessionRecorder: RrwebSessionRecorder | null = null;

function mount(config: ValidWidgetConfig, host: HTMLElement | undefined, previewMode = false): void {
  const { container, mountEl } = createWidgetContainer(host);
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
    showHostPageNotice(error instanceof Error ? error.message : 'Failed to initialize widget', 'error');
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
  stopScreenShare();

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

    const parsed = parseWidgetSettings(settings);
    if (parsed.invalidFields) {
      console.error(`Marketrix Widget: ${invalidSettingsMessage(parsed.invalidFields)}`);
      return;
    }

    const { container: widgetContainer, mountEl } = createWidgetContainer(parentContainer);

    widgetContainerRef.current = widgetContainer;

    rootRef.current = mountWidgetToContainer(
      mountEl,
      { ...createConfigFromSettings(parsed.settings), isPreviewMode: true },
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
    const parsed = parseWidgetSettings(config.settings);
    if (parsed.invalidFields) {
      console.error(`Marketrix Widget: ${invalidSettingsMessage(parsed.invalidFields)}`);
      return;
    }
    unmountWidget();
    const { settings: _settings, container: _container, ...restConfig } = config;
    mount({ ...createConfigFromSettings(parsed.settings, restConfig), isPreviewMode: true }, container, true);
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
