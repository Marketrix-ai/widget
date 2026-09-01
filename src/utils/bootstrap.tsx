import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { NotificationToast } from '../components/blocks/NotificationToast';
import { MarketrixWidget } from '../components/MarketrixWidget';
import { WidgetProviders } from '../context/WidgetProviders';
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
  const portalContainer = mountEl.getRootNode() as HTMLElement | ShadowRoot;

  root.render(
    <React.StrictMode>
      <WidgetProviders previewMode={previewMode} portalContainer={portalContainer}>
        <MarketrixWidget config={config} />
      </WidgetProviders>
    </React.StrictMode>,
  );

  return root;
};

export const isWidgetInitialized = (): boolean => widgetState.instance !== null;

export const getCurrentConfig = (): MarketrixConfig | null => widgetState.config;

export const showWidgetSettingsLoader = (message: string): void => {
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
      <NotificationToast tone='neutral' title={message} onDismiss={hideWidgetSettingsLoader} />
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

  if (!mtxId || !mtxKey) {
    if (isWidgetInitialized()) return;
    console.error('[AutoInit] Missing required attributes:', { hasMtxId: !!mtxId, hasMtxKey: !!mtxKey });
    showWidgetSettingsLoader('Please configure mtx-id and mtx-key');
    return;
  }

  const config: MarketrixConfig = { mtxId, mtxKey };
  if (mtxApiHost) config.mtxApiHost = mtxApiHost;
  if (script.getAttribute('mtx-use-screenshare') === 'false') config.use_screenshare = false;

  initWidget(config).catch(error => console.error('[AutoInit] Failed to initialize widget:', error));
};
