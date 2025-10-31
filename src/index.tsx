import './index.css';
import shadowStyles from './index.css?inline';

import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { MarketrixWidget } from './components/MarketrixWidget';
import type { MarketrixConfig } from './types';

// Global widget instance and demo functions
let widgetInstance: Root | null = null;

// Initialize the widget
export const initMarketrixWidget = (config: MarketrixConfig): void => {
  // Validate required config
  if (!config.marketrixId || !config.marketrixKey) {
    console.error('Marketrix Widget: marketrixId and marketrixKey are required');
    return;
  }

  // Prevent double initialization
  if (widgetInstance) {
    console.warn('Marketrix Widget: already initialized');
    return;
  }

  // Store current config
  currentConfig = config;

  // Create container if it doesn't exist
  let container = document.getElementById('marketrix-widget-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'marketrix-widget-container';
    container.className = 'marketrix-widget-container';
    // Ensure container can receive pointer events
    (container as HTMLElement).style.pointerEvents = 'auto';
    document.body.appendChild(container);
  } else {
    // Ensure existing container has pointer events enabled
    (container as HTMLElement).style.pointerEvents = 'auto';
  }

  // Attach Shadow DOM (closed) and mount point
  // Note: closed shadow root is not accessible later; we keep references locally only during init
  const shadowRoot = (container as HTMLElement).attachShadow({ mode: 'closed' });

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

  // Create React root and render widget within the shadow root
  const root = createRoot(mountEl);
  widgetInstance = root;

  root.render(
    <React.StrictMode>
      <MarketrixWidget config={config} />
    </React.StrictMode>
  );

  console.log('Marketrix Widget initialized successfully');
};

// Destroy the widget
export const destroyMarketrixWidget = (): void => {
  if (widgetInstance) {
    widgetInstance.unmount();
    widgetInstance = null;
    currentConfig = null;

    // Remove container
    const container = document.getElementById('marketrix-widget-container');
    if (container) {
      container.remove();
    }

    console.log('Marketrix Widget destroyed');
  }
};

// Update widget configuration
export const updateMarketrixConfig = (newConfig: Partial<MarketrixConfig>): void => {
  if (widgetInstance) {
    // Re-initialize with updated config
    const currentConfig = getCurrentConfig();
    const updatedConfig = { ...currentConfig, ...newConfig };
    destroyMarketrixWidget();
    initMarketrixWidget(updatedConfig);
  }
};

// Get current configuration
let currentConfig: MarketrixConfig | null = null;

export const getCurrentConfig = (): MarketrixConfig => {
  if (!currentConfig) {
    throw new Error('Widget not initialized');
  }
  return currentConfig;
};

// Auto-initialize if script is loaded with data attributes
document.addEventListener('DOMContentLoaded', () => {
  console.log(
    '------------------------------ DOMContentLoaded -----------------------------------'
  );

  // Find the script tag with marketrix attributes
  const scripts = document.querySelectorAll('script[marketrix-id][marketrix-key]');
  const script = scripts[scripts.length - 1] as HTMLScriptElement; // Get the last one (most likely the current one)

  if (script) {
    const marketrixId = script.getAttribute('marketrix-id');
    const marketrixKey = script.getAttribute('marketrix-key');

    console.log('Found script with marketrix attributes:', { marketrixId, marketrixKey });

    if (marketrixId && marketrixKey) {
      const config: MarketrixConfig = {
        marketrixId,
        marketrixKey,
        position:
          (script.getAttribute('data-position') as 'bottom_right' | 'bottom_left') ??
          'bottom_right',
        theme: (script.getAttribute('data-theme') as 'light' | 'dark' | null) ?? 'light',
        // Avatar and agent info are now handled through atmosphere config
        enabledModes: (script.getAttribute('data-enabled-modes')?.split(',') as (
          | 'show'
          | 'tell'
          | 'do'
        )[]) || ['show', 'tell', 'do'],
      };

      console.log('Auto-initializing widget with config:', config);
      initMarketrixWidget(config);
    }
  } else {
    console.log('No script with marketrix attributes found');
  }
});

// Export types for external use
export type { ChatMessage, ChatMode, MarketrixConfig, Theme, WidgetState } from './types';

// Export default for ES modules
export default {
  initMarketrixWidget,
  destroyMarketrixWidget,
  updateMarketrixConfig,
  getCurrentConfig,
};
