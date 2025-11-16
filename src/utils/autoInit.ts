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

import type { MarketrixConfig } from '../types';
import {
  parseEnabledModesAttribute,
  parsePositionAttribute,
  parseThemeAttribute,
} from './attributeParsers';
import { isHTMLScriptElement } from './typeGuards';
import { showWidgetSettingsLoader } from './widgetLoader';

// Store the init function - set synchronously during registration
let initWidgetFunction: ((config: MarketrixConfig) => Promise<void>) | null = null;

/**
 * Auto-initialize widget from script tag attributes
 * Only called when both function is registered AND DOM is ready
 */
const autoInitializeWidget = (): void => {
  // Validation: Function must be set (should never fail if called correctly)
  if (!initWidgetFunction) {
    console.error('[AutoInit] initWidget function not registered. Cannot auto-initialize widget.');
    return;
  }

  console.log(
    '------------------------------ DOMContentLoaded -----------------------------------'
  );

  // Find the script tag with marketrix attributes
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
        enabledModes: parseEnabledModesAttribute(script.getAttribute('data-enabled-modes')),
      };

      console.log('Auto-initializing widget with marketrix credentials:', config);
      initWidgetFunction(config).catch((error) => {
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
      initWidgetFunction(config).catch((error) => {
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
};

/**
 * Initialize when both function is registered AND DOM is ready
 * This ensures no race conditions
 */
const initializeWhenReady = (): void => {
  // Double-check function is set (defensive programming)
  if (!initWidgetFunction) {
    console.error('[AutoInit] initWidget function not registered when DOM became ready');
    return;
  }

  // DOM is ready, function is registered - safe to initialize
  autoInitializeWidget();
};

/**
 * Register the widget initialization function and set up auto-initialization
 *
 * This function:
 * 1. Stores the init function synchronously (no delays)
 * 2. Checks DOM ready state
 * 3. Either initializes immediately or waits for DOMContentLoaded
 *
 * @param initWidget - Function to initialize the widget (passed to avoid circular dependency)
 */
export const registerAutoInit = (initWidget: (config: MarketrixConfig) => Promise<void>): void => {
  // Validate function is provided
  if (typeof initWidget !== 'function') {
    console.error('[AutoInit] registerAutoInit: initWidget must be a function', initWidget);
    return;
  }

  // Step 1: Store function immediately (synchronous, no delays)
  initWidgetFunction = initWidget;

  // Step 2: Check DOM ready state and handle accordingly
  const readyState = document.readyState;

  if (readyState === 'complete' || readyState === 'interactive') {
    // DOM is ready (complete = fully loaded, interactive = DOM ready, resources may still load)
    // Initialize immediately since both conditions are met
    initializeWhenReady();
  } else if (readyState === 'loading') {
    // DOM is still loading - wait for DOMContentLoaded event
    document.addEventListener('DOMContentLoaded', initializeWhenReady, { once: true });
  } else {
    // Unknown state - try to initialize anyway (defensive)
    console.warn('[AutoInit] Unknown document.readyState:', readyState);
    initializeWhenReady();
  }
};
