import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'MarketrixInApp',
      fileName: 'marketrix-inapp-standalone',
      formats: ['umd']
    },
    rollupOptions: {
      // Don't externalize React - bundle everything together
      external: [],
      output: {
        globals: {}
      }
    },
    outDir: 'dist',
    sourcemap: false,
    minify: true
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  esbuild: {
    jsx: 'automatic'
  }
})
