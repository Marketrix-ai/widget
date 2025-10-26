import react from '@vitejs/plugin-react';
import { defineConfig, type ViteDevServer } from 'vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

// Dev plugin: serves /meet.js endpoint that loads the widget
const devMeetPlugin = () => {
  let server: ViteDevServer;

  return {
    name: 'dev-meet',
    configureServer(s: ViteDevServer) {
      server = s;
    },
    resolveId(id: string) {
      return ['/meet.js', './meet.js'].includes(id) ? id : null;
    },
    async load(id: string) {
      if (!['/meet.js', './meet.js'].includes(id)) return null;
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
    },
  };
};

export default defineConfig({
  plugins: [react(), devMeetPlugin(), cssInjectedByJsPlugin()],
  root: '.',
  publicDir: false,
  build: {
    outDir: 'dist',
    cssCodeSplit: false,
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
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(
      process.env.VITE_API_URL ?? 'http://localhost:8080'
    ),
  },
});
