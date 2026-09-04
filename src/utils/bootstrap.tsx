import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { NotificationToast } from '../components/blocks/NotificationToast';
import { MarketrixWidget } from '../components/MarketrixWidget';
import { WidgetProviders } from '../context/WidgetProviders';
import type { NotificationTone } from '../design-system/component-tokens';
import shadowStyles from '../index.css?inline';
import type { MarketrixConfig } from '../types';
import { isHTMLScriptElement } from './validation';

export const widgetState: { instance: Root | null; config: MarketrixConfig | null } = {
  instance: null,
  config: null,
};

let loaderInstance: Root | null = null;

let widgetInstanceCounter = 0;
const generateContainerId = (): string => {
  return `marketrix-widget-container-${++widgetInstanceCounter}`;
};

/** The one place a closed shadow root is opened and the widget CSS injected into it. */
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
  const uniqueContainerId = generateContainerId();
  const parent = parentContainer ?? document.body;
  if (parent.querySelector(`#${uniqueContainerId}`)) {
    throw new Error(`Widget container with ID ${uniqueContainerId} already exists`);
  }

  const container = document.createElement('div');
  container.id = uniqueContainerId;
  container.className = 'marketrix-widget-container';
  container.style.pointerEvents = 'auto';
  if (parentContainer) {
    Object.assign(container.style, { width: '100%', height: '100%', position: 'relative', overflow: 'visible' });
  }
  parent.appendChild(container);

  const { shadowRoot, mountEl } = attachShadowMount(container, 'marketrix-widget-root');
  Object.assign(mountEl.style, { pointerEvents: 'auto', width: '100%', height: '100%', position: 'relative' });

  return { container, shadowRoot, mountEl };
};

// previewMode disables all network operations (for integration previews).
export const mountWidgetToContainer = (mountEl: HTMLElement, config: MarketrixConfig, previewMode = false): Root => {
  const root = createRoot(mountEl);

  root.render(
    <React.StrictMode>
      <WidgetProviders previewMode={previewMode}>
        <MarketrixWidget config={config} />
      </WidgetProviders>
    </React.StrictMode>,
  );

  return root;
};

export const isWidgetInitialized = (): boolean => widgetState.instance !== null;

export const getCurrentConfig = (): MarketrixConfig | null => widgetState.config;

/** ``tone`` because this one surface carries both the loading notice and the two hard init failures, and
 * a failure painted in the neutral palette reads as an informational notice on the host's page. */
export const showWidgetSettingsLoader = (message: string, tone: NotificationTone = 'neutral'): void => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  hideWidgetSettingsLoader();

  const loaderContainer = document.createElement('div');
  loaderContainer.id = 'marketrix-widget-loader-container';
  loaderContainer.className = 'marketrix-widget-loader-container';
  document.body.appendChild(loaderContainer);

  const { mountEl } = attachShadowMount(loaderContainer, 'marketrix-widget-loader-root');

  loaderInstance = createRoot(mountEl);
  loaderInstance.render(
    <React.StrictMode>
      <NotificationToast tone={tone} title={message} onDismiss={hideWidgetSettingsLoader} />
    </React.StrictMode>,
  );
};

export const hideWidgetSettingsLoader = (): void => {
  loaderInstance?.unmount();
  loaderInstance = null;
  document.getElementById('marketrix-widget-loader-container')?.remove();
};

// initWidget is passed in (not imported) to avoid a circular dependency.
export const autoInitializeWidget = (initWidget: (config: MarketrixConfig) => Promise<void>): void => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  // Window-level guard survives ES module re-execution.
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

  // mtx-api-host is as required as the credentials: there is no default, and an unconfigured SDK
  // resolves every request against the HOST PAGE's origin, so omitting it silently posts widget
  // traffic at the customer's own site instead of failing.
  if (!mtxId || !mtxKey || !mtxApiHost) {
    if (isWidgetInitialized()) return;
    console.error('[AutoInit] Missing required attributes:', {
      hasMtxId: !!mtxId,
      hasMtxKey: !!mtxKey,
      hasMtxApiHost: !!mtxApiHost,
    });
    showWidgetSettingsLoader('Please configure mtx-id, mtx-key and mtx-api-host', 'error');
    return;
  }

  const config: MarketrixConfig = { mtxId, mtxKey, mtxApiHost };
  if (script.getAttribute('mtx-use-screenshare') === 'false') config.use_screenshare = false;

  initWidget(config).catch(error => console.error('[AutoInit] Failed to initialize widget:', error));
};
