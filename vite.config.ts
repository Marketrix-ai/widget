import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { cwd } from 'node:process';

import react from '@vitejs/plugin-react';
import { defineConfig, type ViteDevServer } from 'vite';

const BUNDLE_FILE = 'widget.mjs';
const ENTRY_FILE = 'src/index.tsx';

const typescriptDeclarationPlugin = () => {
  return {
    name: 'typescript-declarations',
    async closeBundle() {
      try {
        console.log('Generating TypeScript declarations...');
        execSync('tsc -p tsconfig.build.json', { stdio: 'inherit', cwd: cwd() });
        console.log('✓ TypeScript declarations generated');
      } catch (error) {
        console.error('TypeScript declaration generation failed');
        throw error;
      }
    },
  };
};

export default defineConfig(({ command }) => {
  const isProduction = command === 'build';

  if (isProduction) {
    return {
      mode: 'production',
      resolve: {
        alias: [
          { find: '@', replacement: resolve(cwd(), 'src') },
          {
            find: /^use-sync-external-store\/shim(?:\/with-selector)?$/,
            replacement: resolve(cwd(), 'src/react19.ts'),
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
            // Vite reads this from the rolldown output, never from `build` — one level up it is a
            // no-op that reads like a guarantee, and the single-chunk packaging contract had none.
            codeSplitting: false,
          },
        },
        terserOptions: {
          // ESM-only output, so terser can assume module scope and mangle top-level names.
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
      plugins: [react(), typescriptDeclarationPlugin()],
    };
  }

  return {
    resolve: { alias: { '@': resolve(cwd(), 'src') } },
    plugins: [
      react(),
      // Rewrite /widget.mjs to the source entry so the production URL works in dev
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
