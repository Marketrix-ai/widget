// Must sit in <head> before any <script type="module"> — it defines the importmap they resolve against.
(function () {
  var existing = {};
  var oldMap = document.querySelector('script[type="importmap"]');
  if (oldMap) {
    try {
      existing = JSON.parse(oldMap.textContent).imports || {};
    } catch (e) {}
    oldMap.remove();
  }

  // Host mappings win — `existing` is spread last so a host already on React 19 keeps its own build.
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

  var self = document.currentScript;
  var base = new URL('.', self.src).href;

  var widget = document.createElement('script');
  widget.type = 'module';
  widget.src = base + 'widget.mjs';

  Array.from(self.attributes).forEach(function (attr) {
    if (attr.name.startsWith('mtx-')) widget.setAttribute(attr.name, attr.value);
  });

  document.head.appendChild(widget);
})();
