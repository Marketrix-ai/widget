/**
 * Cleanup Utilities
 *
 * Consolidated cleanup functions for widget elements and state.
 * Reduces code duplication across components.
 */

import { removeElementById, removeStepHighlights } from './dom';
import { isBrowser } from './validation';

/**
 * Remove tour spotlight and description overlays
 */
export function cleanupTourElements(): void {
  if (!isBrowser()) {
    return;
  }

  removeElementById('step-spotlight');
  removeElementById('step-description');
}

/**
 * Remove typewriter cursor styles
 */
export function cleanupTypewriterStyles(): void {
  if (!isBrowser()) {
    return;
  }

  removeElementById('typewriter-cursor-style');
}

/**
 * Remove all step highlight classes and handlers
 */
export function cleanupStepHighlights(): void {
  if (!isBrowser()) {
    return;
  }

  removeStepHighlights();
}

/**
 * Master cleanup function that removes all widget-related DOM elements
 * This consolidates cleanup logic from clearChatHistory, removeStepHighlights, etc.
 */
export function cleanupAllWidgetElements(): void {
  if (!isBrowser()) {
    return;
  }

  // Remove tour elements
  cleanupTourElements();

  // Remove step highlights
  cleanupStepHighlights();

  // Remove typewriter styles
  cleanupTypewriterStyles();
}
