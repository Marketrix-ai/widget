/**
 * The widget's mount lifecycle behind `index.tsx`: the closed-shadow host, the React root, the one live
 * widget, and the script-tag auto-init path.
 *
 * `renderWidget` renders one widget into its own closed shadow root and returns its teardown.
 * `initWidget` resolves credentials and mounts, coalescing concurrent calls; `mountPreview` mounts settings
 * with no api; `unmountWidget` tears everything down, including the show-mode overlay outside the shadow
 * root; `updateMarketrixConfig` re-mounts with new client options. `showHostPageNotice` toasts before the
 * widget exists. `window.__mtx` marks a live widget and survives the module executing twice.
 * `widget_enabled` false creates no chat id, stream or recording. `mtx-api-host` has no default, since an
 * unset host would silently post widget traffic at the host page's own origin.
 */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { NotificationProvider, WidgetNotifications } from './components/blocks/Notifications';
import { WidgetRoot } from './components/WidgetRoot';
import { WidgetProviders } from './context/WidgetProviders';
import type { NotificationTone } from './design-system/component-tokens';
import shadowStyles from './index.css?inline';
import { configureSdk } from './sdk';
import { getOrCreateChatId } from './services/chatSession';
import { RrwebSessionRecorder } from './services/RrwebSessionRecorder';
import { stopScreenShare } from './services/ScreenShareService';
import { showModeService } from './services/ShowModeService';
import { scopeStorageTo } from './services/StorageService';
import { streamClient } from './services/StreamClient';
import {
  type CredentialedConfig,
  invalidSettingsMessage,
  loadWidgetConfig,
  parseWidgetSettings,
} from './services/WidgetService';
import type { ClientOwnedConfig, MarketrixConfig, ValidWidgetConfig, WidgetSettingsData } from './types';
import { WIDGET_SHADOW_HOST_CLASS } from './utils/dom';
import { errorMessage } from './utils/errors';

declare global {
  interface Window {
    __mtx?: { state: 'initializing' | 'active' } | undefined;
  }
}

interface ActiveWidget {
  config: ValidWidgetConfig;
  input: MarketrixConfig | undefined;
  host: HTMLElement | undefined;
  unmount: () => void;
}

let active: ActiveWidget | null = null;
let initPromise: Promise<void> | null = null;
let lifecycleGeneration = 0;
let rrwebSessionRecorder: RrwebSessionRecorder | null = null;
let noticeRoot: Root | null = null;

const attachShadowMount = (container: HTMLElement, mountId: string, styleNonce?: string | undefined) => {
  const shadowRoot = container.attachShadow({ mode: 'closed' });

  const styleEl = document.createElement('style');
  if (styleNonce) styleEl.nonce = styleNonce;
  styleEl.textContent = shadowStyles;
  shadowRoot.appendChild(styleEl);

  const mountEl = document.createElement('div');
  mountEl.id = mountId;
  shadowRoot.appendChild(mountEl);

  return { shadowRoot, mountEl };
};

export function renderWidget(config: ValidWidgetConfig, host?: HTMLElement): () => void {
  const container = document.createElement('div');
  container.className = WIDGET_SHADOW_HOST_CLASS;
  container.style.pointerEvents = 'auto';
  if (host) {
    Object.assign(container.style, { width: '100%', height: '100%', position: 'relative', overflow: 'visible' });
  }
  (host ?? document.body).appendChild(container);

  const { mountEl } = attachShadowMount(container, 'marketrix-widget-root', config.styleNonce);
  Object.assign(mountEl.style, { pointerEvents: 'auto', width: '100%', height: '100%', position: 'relative' });

  const root = createRoot(mountEl);
  root.render(
    <React.StrictMode>
      <WidgetProviders config={config}>
        <WidgetRoot />
      </WidgetProviders>
    </React.StrictMode>,
  );
  return () => {
    root.unmount();
    container.remove();
  };
}

function mountActive(config: ValidWidgetConfig, host: HTMLElement | undefined, input?: MarketrixConfig): void {
  active = { config, input, host, unmount: renderWidget(config, host) };
  window.__mtx = { state: 'active' };
}

export function previewConfig(
  settings: WidgetSettingsData,
  baseConfig: ClientOwnedConfig = {},
): ValidWidgetConfig | null {
  const parsed = parseWidgetSettings(settings);
  if (parsed.invalidFields) {
    console.error(`Marketrix Widget: ${invalidSettingsMessage(parsed.invalidFields)}`);
    return null;
  }
  return { ...baseConfig, ...parsed.settings, isPreviewMode: true };
}

export function mountPreview(config: ValidWidgetConfig, host: HTMLElement | undefined): void {
  unmountWidget();
  mountActive(config, host);
}

async function startRecording(config: CredentialedConfig, generation: number): Promise<void> {
  const chatId = await getOrCreateChatId();
  if (generation !== lifecycleGeneration) return;
  const recorder = new RrwebSessionRecorder(chatId, config.mtxApp);
  rrwebSessionRecorder = recorder;
  await recorder.start();
  if (generation !== lifecycleGeneration) {
    recorder.stop();
    if (rrwebSessionRecorder === recorder) rrwebSessionRecorder = null;
  }
}

async function initWidgetInternal(config: MarketrixConfig, host: HTMLElement | undefined, generation: number) {
  window.__mtx = { state: 'initializing' };

  showHostPageNotice('Loading widget settings...');
  let finalConfig: CredentialedConfig;
  try {
    configureSdk(config.mtxApiHost);
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

  scopeStorageTo(finalConfig);
  streamClient.setCredentials({ marketrix_id: finalConfig.mtxId, marketrix_key: finalConfig.mtxKey });
  mountActive(finalConfig, host, config);

  if (finalConfig.widget_recording) {
    startRecording(finalConfig, generation).catch((error: unknown) => {
      if (generation === lifecycleGeneration) console.error('Failed to start session recording:', error);
    });
  }
}

export const initWidget = (config: MarketrixConfig, host?: HTMLElement): Promise<void> => {
  if (initPromise) return initPromise;
  if (window.__mtx) return Promise.resolve();

  const generation = ++lifecycleGeneration;
  const pending = initWidgetInternal(config, host, generation).finally(() => {
    if (initPromise === pending) initPromise = null;
  });
  initPromise = pending;
  return pending;
};

export const unmountWidget = (): void => {
  lifecycleGeneration++;
  rrwebSessionRecorder?.stop();
  rrwebSessionRecorder = null;
  streamClient.disconnect();
  stopScreenShare();
  showModeService.cleanup();

  active?.unmount();
  active = null;
  initPromise = null;
  window.__mtx = undefined;

  hideHostPageNotice();
};

export const updateMarketrixConfig = async (newConfig: Partial<MarketrixConfig>): Promise<void> => {
  if (!active) return;
  const { config, input, host } = active;
  unmountWidget();
  if (input) await initWidget({ ...input, ...newConfig }, host);
  else mountActive({ ...config, ...newConfig }, host);
};

export const getCurrentConfig = (): ValidWidgetConfig | null => active?.config ?? null;

function showHostPageNotice(message: string, tone: NotificationTone = 'neutral'): void {
  hideHostPageNotice();

  const noticeContainer = document.createElement('div');
  noticeContainer.id = 'marketrix-widget-notice-container';
  noticeContainer.className = 'marketrix-widget-notice-container';
  document.body.appendChild(noticeContainer);

  const { mountEl } = attachShadowMount(noticeContainer, 'marketrix-widget-notice-root');

  noticeRoot = createRoot(mountEl);
  noticeRoot.render(
    <React.StrictMode>
      <NotificationProvider container={mountEl}>
        <WidgetNotifications
          error={tone === 'error' ? message : undefined}
          onClearError={hideHostPageNotice}
          greeting={tone === 'error' ? undefined : message}
          onGreetingDismiss={hideHostPageNotice}
        />
      </NotificationProvider>
    </React.StrictMode>,
  );
}

function hideHostPageNotice(): void {
  noticeRoot?.unmount();
  noticeRoot = null;
  document.getElementById('marketrix-widget-notice-container')?.remove();
}

export const autoInitializeWidget = (): void => {
  if (window.__mtx) return;

  const scripts = document.querySelectorAll('script[mtx-id]');
  const script = scripts[scripts.length - 1];
  if (!(script instanceof HTMLScriptElement)) return;

  const mtxId = script.getAttribute('mtx-id');
  const mtxKey = script.getAttribute('mtx-key');
  const mtxApiHost = script.getAttribute('mtx-api-host');

  if (!mtxId || !mtxKey || !mtxApiHost) {
    console.error('[AutoInit] Missing required attributes:', {
      hasMtxId: !!mtxId,
      hasMtxKey: !!mtxKey,
      hasMtxApiHost: !!mtxApiHost,
    });
    showHostPageNotice('Please configure mtx-id, mtx-key and mtx-api-host', 'error');
    return;
  }

  const config: MarketrixConfig = { mtxId, mtxKey, mtxApiHost };
  if (script.getAttribute('mtx-use-screenshare') === 'false') config.use_screenshare = false;
  const styleNonce = script.getAttribute('mtx-style-nonce');
  if (styleNonce) config.styleNonce = styleNonce;

  initWidget(config).catch(error => console.error('[AutoInit] Failed to initialize widget:', error));
};
