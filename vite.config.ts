import { execSync } from 'node:child_process';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import type { IncomingMessage, ServerResponse } from 'http';
import { resolve } from 'path';
import { defineConfig, type ViteDevServer } from 'vite';

// Dev plugin: serves /meet.js and /debug.js endpoints
const devMeetPlugin = () => {
  return {
    name: 'dev-meet',
    configureServer(s: ViteDevServer) {
      // Add middleware at the VERY BEGINNING using stack manipulation
      const htmlHandler = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
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
      s.middlewares.stack.unshift({ route: '', handle: htmlHandler });
    },
    resolveId(id: string) {
      if (['/meet.js', './meet.js'].includes(id)) return id;
      if (['/debug.js', './debug.js'].includes(id)) return id;
      return null;
    },
    async load(id: string) {
      if (['/meet.js', './meet.js'].includes(id)) {
        // IMPORTANT:
        // Do NOT return `server.transformRequest()` output here.
        // Vite will run its own transform pipeline on this virtual module, and returning
        // already-transformed code can cause duplicated HMR preambles like:
        //   "Identifier '__vite__createHotContext' has already been declared"
        // Instead, return a small module that re-exports the real entry.
        return `export * from '/src/index.tsx';\nexport { default } from '/src/index.tsx';\n`;
      }
      if (['/debug.js', './debug.js'].includes(id)) {
        // Same reasoning as /meet.js: avoid returning already-transformed code
        return `export * from '/src/debug.tsx';\nexport { default } from '/src/debug.tsx';\n`;
      }
      return null;
    },
  };
};

// Plugin to copy index.html and create meet.js (script tag bundle) after build
const copyFilesPlugin = () => {
  return {
    name: 'copy-files',
    writeBundle() {
      // Copy index.html
      const srcPath = resolve(process.cwd(), 'index.html');
      const destPath = resolve(process.cwd(), 'dist', 'index.html');
      try {
        if (existsSync(srcPath)) {
          copyFileSync(srcPath, destPath);
          console.log('✓ Copied index.html to dist/');
        }
      } catch (error) {
        console.error('Error copying index.html:', error);
      }

      // Create meet.js as a copy of index.js for script tag mode (legacy support)
      const indexJsPath = resolve(process.cwd(), 'dist', 'index.js');
      const meetJsPath = resolve(process.cwd(), 'dist', 'meet.js');
      try {
        if (existsSync(indexJsPath)) {
          copyFileSync(indexJsPath, meetJsPath);
          console.log('✓ Created meet.js for script tag mode');
        }
      } catch (error) {
        console.error('Error creating meet.js:', error);
      }
    },
  };
};

// Plugin to build debug panel and generate types after main build
const buildCompletePlugin = () => {
  return {
    name: 'build-complete',
    async closeBundle() {
      // Build debug panel
      try {
        console.log('Building debug panel...');
        execSync('vite build --config vite.config.debug.ts', { stdio: 'inherit' });
      } catch (error) {
        console.error('Error building debug panel:', error);
        throw error;
      }

      // Generate types
      try {
        console.log('Generating types...');
        execSync('tsc -p tsconfig.build.json', { stdio: 'inherit' });
      } catch (error) {
        console.error('Error generating types:', error);
        throw error;
      }

      // Fix types (remove CSS import)
      try {
        const typePath = resolve(process.cwd(), 'dist', 'index.d.ts');
        if (existsSync(typePath)) {
          let content = readFileSync(typePath, 'utf8');
          content = content.replace(/^import\s+['"]\.\/index\.css['"];?\n?/gm, '');
          writeFileSync(typePath, content);
          console.log('✓ Fixed type definitions');
        }
      } catch (error) {
        console.error('Error fixing types:', error);
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
    // cssInjectedByJsPlugin() removed - CSS is injected into Shadow DOM via bootstrap.tsx
    copyFilesPlugin(),
    buildCompletePlugin(),
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
    sourcemap: true, // Generate sourcemaps for debugging
    lib: {
      entry: 'src/index.tsx',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      // Suppress Tailwind sourcemap warning - the plugin doesn't generate sourcemaps for CSS transforms
      // but this is safe to ignore as sourcemaps are still useful for JS debugging
      onwarn(warning, warn) {
        // Suppress the Tailwind CSS sourcemap warning
        if (
          warning.plugin === '@tailwindcss/vite:generate:build' &&
          warning.message.includes('Sourcemap')
        ) {
          return;
        }
        // Use default warning handler for other warnings
        warn(warning);
      },
      external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
      output: {
        entryFileNames: 'index.mjs',
        // chunkFileNames: 'chunks/[name]-[hash].js', // Removed for inline
        assetFileNames: 'assets/[name].[ext]',
        format: 'es',
        inlineDynamicImports: true, // Force single file
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
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
