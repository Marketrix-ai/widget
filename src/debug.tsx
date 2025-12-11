/**
 * Debug Entry Point
 *
 * Separate entry point for the debug panel.
 * This creates a standalone debug overlay that can be loaded alongside the widget.
 *
 * Usage:
 *   <script src="debug.js"></script>
 *
 * Or in development:
 *   <script type="module" src="http://localhost:5173/src/debug.tsx"></script>
 */

import React from 'react';
import { createRoot } from 'react-dom/client';

import { DebugPanel } from './components/debug/DebugPanel';
import { devTestService } from './services/DevTestService';
import { domService } from './services/DomService';
import { initDevTools } from './utils/devTools';

// Initialize dev tools (console helpers)
initDevTools();

// Expose services on window for test.html
declare global {
  interface Window {
    devTestService: typeof devTestService;
    domService: typeof domService;
  }
}
window.devTestService = devTestService;
window.domService = domService;

// Create container for debug panel
function createDebugContainer(): HTMLElement {
  // Check if container already exists
  let container = document.getElementById('marketrix-debug-container');
  if (container) {
    return container;
  }

  // Create new container
  container = document.createElement('div');
  container.id = 'marketrix-debug-container';
  document.body.appendChild(container);

  return container;
}

// Mount debug panel
function mountDebugPanel(): void {
  const container = createDebugContainer();
  const root = createRoot(container);

  root.render(
    <React.StrictMode>
      <DebugPanel />
    </React.StrictMode>
  );

  console.log('[Debug] Debug panel mounted. Press Ctrl+Shift+D to toggle visibility.');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountDebugPanel);
} else {
  mountDebugPanel();
}

// Export for manual initialization
export { mountDebugPanel };
