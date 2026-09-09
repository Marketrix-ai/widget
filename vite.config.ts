/**
 * Vite config for the widget package. The default export branches on `command`: `build` is the
 * library-mode production build emitting the single ESM bundle `dist/widget.mjs` plus its declaration
 * tree; anything else is the dev server serving that same public URL straight from source.
 *
 * Production adds one plugin beside `react()`: `typescript-declarations` shells out to
 * `tsc -p tsconfig.build.json` at `closeBundle` — declarations aren't a rolldown output — and re-throws
 * on failure so a broken `.d.ts` tree fails the build rather than shipping stale types. Dev adds
 * `widget-dev-routing`, rewriting `/widget.mjs` to `/src/index.tsx` so a page embedding the production
 * URL works against the dev server, on PORT/VITE_PORT (default 9001), CORS open since hosts are cross-origin.
 *
 * `codeSplitting: false` belongs on `rolldownOptions.output` — Vite reads it from the rolldown output,
 * never from `build`, where it was a no-op that read like a guarantee for the single-chunk packaging
 * contract. The `process` defines exist since the bundle runs with no Node globals: a surviving
 * `process.env` read is a runtime ReferenceError there. React stays external, supplied via the host's
 * importmap. `use-sync-external-store/shim` (a transitive `@base-ui/*` dependency for pre-18 React
 * only) is aliased to the local React-backed shim so the legacy CJS package never enters the bundle.
 * `sourcemap: 'hidden'` keeps the bundle from advertising a map it never publishes. `SRC_ALIAS` is
 * declared once and reused by both branches, since separate copies of the same mapping drift silently.
 */
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { cwd } from 'node:process';

import react from '@vitejs/plugin-react';
import { defineConfig, type ViteDevServer } from 'vite';

const BUNDLE_FILE = 'widget.mjs';
const ENTRY_FILE = 'src/index.tsx';
const SRC_ALIAS = { find: '@', replacement: resolve(cwd(), 'src') };

export default defineConfig(({ command }) => {
  const isProduction = command === 'build';

  if (isProduction) {
    return {
      mode: 'production',
      resolve: {
        alias: [
          SRC_ALIAS,
          {
            find: /^use-sync-external-store\/shim(?:\/with-selector)?$/,
            replacement: resolve(cwd(), 'src/useSyncExternalStoreShim.ts'),
          },
        ],
      },
      define: {
        'process.env.NODE_ENV': '"production"',
        'process.env': '{}',
        'global.process': 'undefined',
        process: 'undefined',
      },
      css: { devSourcemap: false },
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: 'hidden',
        minify: 'terser',
        target: 'esnext',
        cssCodeSplit: false,
        lib: {
          entry: ENTRY_FILE,
          formats: ['es'],
          fileName: 'widget',
        },
        rolldownOptions: {
          external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
          output: {
            entryFileNames: BUNDLE_FILE,
            format: 'es',
            codeSplitting: false,
          },
        },
        terserOptions: {
          module: true,
          toplevel: true,
          compress: {
            drop_console: ['log', 'info', 'debug'],
            drop_debugger: true,
            module: true,
            toplevel: true,
            passes: 3,
          },
          mangle: { toplevel: true },
          format: {
            comments: false,
          },
        },
      },
      plugins: [
        react(),
        {
          name: 'typescript-declarations',
          closeBundle() {
            try {
              console.log('Generating TypeScript declarations...');
              execSync('tsc -p tsconfig.build.json', { stdio: 'inherit', cwd: cwd() });
              console.log('✓ TypeScript declarations generated');
            } catch (error) {
              console.error('TypeScript declaration generation failed');
              throw error;
            }
          },
        },
      ],
    };
  }

  return {
    resolve: { alias: [SRC_ALIAS] },
    plugins: [
      react(),
      {
        name: 'widget-dev-routing',
        configureServer(server: ViteDevServer) {
          server.middlewares.use((req, _res, next) => {
            if (req.url === '/widget.mjs') req.url = '/src/index.tsx';
            next();
          });
        },
      },
    ],
    appType: 'mpa',
    root: '.',
    server: {
      port: parseInt(process.env.PORT || process.env.VITE_PORT || '9001', 10),
      cors: true,
      headers: { 'Access-Control-Allow-Origin': '*' },
    },
  };
});
