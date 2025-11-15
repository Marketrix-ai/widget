import './index.css';

import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { MarketrixWidget } from './components/MarketrixWidget';
import { WidgetSettingsLoader } from './components/WidgetSettingsLoader';
import { DEFAULT_FALLBACK_WIDGET_SETTINGS } from './constants/defaultWidgetSettings';
import { DEFAULT_WIDGET_ATMOSPHERE } from './constants/widget';
import shadowStyles from './index.css?inline';
import { WidgetValidationService } from './services/widgetValidationService';
import type { MarketrixConfig } from './types';
import { isHTMLElement, isHTMLScriptElement } from './utils/typeGuards';

// Global widget instance and demo functions
let widgetInstance: Root | null = null;
let loaderInstance: Root | null = null;

/**
 * Parse position attribute from script tag
 */
function parsePositionAttribute(value: string | null): 'bottom_right' | 'bottom_left' {
  if (value === 'bottom_left' || value === 'bottom_right') {
    return value;
  }
  return 'bottom_right';
}

/**
 * Parse theme attribute from script tag
 */
function parseThemeAttribute(value: string | null): 'light' | 'dark' {
  if (value === 'light' || value === 'dark') {
    return value;
  }
  return 'light';
}

/**
 * Parse enabled modes attribute from script tag
 */
function parseEnabledModesAttribute(value: string | null): ('show' | 'tell' | 'do')[] {
  if (!value) {
    return ['show', 'tell', 'do'];
  }

  const modes = value.split(',').map((m) => m.trim());
  const validModes: ('show' | 'tell' | 'do')[] = [];

  for (const mode of modes) {
    if (mode === 'show' || mode === 'tell' || mode === 'do') {
      validModes.push(mode);
    }
  }

  return validModes.length > 0 ? validModes : ['show', 'tell', 'do'];
}

/**
 * Show default widget settings loader
 */
const showWidgetSettingsLoader = (message?: string): void => {
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
const hideWidgetSettingsLoader = (): void => {
  if (loaderInstance) {
    loaderInstance.unmount();
    loaderInstance = null;

    const loaderContainer = document.getElementById('marketrix-widget-loader-container');
    if (loaderContainer) {
      loaderContainer.remove();
    }
  }
};

// Initialize the widget
export const initMarketrixWidget = async (config: MarketrixConfig): Promise<void> => {
  // Prevent double initialization
  if (widgetInstance) {
    console.warn('Marketrix Widget: already initialized');
    return;
  }

  const validationService = new WidgetValidationService();
  let shouldUseDefaultSettings = false;
  let fallbackValidationResult = null;

  // Check if marketrix_id and marketrix_key are available
  if (!config.marketrixId || !config.marketrixKey) {
    console.warn(
      'Marketrix Widget: marketrixId and marketrixKey are not available. Attempting fallback validation...'
    );

    // Check if marketrix-agent and marketrix-connection-id are provided
    if (config.agentId && config.connectionId) {
      console.log('📋 Using marketrix-agent and marketrix-connection-id for validation:', {
        agentId: config.agentId,
        connectionId: config.connectionId,
      });

      // Show loader during validation
      showWidgetSettingsLoader('Validating agent and connection...');

      // Validate by marketrix-agent and marketrix-connection-id
      fallbackValidationResult = await validationService.validateByAgentAndConnection(
        config.agentId,
        config.connectionId
      );

      if (!fallbackValidationResult.isValid) {
        console.error('Agent and Connection validation failed:', fallbackValidationResult.error);
        showWidgetSettingsLoader(
          fallbackValidationResult.error ||
            'Unable to validate agent and connection. Please check the provided IDs.'
        );
        return;
      }

      // Validation successful - log connection and agent details
      console.log('✅ Connection and Agent are available!', {
        connection_id: fallbackValidationResult.connectionId,
        agent_id: fallbackValidationResult.agentId,
        connection: {
          id: fallbackValidationResult.connection?.id,
          name: fallbackValidationResult.connection?.name,
          type: fallbackValidationResult.connection?.type,
        },
        agent: {
          id: fallbackValidationResult.agent?.id,
          agent_name: fallbackValidationResult.agent?.agent_name,
        },
      });

      // Use default settings when validation succeeds
      shouldUseDefaultSettings = true;
      console.log('✅ Applying default widget settings');

      hideWidgetSettingsLoader();
    } else {
      // Show loader during fallback validation
      showWidgetSettingsLoader('Validating connection and agent...');

      // Use fallback validation: fetch connection and agent
      fallbackValidationResult = await validationService.validateWithFallback(config.connectionId);

      if (!fallbackValidationResult.isValid) {
        console.error('Fallback validation failed:', fallbackValidationResult.error);
        showWidgetSettingsLoader(
          fallbackValidationResult.error ||
            'Unable to validate connection and agent. Please configure marketrix_id and marketrix_key, or provide marketrix-agent and marketrix-connection-id.'
        );
        return;
      }

      // Validation successful - log connection_id and agent_id to console
      console.log('✅ Fallback validation successful!', {
        connection_id: fallbackValidationResult.connectionId,
        agent_id: fallbackValidationResult.agentId,
        connection: fallbackValidationResult.connection,
        agent: fallbackValidationResult.agent,
      });

      // Use default settings when fallback validation succeeds
      shouldUseDefaultSettings = true;
      hideWidgetSettingsLoader();
    }
  } else {
    // Show loader during validation
    showWidgetSettingsLoader('Validating widget configuration...');

    // Validate widget (check agent and connection exist)
    const validationResult = await validationService.validateWidget(
      config.marketrixId,
      config.marketrixKey
    );

    if (!validationResult.isValid) {
      console.error('Marketrix Widget validation failed:', validationResult.error);
      showWidgetSettingsLoader(
        validationResult.error || 'Widget validation failed. Please check your configuration.'
      );
      return;
    }

    // Hide loader after successful validation
    hideWidgetSettingsLoader();
  }

  // Prepare config with default settings if needed
  let finalConfig = config;

  if (shouldUseDefaultSettings) {
    // Create a config with default settings embedded
    // We'll store default settings in a way that MarketrixWidget can access them
    finalConfig = {
      ...config,
      // Add default settings to config for widget to use
      atmosphere: {
        ...DEFAULT_WIDGET_ATMOSPHERE,
        ...config.atmosphere,
        widget_settings: DEFAULT_FALLBACK_WIDGET_SETTINGS,
        session_time: config.atmosphere?.session_time ?? 0,
        recorded_time: config.atmosphere?.recorded_time ?? 0,
      },
    };

    console.log('Using default widget settings:', DEFAULT_FALLBACK_WIDGET_SETTINGS);
  }

  // Store current config
  currentConfig = finalConfig;

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

  // Attach Shadow DOM (closed) and mount point
  // Note: closed shadow root is not accessible later; we keep references locally only during init
  if (!isHTMLElement(container)) {
    throw new Error('Container is not an HTMLElement');
  }
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

  // Create React root and render widget within the shadow root
  const root = createRoot(mountEl);
  widgetInstance = root;

  root.render(
    <React.StrictMode>
      <MarketrixWidget config={finalConfig} />
    </React.StrictMode>
  );

  if (shouldUseDefaultSettings && fallbackValidationResult) {
    console.log('Marketrix Widget initialized successfully with default settings', {
      connection_id: fallbackValidationResult.connectionId,
      agent_id: fallbackValidationResult.agentId,
      settings: DEFAULT_FALLBACK_WIDGET_SETTINGS,
    });
  } else {
    console.log('Marketrix Widget initialized successfully');
  }
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

  // Also hide loader if present
  hideWidgetSettingsLoader();
};

// Update widget configuration
export const updateMarketrixConfig = async (newConfig: Partial<MarketrixConfig>): Promise<void> => {
  if (widgetInstance) {
    // Re-initialize with updated config
    const currentConfig = getCurrentConfig();
    const updatedConfig = { ...currentConfig, ...newConfig };
    destroyMarketrixWidget();
    await initMarketrixWidget(updatedConfig);
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

  // Find the script tag with marketrix attributes (check for either marketrix-id/key or marketrix-agent/marketrix-connection-id)
  const scripts = document.querySelectorAll('script[marketrix-id], script[marketrix-agent]');
  const scriptElement = scripts[scripts.length - 1]; // Get the last one (most likely the current one)

  if (scriptElement && isHTMLScriptElement(scriptElement)) {
    const script = scriptElement;
    const marketrixId = script.getAttribute('marketrix-id');
    const marketrixKey = script.getAttribute('marketrix-key');
    const agentId = script.getAttribute('marketrix-agent');
    const connectionId = script.getAttribute('marketrix-connection-id');

    console.log('Found script with attributes:', {
      marketrixId,
      marketrixKey,
      agentId,
      connectionId,
    });

    // Check if we have marketrix credentials or agent/connection IDs
    if (marketrixId && marketrixKey) {
      // Use marketrix credentials
      const config: MarketrixConfig = {
        marketrixId,
        marketrixKey,
        position: parsePositionAttribute(script.getAttribute('data-position')),
        theme: parseThemeAttribute(script.getAttribute('data-theme')),
        // Avatar and agent info are now handled through atmosphere config
        enabledModes: parseEnabledModesAttribute(script.getAttribute('data-enabled-modes')),
      };

      console.log('Auto-initializing widget with marketrix credentials:', config);
      initMarketrixWidget(config).catch((error) => {
        console.error('Failed to initialize widget:', error);
      });
    } else if (agentId && connectionId) {
      // Use marketrix-agent and marketrix-connection-id
      const config: MarketrixConfig = {
        agentId: Number.parseInt(agentId, 10),
        connectionId: Number.parseInt(connectionId, 10),
        position: parsePositionAttribute(script.getAttribute('data-position')),
        theme: parseThemeAttribute(script.getAttribute('data-theme')),
        enabledModes: parseEnabledModesAttribute(script.getAttribute('data-enabled-modes')),
      };

      console.log(
        'Auto-initializing widget with marketrix-agent and marketrix-connection-id:',
        config
      );
      initMarketrixWidget(config).catch((error) => {
        console.error('Failed to initialize widget:', error);
      });
    } else {
      // Show loader if credentials are missing
      console.warn(
        'Marketrix Widget: Please provide either (marketrix-id + marketrix-key) OR (marketrix-agent + marketrix-connection-id)'
      );
      showWidgetSettingsLoader(
        'Please configure marketrix_id and marketrix_key, or marketrix-agent and marketrix-connection-id'
      );
    }
  } else {
    console.log('No script with marketrix or marketrix-agent attributes found');
    // Show loader if no script attributes found
    showWidgetSettingsLoader(
      'Please configure marketrix_id and marketrix_key, or marketrix-agent and marketrix-connection-id'
    );
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
