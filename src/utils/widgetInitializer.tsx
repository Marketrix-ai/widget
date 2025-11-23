/**
 * Widget Initialization, Lifecycle, and Loader Utilities
 *
 * Handles widget container creation, shadow DOM setup, mounting, lifecycle management,
 * and loader display. Consolidates all widget-related DOM manipulation and state management.
 */

import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { MarketrixWidget } from '../components/marketrixWidget';
import { WidgetSettingsLoader } from '../components/ui/widgetSettingsLoader';
import { WidgetProvider } from '../context/WidgetContext';
import shadowStyles from '../index.css?inline';
import type { MarketrixConfig } from '../types';
import { isHTMLElement } from './validation/typeGuards';

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
