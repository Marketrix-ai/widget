/**
 * Widget Initialization Utilities
 *
 * Handles widget container creation, shadow DOM setup, and mounting.
 * Isolates all DOM manipulation for widget initialization.
 */

import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { MarketrixWidget } from '../components/MarketrixWidget';
import shadowStyles from '../index.css?inline';
import type { MarketrixConfig } from '../types';
import { isHTMLElement } from './typeGuards';

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
      <MarketrixWidget config={config} />
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
