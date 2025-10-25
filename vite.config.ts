import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readFileSync, writeFileSync, unlinkSync } from 'fs'

// Custom plugin to inject CSS into the JS bundle
const injectCSSPlugin = () => {
  return {
    name: 'inject-css',
    writeBundle(options, bundle) {
      // Find the CSS file
      const cssFile = Object.keys(bundle).find(fileName => fileName.endsWith('.css'))
      
      if (cssFile && bundle[cssFile].type === 'asset') {
        const cssContent = bundle[cssFile].source
        
        // Find the main JS file
        const jsFile = Object.keys(bundle).find(fileName => fileName.endsWith('.js'))
        
        if (jsFile && bundle[jsFile].type === 'chunk') {
          // Read the JS file from disk
          const jsFilePath = resolve(options.dir, jsFile)
          const jsContent = readFileSync(jsFilePath, 'utf8')
          
          // Escape CSS content for JavaScript string
          const escapedCSS = cssContent
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$/g, '\\$')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
          
          // Inject CSS into the JS bundle at the very beginning
          const cssInjection = `// Inject CSS styles
const style = document.createElement('style');
style.textContent = \`${escapedCSS}\`;
document.head.appendChild(style);
`
          
          // Write the combined content back to the JS file
          const newJsContent = cssInjection + jsContent
          writeFileSync(jsFilePath, newJsContent, 'utf8')
          
          // Remove the separate CSS file
          const cssFilePath = resolve(options.dir, cssFile)
          unlinkSync(cssFilePath)
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
        globals: {},
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'temp.css' // Temporary name for CSS file
          }
          return assetInfo.name
        }
      }
    },
    outDir: 'dist',
    sourcemap: false, // No sourcemap for cleaner output
    minify: true,
    cssCodeSplit: false, // Include CSS in the JS file
    assetsInlineLimit: 0 // Don't inline assets
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  esbuild: {
    jsx: 'automatic'
  }
})
