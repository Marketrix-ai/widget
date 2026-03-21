/**
 * Marketrix Widget Loader
 *
 * Static bootstrap script that:
 * 1. Injects an importmap for React dependencies (merges with existing if present)
 * 2. Creates a module script that loads widget.mjs from the same origin
 * 3. Passes through all mtx-* attributes from this script tag
 *
 * Usage: <script src="https://widget.marketrix.ai/loader.js" mtx-id="..." mtx-key="..."></script>
 * Must be placed in <head> before any <script type="module"> tags.
 */
(function () {
  // Collect existing importmap entries (if any)
  var existing = {};
  var oldMap = document.querySelector('script[type="importmap"]');
  if (oldMap) {
    try {
      existing = JSON.parse(oldMap.textContent).imports || {};
    } catch (e) {}
    oldMap.remove();
  }

  // React dependencies — host mappings win, our defaults fill gaps
  var defaults = {
    react: 'https://esm.sh/react@19',
    'react-dom': 'https://esm.sh/react-dom@19',
    'react-dom/client': 'https://esm.sh/react-dom@19/client',
    'react/jsx-runtime': 'https://esm.sh/react@19/jsx-runtime',
  };

  var merged = Object.assign({}, defaults, existing);

  var map = document.createElement('script');
  map.type = 'importmap';
  map.textContent = JSON.stringify({ imports: merged });
  document.head.appendChild(map);

  // Derive base URL from our own script src
  var self = document.currentScript;
  var base = new URL('.', self.src).href;

  // Create module script for the widget
  var widget = document.createElement('script');
  widget.type = 'module';
  widget.src = base + 'widget.mjs';

  // Pass through all mtx-* attributes
  Array.from(self.attributes).forEach(function (attr) {
    if (attr.name.startsWith('mtx-')) widget.setAttribute(attr.name, attr.value);
  });

  document.head.appendChild(widget);
})();
