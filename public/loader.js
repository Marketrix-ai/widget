/**
 * The classic script-tag bootstrap, served as `dist/loader.js`. Must sit in <head> before any
 * <script type="module">: it writes the importmap those modules resolve `react`/`react-dom` against
 * (esm.sh, React 19 — the bundle keeps React external and the host must supply it), then appends
 * `widget.mjs` as a module script next to itself, copying every `mtx-*` attribute from its own tag so
 * the widget auto-initializes with the host's settings. It runs unbundled, so it sticks to syntax every
 * module-capable browser already parses. A host whose own import map already maps all four React specifiers
 * gets no second map, since Firefox and browsers older than Chrome 133 or Safari 18.4 ignore a second map.
 */
(function () {
  var imports = {
    react: 'https://esm.sh/react@19',
    'react-dom': 'https://esm.sh/react-dom@19',
    'react-dom/client': 'https://esm.sh/react-dom@19/client',
    'react/jsx-runtime': 'https://esm.sh/react@19/jsx-runtime',
  };
  var hostMapped = {};
  document.querySelectorAll('script[type="importmap"]').forEach(function (existing) {
    Object.assign(hostMapped, JSON.parse(existing.textContent || '{}').imports);
  });
  var missing = Object.keys(imports).filter(function (key) {
    return !(key in hostMapped);
  });

  if (missing.length > 0) {
    var map = document.createElement('script');
    map.type = 'importmap';
    map.textContent = JSON.stringify({ imports: imports });
    document.head.appendChild(map);
  }

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
