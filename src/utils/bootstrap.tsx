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
import { WidgetProvider } from '../context/WidgetContext';
import shadowStyles from '../index.css?inline';
import type { MarketrixConfig } from '../types';
import { checkAndReinjectOnLoad, initializePersistence } from './persistence';
// Removed duplicate imports manually because I can't be sure what the previous command did or didn't do correctly.
import { isHTMLElement, isHTMLScriptElement } from './validation';

// ============================================================================
// Widget Lifecycle State
// ============================================================================

// Global widget instance state
let widgetInstance: Root | null = null;
let currentConfig: MarketrixConfig | null = null;

// Global loader instance
let loaderInstance: Root | null = null;

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
  containerId?: string
): {
  container: HTMLElement;
  shadowRoot: ShadowRoot;
  mountEl: HTMLElement;
} => {
  let container: HTMLElement;
  const uniqueContainerId = containerId || generateContainerId();

  if (parentContainer) {
    // Use provided container - check if widget container already exists within it
    const existingContainer = parentContainer.querySelector(`#${uniqueContainerId}`) as HTMLElement;
    if (existingContainer) {
      container = existingContainer;
    } else {
      // Create new container within parent
      container = document.createElement('div');
      container.id = uniqueContainerId;
      container.className = 'marketrix-widget-container';
      // Ensure container respects parent bounds
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.position = 'relative';
      container.style.overflow = 'visible';
      parentContainer.appendChild(container);
    }
  } else {
    // Create container in document.body (existing behavior)
    // For backward compatibility, check for old ID first
    container = document.getElementById('marketrix-widget-container') as HTMLElement;
    if (!container) {
      container = document.getElementById(uniqueContainerId) as HTMLElement;
    }
    if (!container) {
      container = document.createElement('div');
      container.id = uniqueContainerId;
      container.className = 'marketrix-widget-container';
      document.body.appendChild(container);
    }
  }

  // Ensure container can receive pointer events
  if (isHTMLElement(container)) {
    container.style.pointerEvents = 'auto';
  }

  if (!isHTMLElement(container)) {
    throw new Error('Container is not an HTMLElement');
  }

  // Check if shadow root already exists (Bug 1 fix)
  let shadowRoot: ShadowRoot;
  if (container.shadowRoot) {
    // Reuse existing shadow root
    shadowRoot = container.shadowRoot;
  } else {
    // Attach Shadow DOM (closed) and mount point
    shadowRoot = container.attachShadow({ mode: 'closed' });

    // Inject styles into shadow root so the widget is fully encapsulated
    const styleEl = document.createElement('style');
    styleEl.textContent = shadowStyles;
    shadowRoot.appendChild(styleEl);
  }

  // Check if mount element already exists in shadow root
  let mountEl = shadowRoot.querySelector('#marketrix-widget-root') as HTMLElement;
  if (!mountEl) {
    // Create a mount element inside the shadow root for React
    mountEl = document.createElement('div');
    mountEl.id = 'marketrix-widget-root';
    // Ensure mount element can receive pointer events and fills container
    mountEl.style.pointerEvents = 'auto';
    mountEl.style.width = '100%';
    mountEl.style.height = '100%';
    mountEl.style.position = 'relative';
    shadowRoot.appendChild(mountEl);
  }

  return { container, shadowRoot, mountEl };
};

/**
 * Mount widget component to the provided mount element
 * Returns the React root instance
 */
export const mountWidgetToContainer = (mountEl: HTMLElement, config: MarketrixConfig): Root => {
  // Create React root and render widget within the shadow root
  const root = createRoot(mountEl);

  root.render(
    <React.StrictMode>
      <WidgetProvider>
        <MarketrixWidget config={config} />
      </WidgetProvider>
    </React.StrictMode>
  );

  return root;
};

/**
 * Destroy widget container
 * @param container - Optional specific container to destroy. If not provided, searches for default container.
 */
export const destroyWidgetContainer = (container?: HTMLElement): void => {
  const containerToDestroy = container || document.getElementById('marketrix-widget-container');
  if (containerToDestroy) {
    containerToDestroy.remove();
  }
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
};

// ============================================================================
// Widget Loader Management
// ============================================================================

/**
 * Show widget settings loader with optional message
 */
export const showWidgetSettingsLoader = (message?: string): void => {
  // Remove existing loader if present
  if (loaderInstance) {
    const loaderContainer = document.getElementById('marketrix-widget-loader-container');
    if (loaderContainer) {
      loaderContainer.remove();
    }
    loaderInstance = null;
  }

  // Create container for loader
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
    </React.StrictMode>
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
 *
 * Flow:
 * 1. Function registration (synchronous) - stores init function
 * 2. DOM ready detection - checks document.readyState
 * 3. Initialization - only when both function registered AND DOM ready
 */

// Remove duplicate imports and merge properly
// Removed unused duplicate imports

// Store the init function - set synchronously during registration
let initWidgetFunction: ((config: MarketrixConfig) => Promise<void>) | null = null;

/**
 * Auto-initialize widget from script tag attributes
 * Only called when both function is registered AND DOM is ready
 */
const autoInitializeWidget = (): void => {
  if (!initWidgetFunction) {
    console.error('[AutoInit] initWidget function not registered');
    return;
  }

  const scripts = document.querySelectorAll('script[mtx-id], script[mtx-app]');
  const scriptElement = scripts[scripts.length - 1];

  if (scriptElement && isHTMLScriptElement(scriptElement)) {
    const script = scriptElement;
    const mtxId = script.getAttribute('mtx-id');
    const mtxKey = script.getAttribute('mtx-key');
    const mtxApiHost = script.getAttribute('mtx-api-host');
    const mtxAiHost = script.getAttribute('mtx-ai-host');
    const mtxApp = script.getAttribute('mtx-app');
    const mtxAgent = script.getAttribute('mtx-agent');

    if (mtxId && mtxKey) {
      const config: MarketrixConfig = {
        mtxId,
        mtxKey,
      };
      // Add optional host configuration
      if (mtxApiHost) {
        config.mtxApiHost = mtxApiHost;
      }
      if (mtxAiHost) {
        config.mtxAiHost = mtxAiHost;
      }
      initWidgetFunction(config).catch((error) => {
        console.error('Failed to initialize widget:', error);
      });
    } else if (mtxApp && mtxAgent) {
      const config: MarketrixConfig = {
        mtxApp: Number.parseInt(mtxApp),
        mtxAgent: Number.parseInt(mtxAgent),
      };
      // Add optional host configuration
      if (mtxApiHost) {
        config.mtxApiHost = mtxApiHost;
      }
      if (mtxAiHost) {
        config.mtxAiHost = mtxAiHost;
      }
      initWidgetFunction(config).catch((error) => {
        console.error('Failed to initialize widget:', error);
      });
    } else {
      showWidgetSettingsLoader('Please configure mtx-id and mtx-key, or mtx-app and mtx-agent');
    }
  } else {
    showWidgetSettingsLoader('Please configure mtx-id and mtx-key, or mtx-app and mtx-agent');
  }
};

/**
 * Initialize when both function is registered AND DOM is ready
 * This ensures no race conditions
 */
const initializeWhenReady = (): void => {
  if (!initWidgetFunction) {
    console.error('[AutoInit] initWidget function not registered');
    return;
  }
  autoInitializeWidget();
};

/**
 * Register the widget initialization function and set up auto-initialization
 *
 * This function:
 * 1. Stores the init function synchronously (no delays)
 * 2. Checks DOM ready state
 * 3. Either initializes immediately or waits for DOMContentLoaded
 * 4. Sets up persistence for bookmarklet usage
 *
 * @param initWidget - Function to initialize the widget (passed to avoid circular dependency)
 */
export const registerAutoInit = (initWidget: (config: MarketrixConfig) => Promise<void>): void => {
  if (typeof initWidget !== 'function') {
    console.error('[AutoInit] initWidget must be a function');
    return;
  }

  initWidgetFunction = initWidget;

  // Check if we need to re-inject from a stored bookmarklet config (page reload scenario)
  checkAndReinjectOnLoad();

  const readyState = document.readyState;

  if (readyState === 'complete' || readyState === 'interactive') {
    initializeWhenReady();
    // Initialize persistence after widget is set up
    initializePersistence();
  } else if (readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        initializeWhenReady();
        // Initialize persistence after widget is set up
        initializePersistence();
      },
      { once: true }
    );
  } else {
    initializeWhenReady();
    initializePersistence();
  }
};
