import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { MarketrixWidget } from '../components/MarketrixWidget';
import { WidgetSettingsLoader } from '../components/ui/WidgetSettingsLoader';
import { WidgetProviders } from '../context/WidgetProviders';
import shadowStyles from '../index.css?inline';
import type { MarketrixConfig } from '../types';
import { isHTMLElement, isHTMLScriptElement } from './validation';

let widgetInstance: Root | null = null;
let currentConfig: MarketrixConfig | null = null;
let loaderInstance: Root | null = null;
let programmaticInitInProgress = false;

let widgetInstanceCounter = 0;
const generateContainerId = (): string => {
  return `marketrix-widget-container-${++widgetInstanceCounter}`;
};

export const createWidgetContainer = (
  parentContainer?: HTMLElement,
  containerId?: string,
): {
  container: HTMLElement;
  shadowRoot: ShadowRoot;
  mountEl: HTMLElement;
} => {
  const uniqueContainerId = containerId || generateContainerId();

  let container: HTMLElement;
  if (parentContainer) {
    const existingContainer = parentContainer.querySelector(`#${uniqueContainerId}`) as HTMLElement;
    if (existingContainer) {
      throw new Error(`Widget container with ID ${uniqueContainerId} already exists`);
    }
    container = document.createElement('div');
    container.id = uniqueContainerId;
    container.className = 'marketrix-widget-container';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.position = 'relative';
    container.style.overflow = 'visible';
    parentContainer.appendChild(container);
  } else {
    const existingContainer = document.getElementById(uniqueContainerId) as HTMLElement;
    if (existingContainer) {
      throw new Error(`Widget container with ID ${uniqueContainerId} already exists`);
    }
    container = document.createElement('div');
    container.id = uniqueContainerId;
    container.className = 'marketrix-widget-container';
    document.body.appendChild(container);
  }

  container.style.pointerEvents = 'auto';

  if (!isHTMLElement(container)) {
    throw new Error('Container is not an HTMLElement');
  }

  if (container.shadowRoot) {
    throw new Error('Container already has a shadow root');
  }

  const shadowRoot = container.attachShadow({ mode: 'closed' });

  const styleEl = document.createElement('style');
  styleEl.textContent = shadowStyles;
  shadowRoot.appendChild(styleEl);

  const existingMountEl = shadowRoot.querySelector('#marketrix-widget-root') as HTMLElement;
  if (existingMountEl) {
    throw new Error('Mount element already exists in shadow root');
  }

  const mountEl = document.createElement('div');
  mountEl.id = 'marketrix-widget-root';
  mountEl.style.pointerEvents = 'auto';
  mountEl.style.width = '100%';
  mountEl.style.height = '100%';
  mountEl.style.position = 'relative';
  shadowRoot.appendChild(mountEl);

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

export const destroyWidgetContainer = (container: HTMLElement): void => {
  if (!container) {
    throw new Error('Container is required');
  }
  container.remove();
};

export const getWidgetInstance = (): Root | null => {
  return widgetInstance;
};

export const setWidgetInstance = (instance: Root | null): void => {
  widgetInstance = instance;
};

export const getCurrentConfig = (): MarketrixConfig | null => {
  return currentConfig;
};

export const setCurrentConfig = (config: MarketrixConfig | null): void => {
  currentConfig = config;
};

export const isWidgetInitialized = (): boolean => {
  return widgetInstance !== null;
};

export const clearWidgetState = (): void => {
  widgetInstance = null;
  currentConfig = null;
};

export const setProgrammaticInitInProgress = (inProgress: boolean): void => {
  programmaticInitInProgress = inProgress;
};

export const isProgrammaticInitInProgress = (): boolean => {
  return programmaticInitInProgress;
};

export const showWidgetSettingsLoader = (message?: string): void => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  if (loaderInstance) {
    const loaderContainer = document.getElementById('marketrix-widget-loader-container');
    if (loaderContainer) {
      loaderContainer.remove();
    }
    loaderInstance.unmount();
    loaderInstance = null;
  }

  const existingLoader = document.getElementById('marketrix-widget-loader-container');
  if (existingLoader) {
    throw new Error('Widget loader container already exists');
  }

  const loaderContainer = document.createElement('div');
  loaderContainer.id = 'marketrix-widget-loader-container';
  loaderContainer.className = 'marketrix-widget-loader-container';
  document.body.appendChild(loaderContainer);

  const shadowRoot = loaderContainer.attachShadow({ mode: 'closed' });

  const styleEl = document.createElement('style');
  styleEl.textContent = shadowStyles;
  shadowRoot.appendChild(styleEl);

  const mountEl = document.createElement('div');
  mountEl.id = 'marketrix-widget-loader-root';
  shadowRoot.appendChild(mountEl);

  const root = createRoot(mountEl);
  loaderInstance = root;

  root.render(
    <React.StrictMode>
      <WidgetSettingsLoader message={message} />
    </React.StrictMode>,
  );
};

export const hideWidgetSettingsLoader = (): void => {
  if (loaderInstance) {
    loaderInstance.unmount();
    loaderInstance = null;

    const loaderContainer = document.getElementById('marketrix-widget-loader-container');
    if (loaderContainer) {
      loaderContainer.remove();
    }
  }
};

let initWidgetFunction: ((config: MarketrixConfig) => Promise<void>) | null = null;

export const autoInitializeWidget = (): void => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  // Window-level guard survives ES module re-execution.
  if (window.__mtx?.state) {
    return;
  }

  if (!initWidgetFunction) {
    console.error('[AutoInit] initWidget function not registered');
    return;
  }

  const scripts = document.querySelectorAll('script[mtx-id]');
  const scriptElement = scripts[scripts.length - 1];

  if (!scriptElement || !isHTMLScriptElement(scriptElement)) {
    console.log('[AutoInit] No marketrix script tags found. Skipping auto-initialization.');
    return;
  }

  const script = scriptElement;
  const mtxId = script.getAttribute('mtx-id');
  const mtxKey = script.getAttribute('mtx-key');
  const mtxApiHost = script.getAttribute('mtx-api-host');
  const mtxUseScreenshare = script.getAttribute('mtx-use-screenshare');

  console.log('[AutoInit] Found script tag with attributes:', {
    mtxId: mtxId ? '***' : null,
    mtxKey: mtxKey ? '***' : null,
    mtxApiHost,
  });

  if (mtxId && mtxKey) {
    const config: MarketrixConfig = {
      mtxId,
      mtxKey,
    };
    if (mtxApiHost) {
      config.mtxApiHost = mtxApiHost;
    }
    if (mtxUseScreenshare === 'false') {
      config.use_screenshare = false;
    }
    console.log('[AutoInit] Initializing widget with mtx-id/mtx-key config');
    initWidgetFunction(config).catch(error => {
      console.error('[AutoInit] Failed to initialize widget:', error);
    });
  } else {
    if (isWidgetInitialized() || isProgrammaticInitInProgress()) {
      console.log(
        '[AutoInit] Missing required attributes, but widget is initialized or programmatic init is in progress. Skipping error message.',
      );
      return;
    }
    console.error('[AutoInit] Missing required attributes:', {
      hasMtxId: !!mtxId,
      hasMtxKey: !!mtxKey,
    });
    showWidgetSettingsLoader('Please configure mtx-id and mtx-key');
  }
};

// initWidget is passed in (not imported) to avoid a circular dependency.
export const registerAutoInit = (initWidget: (config: MarketrixConfig) => Promise<void>): void => {
  if (typeof initWidget !== 'function') {
    console.error('[AutoInit] initWidget must be a function');
    return;
  }

  console.log('[AutoInit] registerAutoInit called, setting up auto-initialization');
  initWidgetFunction = initWidget;
  autoInitializeWidget();
};
