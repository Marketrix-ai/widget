/**
 * Vite Configuration for Debug Panel Build
 *
 * Builds a separate debug.js file that can be loaded alongside the widget.
 * Does not minify or drop console logs for easier debugging.
 *
 * Usage:
 *   npm run build:debug
 *
 * Output:
 *   dist/debug.js
 */

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: '.',
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false, // Don't clear dist folder (keep meet.js)
    cssCodeSplit: false,
    chunkSizeWarningLimit: 600,
    assetsInlineLimit: 100000000,
    rollupOptions: {
      input: 'src/debug.tsx',
      output: {
        entryFileNames: 'debug.js',
        chunkFileNames: 'debug-[name].js',
        assetFileNames: 'debug.[ext]',
        format: 'iife',
        inlineDynamicImports: true,
        manualChunks: undefined,
      },
    },
    // Don't minify for debug build - easier to debug
    minify: false,
    sourcemap: true,
  },
});
