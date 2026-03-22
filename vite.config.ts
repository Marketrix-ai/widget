import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type UserConfig, type ViteDevServer } from 'vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

const BUNDLE_FILE = 'widget.mjs';
const ENTRY_FILE = 'src/index.tsx';

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
    emptyOutDir: true,
    sourcemap: true,
    minify: options.minify,
    target: 'esnext',
    codeSplitting: false,
    cssCodeSplit: false,
    lib: {
      entry: ENTRY_FILE,
      formats: ['es'],
      fileName: 'widget',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
      output: {
        entryFileNames: BUNDLE_FILE,
        format: 'es',
        globals: {
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
    copyIndexHtmlPlugin(options.outDir),
    typescriptDeclarationPlugin(),
  ],
});

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

export default defineConfig(({ command }) => {
  const isProduction = command === 'build';

  if (isProduction) {
    return getBuildConfig({ minify: 'terser', outDir: 'dist' });
  }

  return {
    resolve: { alias: { '@': resolve(cwd(), 'src') } },
    plugins: [
      react(),
      tailwindcss(),
      // Rewrite /widget.mjs and /standalone.mjs to the source entry so the production URL works in dev
      {
        name: 'widget-dev-routing',
        configureServer(server: ViteDevServer) {
          server.middlewares.use((req, _res, next) => {
            if (req.url === '/widget.mjs' || req.url === '/standalone.mjs') req.url = '/src/index.tsx';
            next();
          });
        },
      },
    ],
    appType: 'mpa',
    root: '.',
    server: {
      port: parseInt(process.env.PORT || process.env.VITE_PORT || '5174', 10),
      cors: true,
      headers: { 'Access-Control-Allow-Origin': '*' },
    },
  };
});
