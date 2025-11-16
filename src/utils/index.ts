/**
 * Utils Barrel Export
 *
 * Centralized exports for all utility functions organized by category.
 */

// API utilities
export * from './apiUtils';

// Config utilities
export { ConfigManager, configManager } from './configManager';
export * from './configManager';

// DOM utilities
export * from './attributeParsers';
export * from './elementHighlighting';
export * from './widgetPositioning';

// Widget utilities
export * from './widgetInitializer';

// Storage utilities
export * from './chatStorage';

// Text utilities
export * from './textFormatting';

// Core utilities
export * from './autoInit';
export * from './typeGuards';
