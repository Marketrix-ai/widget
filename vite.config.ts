/**
 * Vite config for the widget package: `build` produces the library-mode bundle with React external and a
 * `typescript-declarations` plugin and writes `module-sizes.json` (each module's rendered bytes, read by
 * `check:bundle`), anything else runs the dev server with `widget-dev-routing` so a page pointed
 * at the production bundle URL also works. Both alias `use-sync-external-store/shim` to the local stand-in. The
 * build target is the browser floor README documents, led by Safari 16.4, the first Safari with import maps.
 */
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { cwd } from 'node:process';

import react from '@vitejs/plugin-react';
import { defineConfig, type ViteDevServer } from 'vite';

export const REACT_EXTERNALS = ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'];

const BUNDLE_FILE = 'widget.mjs';
const ENTRY_FILE = 'src/index.tsx';
const SHIM_ALIAS = {
  alias: [
    {
      find: /^use-sync-external-store\/shim(?:\/with-selector)?$/,
      replacement: resolve(cwd(), 'src/useSyncExternalStoreShim.ts'),
    },
  ],
};

export default defineConfig(({ command }) => {
  const isProduction = command === 'build';

  if (isProduction) {
    return {
      mode: 'production',
      resolve: SHIM_ALIAS,
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
        target: ['chrome111', 'edge111', 'firefox111', 'safari16.4'],
        cssCodeSplit: false,
        lib: {
          entry: ENTRY_FILE,
          formats: ['es'],
          fileName: 'widget',
        },
        rolldownOptions: {
          external: REACT_EXTERNALS,
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
            passes: 3,
          },
          format: { comments: false },
        },
      },
      plugins: [
        react(),
        {
          name: 'module-sizes',
          generateBundle(_options, bundle) {
            const sizes = Object.values(bundle).flatMap(output =>
              output.type === 'chunk'
                ? Object.entries(output.modules).map(([id, module]) => [id, module.renderedLength])
                : [],
            );
            this.emitFile({
              type: 'asset',
              fileName: 'module-sizes.json',
              source: JSON.stringify(Object.fromEntries(sizes)),
            });
          },
        },
        {
          name: 'typescript-declarations',
          closeBundle() {
            execSync('tsc -p tsconfig.build.json', { stdio: 'inherit', cwd: cwd() });
          },
        },
      ],
    };
  }

  return {
    resolve: SHIM_ALIAS,
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
      port: parseInt(process.env['PORT'] || process.env['VITE_PORT'] || '9001', 10),
      cors: true,
      headers: { 'Access-Control-Allow-Origin': '*' },
    },
  };
});
