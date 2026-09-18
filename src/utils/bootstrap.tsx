/**
 * Widget mount plumbing: creating the closed-shadow host, rendering the React roots, tracking the one
 * live mount, and the script-tag auto-init path.
 *
 * `attachShadowMount`/`createWidgetContainer` open the shadow root and attach it to the page or a
 * caller-supplied container. `mountWidgetToContainer` renders `WidgetRoot` into it.
 * `showHostPageNotice`/`hideHostPageNotice` show a standalone toast before the widget's own providers
 * exist. `autoInitializeWidget` reads the host page's script tag and initializes from its attributes.
 *
 * `mtx-api-host` has no default: leaving it unset would silently post widget traffic at the host
 * page's own origin instead of failing loudly.
 */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { NotificationProvider, WidgetNotifications } from '../components/blocks/Notifications';
import { WidgetRoot } from '../components/WidgetRoot';
import { WidgetProviders } from '../context/WidgetProviders';
import type { NotificationTone } from '../design-system/component-tokens';
import shadowStyles from '../index.css?inline';
import type { MarketrixConfig, ValidWidgetConfig } from '../types';
import { WIDGET_SHADOW_HOST_CLASS } from './dom';
import { isHTMLScriptElement } from './validation';

interface WidgetMount {
  instance: Root;
  config: ValidWidgetConfig;
  container: HTMLElement;
  host: HTMLElement | undefined;
  previewMode: boolean;
}

export const widgetState: { mount: WidgetMount | null } = { mount: null };

let noticeRoot: Root | null = null;

const attachShadowMount = (
  container: HTMLElement,
  mountId: string,
  styleNonce?: string,
): { shadowRoot: ShadowRoot; mountEl: HTMLElement } => {
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

export const createWidgetContainer = (
  parentContainer?: HTMLElement,
  styleNonce?: string,
): { container: HTMLElement; shadowRoot: ShadowRoot; mountEl: HTMLElement } => {
  const parent = parentContainer ?? document.body;

  const container = document.createElement('div');
  container.className = WIDGET_SHADOW_HOST_CLASS;
  container.style.pointerEvents = 'auto';
  if (parentContainer) {
    Object.assign(container.style, { width: '100%', height: '100%', position: 'relative', overflow: 'visible' });
  }
  parent.appendChild(container);

  const { shadowRoot, mountEl } = attachShadowMount(container, 'marketrix-widget-root', styleNonce);
  Object.assign(mountEl.style, { pointerEvents: 'auto', width: '100%', height: '100%', position: 'relative' });

  return { container, shadowRoot, mountEl };
};

export const mountWidgetToContainer = (mountEl: HTMLElement, config: ValidWidgetConfig, previewMode = false): Root => {
  const root = createRoot(mountEl);

  root.render(
    <React.StrictMode>
      <WidgetProviders previewMode={previewMode}>
        <WidgetRoot config={config} />
      </WidgetProviders>
    </React.StrictMode>,
  );

  return root;
};

export const isWidgetInitialized = (): boolean => widgetState.mount !== null;

export const getCurrentConfig = (): ValidWidgetConfig | null => widgetState.mount?.config ?? null;

export const showHostPageNotice = (message: string, tone: NotificationTone = 'neutral'): void => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

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
};

export const hideHostPageNotice = (): void => {
  noticeRoot?.unmount();
  noticeRoot = null;
  document.getElementById('marketrix-widget-notice-container')?.remove();
};

export const autoInitializeWidget = (initWidget: (config: MarketrixConfig) => Promise<void>): void => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  if (window.__mtx?.state) {
    return;
  }

  const scripts = document.querySelectorAll('script[mtx-id]');
  const script = scripts[scripts.length - 1];

  if (!script || !isHTMLScriptElement(script)) {
    return;
  }

  const mtxId = script.getAttribute('mtx-id');
  const mtxKey = script.getAttribute('mtx-key');
  const mtxApiHost = script.getAttribute('mtx-api-host');

  if (!mtxId || !mtxKey || !mtxApiHost) {
    if (isWidgetInitialized()) return;
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
