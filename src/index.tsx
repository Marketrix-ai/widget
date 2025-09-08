import React from 'react';
import { createRoot } from 'react-dom/client';
import { MarketrixWidget } from './components/MarketrixWidget';
import { MarketrixConfig } from './types';
import './index.css';

// Global widget instance
let widgetInstance: any = null;

// Initialize the widget
export const initMarketrixWidget = (config: MarketrixConfig): void => {
  // Validate required config
  if (!config.marketrixId || !config.marketrixKey) {
    console.error('Marketrix Widget: marketrixId and marketrixKey are required');
    return;
  }

  // Create container if it doesn't exist
  let container = document.getElementById('marketrix-widget-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'marketrix-widget-container';
    container.className = 'marketrix-widget-container';
    document.body.appendChild(container);
  }

  // Create React root and render widget
  const root = createRoot(container);
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

// Get current configuration (placeholder - would need to be implemented with state management)
export const getCurrentConfig = (): MarketrixConfig => {
  // This would need to be implemented to return the current config
  // For now, return a placeholder
  return {
    marketrixId: '',
    marketrixKey: '',
  };
};

// Auto-initialize if script is loaded with data attributes
document.addEventListener('DOMContentLoaded', () => {
  const script = document.currentScript as HTMLScriptElement;
  if (script) {
    const marketrixId = script.getAttribute('data-marketrix-id');
    const marketrixKey = script.getAttribute('data-marketrix-key');
    
    if (marketrixId && marketrixKey) {
      const config: MarketrixConfig = {
        marketrixId,
        marketrixKey,
        position: (script.getAttribute('data-position') as any) || 'bottom-right',
        theme: (script.getAttribute('data-theme') as any) || 'light',
        avatarUrl: script.getAttribute('data-avatar-url') || undefined,
        agentName: script.getAttribute('data-agent-name') || undefined,
        enabledModes: script.getAttribute('data-enabled-modes')?.split(',') as any || ['show', 'tell', 'do'],
      };
      
      initMarketrixWidget(config);
    }
  }
});

// Export types for external use
export type { MarketrixConfig, ChatMessage, WidgetState, ChatMode, Theme } from './types';

// Export default for ES modules
export default {
  initMarketrixWidget,
  destroyMarketrixWidget,
  updateMarketrixConfig,
  getCurrentConfig,
};
