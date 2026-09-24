/**
 * Vite config for the widget package. The default export branches on `command`: `build` produces the
 * library-mode production bundle, anything else runs the dev server.
 *
 * Both alias the legacy `use-sync-external-store/shim` to the local stand-in, so dev and the bundle run the
 * same code. The production build adds a `typescript-declarations` plugin that generates the `.d.ts` tree
 * and keeps React external so the host page supplies it. The dev build adds `widget-dev-routing`, so a
 * page pointed at the production bundle URL also works against the dev server. The build target is the
 * supported-browser floor README documents, led by Safari 16.4, the first Safari with import maps.
 */
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { cwd } from 'node:process';

import react from '@vitejs/plugin-react';
import { defineConfig, type ViteDevServer } from 'vite';

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
