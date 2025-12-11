/**
 * Persistence utilities for bookmarklet usage
 * Handles storing and restoring widget configuration for bookmarklet scenarios
 */

import type { MarketrixConfig } from '../types';

const BOOKMARKLET_STORAGE_KEY = 'marketrix_bookmarklet_config';

/**
 * Check if there's a stored bookmarklet config and re-inject the widget
 * This is called on page load to restore widget state from bookmarklet usage
 */
export const checkAndReinjectOnLoad = (): void => {
  if (typeof window === 'undefined') return;

  try {
    const stored = localStorage.getItem(BOOKMARKLET_STORAGE_KEY);
    if (!stored) return;

    const config = JSON.parse(stored) as MarketrixConfig;
    if (!config) return;

    // Clear the stored config after reading
    localStorage.removeItem(BOOKMARKLET_STORAGE_KEY);

    // The actual re-injection will be handled by the auto-init system
    // This function just clears stale data
  } catch (error) {
    console.warn('Failed to check bookmarklet persistence:', error);
    // Clear potentially corrupted data
    localStorage.removeItem(BOOKMARKLET_STORAGE_KEY);
  }
};

/**
 * Initialize persistence for bookmarklet usage
 * Sets up storage mechanism for widget configuration
 */
export const initializePersistence = (): void => {
  if (typeof window === 'undefined') return;

  // Persistence is handled by ConfigManager
  // This function is a placeholder for future bookmarklet-specific persistence logic
  // Currently, the widget uses ConfigManager for all persistence needs
};
