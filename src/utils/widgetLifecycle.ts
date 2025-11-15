/**
 * Widget Lifecycle Management
 *
 * Manages widget instance state and lifecycle operations.
 * Centralizes widget instance management.
 */

import type { Root } from 'react-dom/client';

import type { MarketrixConfig } from '../types';

// Global widget instance state
let widgetInstance: Root | null = null;
let currentConfig: MarketrixConfig | null = null;

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
