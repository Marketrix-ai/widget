/**
 * Widget Loader Management
 *
 * Utility functions for showing and hiding the widget settings loader.
 * Handles all DOM manipulation for the loader component.
 */

import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { WidgetSettingsLoader } from '../components/WidgetSettingsLoader';
import shadowStyles from '../index.css?inline';

// Global loader instance
let loaderInstance: Root | null = null;

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
