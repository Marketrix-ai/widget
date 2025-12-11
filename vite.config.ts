import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { defineConfig, type ViteDevServer } from 'vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

// Dev plugin: serves /meet.js and /debug.js endpoints
const devMeetPlugin = () => {
  let server: ViteDevServer;

  return {
    name: 'dev-meet',
    configureServer(s: ViteDevServer) {
      server = s;
      // Add middleware at the VERY BEGINNING using stack manipulation
      const htmlHandler = (
        req: import('http').IncomingMessage,
        res: import('http').ServerResponse,
        next: () => void
      ) => {
        if (req.url === '/test.html' || req.url === '/test') {
          const testHtmlPath = resolve(process.cwd(), 'test.html');
          if (existsSync(testHtmlPath)) {
            res.setHeader('Content-Type', 'text/html');
            res.end(readFileSync(testHtmlPath, 'utf-8'));
            return;
          }
        }
        if (req.url === '/widget.html' || req.url === '/widget') {
          const widgetHtmlPath = resolve(process.cwd(), 'widget.html');
          if (existsSync(widgetHtmlPath)) {
            res.setHeader('Content-Type', 'text/html');
            res.end(readFileSync(widgetHtmlPath, 'utf-8'));
            return;
          }
        }
        next();
      };
      // @ts-expect-error - accessing internal stack
      s.middlewares.stack.unshift({ route: '', handle: htmlHandler });
    },
    resolveId(id: string) {
      if (['/meet.js', './meet.js'].includes(id)) return id;
      if (['/debug.js', './debug.js'].includes(id)) return id;
      return null;
    },
    async load(id: string) {
      if (['/meet.js', './meet.js'].includes(id)) {
        try {
          if (server) {
            const result = await server.transformRequest('/src/index.tsx');
            return result?.code ?? null;
          }
          return `export * from '/src/index.tsx';`;
        } catch (error) {
          console.error('Error transforming meet.js:', error);
          return null;
        }
      }
      if (['/debug.js', './debug.js'].includes(id)) {
        try {
          if (server) {
            const result = await server.transformRequest('/src/debug.tsx');
            return result?.code ?? null;
          }
          return `export * from '/src/debug.tsx';`;
        } catch (error) {
          console.error('Error transforming debug.js:', error);
          return null;
        }
      }
      return null;
    },
  };
};

// Plugin to copy index.html to dist after build
const copyIndexHtmlPlugin = () => {
  return {
    name: 'copy-index-html',
    writeBundle() {
      const srcPath = resolve(process.cwd(), 'index.html');
      const destPath = resolve(process.cwd(), 'dist', 'index.html');
      try {
        copyFileSync(srcPath, destPath);
        console.log('✓ Copied index.html to dist/');
      } catch (error) {
        console.error('Error copying index.html:', error);
      }
    },
  };
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // basicSsl(), // Disabled - using HTTP for local development
    devMeetPlugin(),
    cssInjectedByJsPlugin(),
    copyIndexHtmlPlugin(),
  ],
  root: '.',
  publicDir: 'public',
  server: {
    // https: true, // Disabled - using HTTP for local development
    port: 5174,
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  },
  build: {
    outDir: 'dist',
    cssCodeSplit: false,
    chunkSizeWarningLimit: 600, // Widget is intentionally a single bundle
    assetsInlineLimit: 100000000, // Inline all assets as base64
    rollupOptions: {
      input: 'src/index.tsx',
      output: {
        entryFileNames: 'meet.js',
        chunkFileNames: 'meet.js',
        assetFileNames: 'meet.[ext]', // Simple naming, won't be used as assets are inlined
        format: 'es',
        inlineDynamicImports: true,
        manualChunks: undefined,
      },
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
      mangle: {
        toplevel: true,
      },
      format: {
        comments: false,
      },
    },
  },
});
