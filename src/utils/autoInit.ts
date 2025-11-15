/**
 * Auto-Initialization Utilities
 *
 * Handles automatic widget initialization from script tag data attributes.
 * Parses script attributes and initializes the widget accordingly.
 */

import type { MarketrixConfig } from '../types';
import {
  parseEnabledModesAttribute,
  parsePositionAttribute,
  parseThemeAttribute,
} from './attributeParsers';
import { isHTMLScriptElement } from './typeGuards';
import { showWidgetSettingsLoader } from './widgetLoader';

// Store the init function to avoid closure issues
let initWidgetFunction: ((config: MarketrixConfig) => Promise<void>) | null = null;

/**
 * Auto-initialize widget from script tag attributes
 */
const autoInitializeWidget = (): void => {
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
      if (initWidgetFunction) {
        initWidgetFunction(config).catch((error) => {
          console.error('Failed to initialize widget:', error);
        });
      }
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
      if (initWidgetFunction) {
        initWidgetFunction(config).catch((error) => {
          console.error('Failed to initialize widget:', error);
        });
      }
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
};

/**
 * Setup auto-initialization on DOMContentLoaded
 * @param initWidget - Function to initialize the widget (passed to avoid circular dependency)
 */
export const setupAutoInit = (initWidget: (config: MarketrixConfig) => Promise<void>): void => {
  // Validate function is provided
  if (typeof initWidget !== 'function') {
    console.error('setupAutoInit: initWidget must be a function', initWidget);
    return;
  }

  // Store the function reference
  initWidgetFunction = initWidget;

  // Create a wrapper that ensures the function is set
  const initializeWhenReady = (): void => {
    if (!initWidgetFunction) {
      console.error('initWidget function not set. Cannot auto-initialize widget.');
      return;
    }
    autoInitializeWidget();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWhenReady);
  } else {
    // DOM is already loaded - use setTimeout to ensure function is set
    setTimeout(initializeWhenReady, 0);
  }
};
