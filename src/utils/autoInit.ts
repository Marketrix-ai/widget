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
import { isHTMLScriptElement } from './validation/typeGuards';
import { showWidgetSettingsLoader } from './widgetInitializer';

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
 *
 * @param initWidget - Function to initialize the widget (passed to avoid circular dependency)
 */
export const registerAutoInit = (initWidget: (config: MarketrixConfig) => Promise<void>): void => {
  if (typeof initWidget !== 'function') {
    console.error('[AutoInit] initWidget must be a function');
    return;
  }

  initWidgetFunction = initWidget;
  const readyState = document.readyState;

  if (readyState === 'complete' || readyState === 'interactive') {
    initializeWhenReady();
  } else if (readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWhenReady, { once: true });
  } else {
    initializeWhenReady();
  }
};
