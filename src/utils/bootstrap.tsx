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
 * Create widget container and shadow DOM
 * Returns the container element and shadow root
 */
export const createWidgetContainer = (): {
  container: HTMLElement;
  shadowRoot: ShadowRoot;
  mountEl: HTMLElement;
} => {
  // Create container if it doesn't exist
  let container = document.getElementById('marketrix-widget-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'marketrix-widget-container';
    container.className = 'marketrix-widget-container';
    // Ensure container can receive pointer events
    if (isHTMLElement(container)) {
      container.style.pointerEvents = 'auto';
    }
    document.body.appendChild(container);
  } else {
    // Ensure existing container has pointer events enabled
    if (isHTMLElement(container)) {
      container.style.pointerEvents = 'auto';
    }
  }

  if (!isHTMLElement(container)) {
    throw new Error('Container is not an HTMLElement');
  }

  // Attach Shadow DOM (closed) and mount point
  const shadowRoot = container.attachShadow({ mode: 'closed' });

  // Inject styles into shadow root so the widget is fully encapsulated
  const styleEl = document.createElement('style');
  styleEl.textContent = shadowStyles;
  shadowRoot.appendChild(styleEl);

  // Create a mount element inside the shadow root for React
  const mountEl = document.createElement('div');
  mountEl.id = 'marketrix-widget-root';
  // Ensure mount element can receive pointer events
  mountEl.style.pointerEvents = 'auto';
  shadowRoot.appendChild(mountEl);

  return { container, shadowRoot, mountEl };
};

/**
 * Mount widget component to the provided mount element
 * Returns the React root instance
 */
export const mountWidget = (mountEl: HTMLElement, config: MarketrixConfig): Root => {
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
 */
export const destroyWidgetContainer = (): void => {
  const container = document.getElementById('marketrix-widget-container');
  if (container) {
    container.remove();
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

  const scripts = document.querySelectorAll('script[marketrix-id], script[marketrix-agent]');
  const scriptElement = scripts[scripts.length - 1];

  if (scriptElement && isHTMLScriptElement(scriptElement)) {
    const script = scriptElement;
    const marketrixId = script.getAttribute('marketrix-id');
    const marketrixKey = script.getAttribute('marketrix-key');
    const agentId = script.getAttribute('marketrix-agent');
    const connectionId = script.getAttribute('marketrix-connection-id');

    if (marketrixId && marketrixKey) {
      const config: MarketrixConfig = {
        marketrixId,
        marketrixKey,
      };
      initWidgetFunction(config).catch((error) => {
        console.error('Failed to initialize widget:', error);
      });
    } else if (agentId && connectionId) {
      const config: MarketrixConfig = {
        agentId: Number.parseInt(agentId),
        connectionId: Number.parseInt(connectionId),
      };
      initWidgetFunction(config).catch((error) => {
        console.error('Failed to initialize widget:', error);
      });
    } else {
      showWidgetSettingsLoader(
        'Please configure marketrix_id and marketrix_key, or marketrix-agent and marketrix-connection-id'
      );
    }
  } else {
    showWidgetSettingsLoader(
      'Please configure marketrix_id and marketrix_key, or marketrix-agent and marketrix-connection-id'
    );
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
