import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { cwd } from 'node:process';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { build, defineConfig, type UserConfig, type ViteDevServer } from 'vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

const OUT_DIR = '.vite-dev-build';
const BUNDLE_FILE = 'index.mjs';
const SOURCEMAP_FILE = 'index.mjs.map';
const BUNDLE_PATH = '/index.mjs';
const SOURCEMAP_PATH = '/index.mjs.map';
const SRC_DIR = 'src';
const ENTRY_FILE = 'src/index.tsx';

// Use an environment variable to determine if we are building the standalone version
const isStandalone = process.env.BUILD_MODE === 'standalone';

const getBuildConfig = (options: { minify: boolean | 'terser'; outDir: string }): UserConfig => ({
  mode: 'production',
  resolve: { alias: { '@': resolve(cwd(), 'src') } },
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env': '{}',
    'global.process': 'undefined',
    process: 'undefined',
    __BUILD_COMMIT__: JSON.stringify(process.env.BUILD_COMMIT || 'dev'),
  },
  css: { devSourcemap: false },
  build: {
    outDir: options.outDir,
    // Do not empty outDir if building standalone so we don't wipe the library build
    emptyOutDir: !isStandalone,
    sourcemap: true,
    minify: options.minify,
    target: 'esnext',
    cssCodeSplit: false,
    lib: {
      entry: ENTRY_FILE,
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: isStandalone ? [] : ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
      output: {
        entryFileNames: isStandalone ? 'standalone.mjs' : BUNDLE_FILE,
        format: 'es',
        inlineDynamicImports: true,
        globals: isStandalone
          ? {}
          : {
              react: 'React',
              'react-dom': 'ReactDOM',
              'react-dom/client': 'ReactDOMClient',
              'react/jsx-runtime': 'jsxRuntime',
            },
      },
    },
    ...(options.minify === 'terser' && {
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug'],
        },
        format: {
          comments: false,
        },
      },
    }),
  },
  plugins: [
    react({
      jsxRuntime: 'automatic',
      jsxImportSource: 'react',
    }),
    tailwindcss(),
    cssInjectedByJsPlugin(),
    // Only copy index.html and generate types for the main library build
    !isStandalone && copyIndexHtmlPlugin(options.outDir),
    !isStandalone && typescriptDeclarationPlugin(),
  ],
});

const setCorsHeaders = (res: ServerResponse): void => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');
};

const readFile = (path: string): string | null => (existsSync(path) ? readFileSync(path, 'utf-8') : null);

const copyIndexHtmlPlugin = (outDir: string) => {
  return {
    name: 'copy-index-html',
    closeBundle() {
      const indexPath = resolve(cwd(), 'index.html');
      const destDir = resolve(cwd(), outDir);
      const destPath = resolve(destDir, 'index.html');
      if (existsSync(indexPath)) {
        // Ensure destination directory exists
        if (!existsSync(destDir)) {
          mkdirSync(destDir, { recursive: true });
        }
        copyFileSync(indexPath, destPath);
        console.log(`✓ Copied index.html to ${outDir}/`);
      }
    },
  };
};

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

const devWidgetPlugin = () => {
  let bundle: string | null = null;
  let sourcemap: string | null = null;
  let buildPromise: Promise<void> | null = null;

  const doBuild = async (): Promise<void> => {
    try {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const config = getBuildConfig({ minify: false, outDir: OUT_DIR });
        await build({ ...config, mode: 'production' });
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
      const basePath = resolve(cwd(), OUT_DIR);
      bundle = readFile(resolve(basePath, BUNDLE_FILE));
      sourcemap = readFile(resolve(basePath, SOURCEMAP_FILE));
      if (bundle) console.log(`✓ Built ${BUNDLE_PATH} bundle`);
      if (sourcemap) console.log(`✓ Built ${SOURCEMAP_PATH} sourcemap`);
    } catch (error) {
      console.error(`Error building ${BUNDLE_PATH}:`, error);
      throw error;
    }
  };

  return {
    name: 'dev-widget',
    configureServer(s: ViteDevServer) {
      buildPromise = doBuild();

      s.watcher.add(resolve(cwd(), SRC_DIR, '**/*.{ts,tsx}'));
      s.watcher.on('change', async file => {
        if (file.includes(SRC_DIR)) {
          console.log(`[dev-widget] Rebuilding ${BUNDLE_PATH}...`);
          bundle = sourcemap = null;
          buildPromise = doBuild();
          await buildPromise;
        }
      });

      const endpoints = {
        [BUNDLE_PATH]: { contentType: 'application/javascript', getData: () => bundle },
        [SOURCEMAP_PATH]: { contentType: 'application/json', getData: () => sourcemap },
      };

      const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url;
        if (url !== BUNDLE_PATH && url !== SOURCEMAP_PATH) {
          next();
          return;
        }

        if (req.method === 'OPTIONS') {
          setCorsHeaders(res);
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', '*');
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method === 'GET') {
          if (buildPromise) {
            await buildPromise;
            buildPromise = null;
          }

          const config = endpoints[url];
          let data = config.getData();
          if (!data) {
            await doBuild();
            data = config.getData();
          }

          if (data) {
            setCorsHeaders(res);
            res.setHeader('Content-Type', config.contentType);
            res.end(data);
            return;
          }
        }

        next();
      };

      s.middlewares.stack.unshift({ route: '', handle: handler });
    },
  };
};

export default defineConfig(({ command }) => {
  const isProduction = command === 'build';

  if (isProduction) {
    return getBuildConfig({ minify: 'terser', outDir: 'dist' });
  }

  return {
    resolve: { alias: { '@': resolve(cwd(), 'src') } },
    plugins: [react(), tailwindcss(), !process.env.KUBERNETES_SERVICE_HOST && devWidgetPlugin()],
    root: '.',
    server: {
      port: parseInt(process.env.PORT || process.env.VITE_PORT || '5174', 10),
      cors: true,
      headers: { 'Access-Control-Allow-Origin': '*' },
    },
  };
});
