import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readFileSync } from 'fs'

// Custom plugin to inject CSS into the JS bundle
const injectCSSPlugin = () => {
  return {
    name: 'inject-css',
    generateBundle(options, bundle) {
      // Find the CSS file
      const cssFile = Object.keys(bundle).find(fileName => fileName.endsWith('.css'))
      
      if (cssFile && bundle[cssFile].type === 'asset') {
        const cssContent = bundle[cssFile].source
        
        // Find the main JS file
        const jsFile = Object.keys(bundle).find(fileName => fileName.endsWith('.js'))
        
        if (jsFile && bundle[jsFile].type === 'chunk') {
          // Inject CSS into the JS bundle
          const cssInjection = `
// Inject CSS styles
const style = document.createElement('style');
style.textContent = \`${cssContent}\`;
document.head.appendChild(style);
`
          
          bundle[jsFile].code = cssInjection + bundle[jsFile].code
          
          // Remove the separate CSS file
          delete bundle[cssFile]
        }
      }
    }
  }
}

export default defineConfig({
  plugins: [react(), injectCSSPlugin()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'MarketrixInApp',
      fileName: (format) => 'meet.js',
      formats: ['iife'] // IIFE format for direct script inclusion
    },
    rollupOptions: {
      external: [], // Bundle everything including React for standalone use
      output: {
        globals: {}
      }
    },
    outDir: 'dist',
    sourcemap: false, // No sourcemap for cleaner output
    minify: true,
    cssCodeSplit: false // Include CSS in the JS file
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  esbuild: {
    jsx: 'automatic'
  }
})
