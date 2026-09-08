/**
 * Widget mount plumbing: creating the closed-shadow host, rendering the React roots, holding the
 * single live-mount record, and the script-tag auto-init path.
 *
 * Contents: `WidgetMount` / `widgetState` are the module singleton describing the one live mount
 * (React root, validated config, shadow host container, optional caller-supplied host, previewMode),
 * read back by `isWidgetInitialized` and `getCurrentConfig` and written by `src/index.tsx`.
 * `attachShadowMount` is the ONE place a closed shadow root is opened and the widget CSS injected
 * into it. `createWidgetContainer` appends a shadow host to `document.body`, or fills a caller's
 * container edge-to-edge when one is given. `mountWidgetToContainer` renders `WidgetRoot` under the
 * providers, its `previewMode` flag disabling all network operations for integration previews.
 * `showHostPageNotice` / `hideHostPageNotice` mount and tear down a standalone toast in its own
 * shadow tree. `autoInitializeWidget` reads the last `script[mtx-id]` on the page and hands its
 * attributes to the init function.
 *
 * The notice root carries its OWN `NotificationProvider`: it is a separate shadow tree, mounted
 * before the widget — and so before the widget's providers — exists.
 *
 * `initWidget` is passed into `autoInitializeWidget` rather than imported, to avoid a circular
 * dependency, and `autoInitializeWidget`'s own `window.__mtx.state` guard — which survives ES-module
 * re-execution — is what dedupes init.
 *
 * `mtx-api-host` is as required as the credentials: there is no default, and an unconfigured SDK
 * resolves every request against the HOST PAGE's origin, so omitting it silently posts widget traffic
 * at the customer's own site instead of failing. When a widget is already mounted that branch stays
 * silent — a later misconfigured script tag must not log over, or notice against, a working widget.
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

export interface WidgetMount {
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
): { shadowRoot: ShadowRoot; mountEl: HTMLElement } => {
  const shadowRoot = container.attachShadow({ mode: 'closed' });

  const styleEl = document.createElement('style');
  styleEl.textContent = shadowStyles;
  shadowRoot.appendChild(styleEl);

  const mountEl = document.createElement('div');
  mountEl.id = mountId;
  shadowRoot.appendChild(mountEl);

  return { shadowRoot, mountEl };
};

export const createWidgetContainer = (
  parentContainer?: HTMLElement,
): { container: HTMLElement; shadowRoot: ShadowRoot; mountEl: HTMLElement } => {
  const parent = parentContainer ?? document.body;

  const container = document.createElement('div');
  container.className = WIDGET_SHADOW_HOST_CLASS;
  container.style.pointerEvents = 'auto';
  if (parentContainer) {
    Object.assign(container.style, { width: '100%', height: '100%', position: 'relative', overflow: 'visible' });
  }
  parent.appendChild(container);

  const { shadowRoot, mountEl } = attachShadowMount(container, 'marketrix-widget-root');
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

  initWidget(config).catch(error => console.error('[AutoInit] Failed to initialize widget:', error));
};
