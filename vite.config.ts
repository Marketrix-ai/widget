/**
 * Vite config for the widget package. The default export branches on `command`: `build` is the library-mode
 * production build that emits the single ESM bundle `dist/widget.mjs` plus its declaration tree, and anything
 * else is the dev server that serves that same public URL straight from source.
 *
 * Production adds one plugin beside `react()`: `typescript-declarations` shells out to
 * `tsc -p tsconfig.build.json` at `closeBundle` — declarations are not a rolldown output, so they are a
 * separate compile — and re-throws on failure so a broken `.d.ts` tree fails the build rather than shipping a
 * package whose types are stale or missing. Dev adds `widget-dev-routing`, a middleware rewriting `/widget.mjs`
 * to `/src/index.tsx` so a host page embedding the production URL works unchanged against the dev server; the
 * server listens on PORT/VITE_PORT (default 9001) with CORS open, because host pages are always cross-origin.
 *
 * `codeSplitting: false` belongs on `rolldownOptions.output` — Vite reads it from the rolldown output and never
 * from `build`, where it was a no-op that read like a guarantee and the single-chunk packaging contract had
 * none. The `process` defines exist because the bundle runs inside arbitrary host pages with no Node globals:
 * any `process.env` read surviving from a dependency is a runtime ReferenceError there. React and its runtimes
 * stay external — the host page supplies React 19 through its importmap. `use-sync-external-store/shim`
 * (and `/with-selector`), a transitive `@base-ui/*` dependency that exists only for pre-18 React, is aliased to
 * the local React-backed shim so the legacy CJS package never enters the bundle. Terser gets `module` and
 * `toplevel` because the output is ESM-only and may therefore assume module scope and mangle top-level names.
 * `sourcemap: 'hidden'` still builds the map but keeps the bundle from advertising one it never publishes.
 * `SRC_ALIAS` is declared once and reused by both branches — the two of them held separate copies of the
 * same `@` → `src` mapping, which is the kind of pair that drifts silently.
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
