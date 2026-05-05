/**
 * Widget Initialization, Lifecycle, and Loader Utilities
 *
 * Handles widget container creation, shadow DOM setup, mounting, lifecycle management,
 * and loader display. Consolidates all widget-related DOM manipulation and state management.
 */

import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { MarketrixWidget } from '../components/MarketrixWidget';
import { WidgetSettingsLoader } from '../components/ui/WidgetSettingsLoader';
import { WidgetProviders } from '../context/WidgetProviders';
import shadowStyles from '../index.css?inline';
import type { MarketrixConfig } from '../types';
import { isHTMLElement, isHTMLScriptElement } from './validation';

// ============================================================================
// Widget Lifecycle State
// ============================================================================

// Global widget instance state
let widgetInstance: Root | null = null;
let currentConfig: MarketrixConfig | null = null;

// Global loader instance
let loaderInstance: Root | null = null;

// Programmatic initialization tracking flag (memoized)
let programmaticInitInProgress = false;

// Production widget singleton tracking - prevents duplicate widgets on same page
let productionWidgetActive = false;

/**
 * Generate unique container ID for widget instances
 */
let widgetInstanceCounter = 0;
const generateContainerId = (): string => {
  return `marketrix-widget-container-${++widgetInstanceCounter}`;
};

/**
 * Create widget container and shadow DOM
 * Returns the container element and shadow root
 * @param parentContainer - Optional parent container to mount within. If provided, shadow DOM will be created within this container.
 * @param containerId - Optional unique container ID. If not provided, a unique ID will be generated.
 */
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

/**
 * Mount widget component to the provided mount element
 * Returns the React root instance
 * @param mountEl - The mount element inside shadow DOM
 * @param config - Widget configuration
 * @param previewMode - If true, disables network operations (for integration previews)
 */
export const mountWidgetToContainer = (mountEl: HTMLElement, config: MarketrixConfig, previewMode = false): Root => {
  // Create React root and render widget within the shadow root
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

/**
 * Destroy widget container
 * @param container - Container to destroy
 */
export const destroyWidgetContainer = (container: HTMLElement): void => {
  if (!container) {
    throw new Error('Container is required');
  }
  container.remove();
};

// ============================================================================
// Widget Lifecycle Management
// ============================================================================

/**
 * Get current widget instance
 */
export const getWidgetInstance = (): Root | null => {
  return widgetInstance;
};

/**
 * Set widget instance
 */
export const setWidgetInstance = (instance: Root | null): void => {
  widgetInstance = instance;
};

/**
 * Get current configuration
 */
export const getCurrentConfig = (): MarketrixConfig | null => {
  return currentConfig;
};

/**
 * Set current configuration
 */
export const setCurrentConfig = (config: MarketrixConfig | null): void => {
  currentConfig = config;
};

/**
 * Check if widget is initialized
 */
export const isWidgetInitialized = (): boolean => {
  return widgetInstance !== null;
};

/**
 * Clear widget instance and config
 */
export const clearWidgetState = (): void => {
  widgetInstance = null;
  currentConfig = null;
  productionWidgetActive = false;
};

// ============================================================================
// Programmatic Initialization Tracking
// ============================================================================

/**
 * Set programmatic initialization in progress flag
 */
export const setProgrammaticInitInProgress = (inProgress: boolean): void => {
  programmaticInitInProgress = inProgress;
};

/**
 * Check if programmatic initialization is in progress
 */
export const isProgrammaticInitInProgress = (): boolean => {
  return programmaticInitInProgress;
};

// ============================================================================
// Production Widget Singleton Guard
// ============================================================================

/**
 * Check if a production widget is already active on this page
 * Production widgets (non-preview) should be singletons - only one per page
 */
export const isProductionWidgetActive = (): boolean => {
  return productionWidgetActive;
};

/**
 * Set production widget active state
 * Call with true when initializing a production widget, false when unmounting
 */
export const setProductionWidgetActive = (active: boolean): void => {
  productionWidgetActive = active;
};

// ============================================================================
// Widget Loader Management
// ============================================================================

/**
 * Show widget settings loader with optional message
 */
export const showWidgetSettingsLoader = (message?: string): void => {
  // Guard against SSR - only run in browser
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

  // Attach Shadow DOM (closed) for loader
  const shadowRoot = loaderContainer.attachShadow({ mode: 'closed' });

  // Inject styles
  const styleEl = document.createElement('style');
  styleEl.textContent = shadowStyles;
  shadowRoot.appendChild(styleEl);

  // Create mount element
  const mountEl = document.createElement('div');
  mountEl.id = 'marketrix-widget-loader-root';
  shadowRoot.appendChild(mountEl);

  // Render loader
  const root = createRoot(mountEl);
  loaderInstance = root;

  root.render(
    <React.StrictMode>
      <WidgetSettingsLoader message={message} />
    </React.StrictMode>,
  );
};

/**
 * Hide widget settings loader
 */
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
/**
 * Auto-Initialization Utilities
 *
 * Handles automatic widget initialization from script tag data attributes.
 * Parses script attributes and initializes the widget accordingly.
 */

// Store the init function - set synchronously during registration
let initWidgetFunction: ((config: MarketrixConfig) => Promise<void>) | null = null;

/**
 * Auto-initialize widget from script tag attributes
 * Retries if script tag not found to handle timing issues with ES module loading
 */
export const autoInitializeWidget = (retryCount = 0): void => {
  // Guard against SSR - only run in browser
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  // Window-level guard survives ES module re-execution
  if (window.__mtx?.state) {
    return;
  }

  const MAX_RETRIES = 5;
  const RETRY_DELAYS = [0, 100, 500, 1000, 2000]; // ms

  if (!initWidgetFunction) {
    console.error('[AutoInit] initWidget function not registered');
    return;
  }

  // Prefer the currently executing script when it has config (injected script tag in playground).
  // Fall back to last matching script for static script tags.
  const bySelector = document.querySelectorAll('script[mtx-id], script[mtx-app]');
  const current =
    typeof document.currentScript !== 'undefined' &&
    document.currentScript != null &&
    isHTMLScriptElement(document.currentScript) &&
    (document.currentScript.hasAttribute('mtx-id') || document.currentScript.hasAttribute('mtx-app'))
      ? document.currentScript
      : null;
  const scriptElement = current ?? bySelector[bySelector.length - 1];

  if (!scriptElement || !isHTMLScriptElement(scriptElement)) {
    // If no script tags found at all, assume auto-init was not intended (e.g. using npm package)
    if (bySelector.length === 0) {
      // Check if widget is already initialized or programmatic init is in progress
      if (isWidgetInitialized() || isProgrammaticInitInProgress()) {
        console.log(
          '[AutoInit] Script tag not found, but widget is initialized or programmatic init is in progress. Skipping.',
        );
        return;
      }
      console.log('[AutoInit] No marketrix script tags found. Skipping auto-initialization.');
      return;
    }

    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAYS[retryCount] || 2000;
      console.warn(
        `[AutoInit] Script tag not found (attempt ${retryCount + 1}/${MAX_RETRIES}), retrying in ${delay}ms...`,
      );
      setTimeout(() => autoInitializeWidget(retryCount + 1), delay);
      return;
    }
    // Check if widget is already initialized or programmatic init is in progress
    if (isWidgetInitialized() || isProgrammaticInitInProgress()) {
      console.log(
        '[AutoInit] Script tag not found, but widget is initialized or programmatic init is in progress. Skipping error message.',
      );
      return;
    }
    console.error('[AutoInit] Script tag not found after all retries');
    console.error(
      '[AutoInit] Available scripts:',
      Array.from(document.querySelectorAll('script')).map(s => ({
        id: s.id,
        src: s.src,
        type: s.type,
        hasMtxId: s.hasAttribute('mtx-id'),
        hasMtxApp: s.hasAttribute('mtx-app'),
      })),
    );
    showWidgetSettingsLoader('Please configure mtx-id and mtx-key, or mtx-app and mtx-agent');
    return;
  }

  const script = scriptElement;
  // Read widget credentials from script tag attributes
  const mtxId = script.getAttribute('mtx-id');
  const mtxKey = script.getAttribute('mtx-key');
  const mtxApiHost = script.getAttribute('mtx-api-host');
  const mtxApp = script.getAttribute('mtx-app');
  const mtxAgent = script.getAttribute('mtx-agent');
  const mtxUseScreenshare = script.getAttribute('mtx-use-screenshare');

  console.log('[AutoInit] Found script tag with attributes:', {
    mtxId: mtxId ? '***' : null,
    mtxKey: mtxKey ? '***' : null,
    mtxApp,
    mtxAgent,
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
  } else if (mtxApp && mtxAgent) {
    const appNum = Number.parseInt(mtxApp);
    const agentNum = Number.parseInt(mtxAgent);

    if (isNaN(appNum) || isNaN(agentNum)) {
      console.error(`[AutoInit] Invalid mtx-app or mtx-agent values: mtx-app=${mtxApp}, mtx-agent=${mtxAgent}`);
      showWidgetSettingsLoader('Invalid mtx-app or mtx-agent values');
      return;
    }

    const config: MarketrixConfig = {
      mtxApp: appNum,
      mtxAgent: agentNum,
    };
    if (mtxApiHost) {
      config.mtxApiHost = mtxApiHost;
    }
    if (mtxUseScreenshare === 'false') {
      config.use_screenshare = false;
    }
    console.log('[AutoInit] Initializing widget with mtx-app/mtx-agent config:', {
      mtxApp: appNum,
      mtxAgent: agentNum,
    });
    initWidgetFunction(config).catch(error => {
      console.error('[AutoInit] Failed to initialize widget:', error);
    });
  } else {
    // Check if widget is already initialized or programmatic init is in progress
    if (isWidgetInitialized() || isProgrammaticInitInProgress()) {
      console.log(
        '[AutoInit] Missing required attributes, but widget is initialized or programmatic init is in progress. Skipping error message.',
      );
      return;
    }
    console.error('[AutoInit] Missing required attributes:', {
      hasMtxId: !!mtxId,
      hasMtxKey: !!mtxKey,
      hasMtxApp: !!mtxApp,
      hasMtxAgent: !!mtxAgent,
    });
    showWidgetSettingsLoader('Please configure mtx-id and mtx-key, or mtx-app and mtx-agent');
  }
};

/**
 * Register the widget initialization function and set up auto-initialization
 *
 * @param initWidget - Function to initialize the widget (passed to avoid circular dependency)
 */
export const registerAutoInit = (initWidget: (config: MarketrixConfig) => Promise<void>): void => {
  if (typeof initWidget !== 'function') {
    console.error('[AutoInit] initWidget must be a function');
    return;
  }

  console.log('[AutoInit] registerAutoInit called, setting up auto-initialization');
  initWidgetFunction = initWidget;
  autoInitializeWidget();
};
