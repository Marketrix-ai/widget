import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import { readFileSync, unlinkSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import type { NormalizedOutputOptions, OutputAsset, OutputBundle } from 'rollup';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Custom plugin to inject CSS into the JS bundle
const injectCSSPlugin = () => {
  return {
    name: 'inject-css',
    writeBundle(options: NormalizedOutputOptions, bundle: OutputBundle) {
      // Find the CSS file
      const cssFile = Object.keys(bundle).find((fileName) => fileName.endsWith('.css'));

      if (cssFile && bundle[cssFile]?.type === 'asset') {
        const cssContent = (bundle[cssFile] as OutputAsset).source as string;

        // Find the main JS file
        const jsFile = Object.keys(bundle).find((fileName) => fileName.endsWith('.js'));

        if (jsFile && bundle[jsFile]?.type === 'chunk') {
          // Read the JS file from disk
          const jsFilePath = resolve(options.dir || 'dist', jsFile);
          const jsContent = readFileSync(jsFilePath, 'utf8');

          // Escape CSS content for JavaScript string
          const escapedCSS = cssContent
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$/g, '\\$')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');

          // Inject CSS into the JS bundle at the very beginning
          const cssInjection = `// Inject CSS styles
const style = document.createElement('style');
style.textContent = \`${escapedCSS}\`;
document.head.appendChild(style);
`;

          // Write the combined content back to the JS file
          const newJsContent = cssInjection + jsContent;
          writeFileSync(jsFilePath, newJsContent, 'utf8');

          // Remove the separate CSS file
          const cssFilePath = resolve(options.dir || 'dist', cssFile);
          unlinkSync(cssFilePath);
        }
      }
    },
  };
};

// Custom plugin to copy and transform HTML for preview
const copyHTMLPlugin = () => {
  return {
    name: 'copy-html',
    writeBundle(options: NormalizedOutputOptions) {
      const sourceHTML = resolve(__dirname, 'index.html');
      const destHTML = resolve(options.dir || 'dist', 'index.html');

      try {
        // Read the source HTML
        let htmlContent = readFileSync(sourceHTML, 'utf8');

        // Transform the script tag from module import to IIFE script
        htmlContent = htmlContent.replace(
          /<script type="module">[\s\S]*?<\/script>/,
          '<script src="./meet.js"></script>'
        );

        // Write the transformed HTML to dist
        writeFileSync(destHTML, htmlContent, 'utf8');
        console.log('✅ HTML copied and transformed for preview');
      } catch (error) {
        console.error('❌ Failed to copy HTML:', error);
      }
    },
  };
};

export default defineConfig({
  plugins: [react(), injectCSSPlugin(), copyHTMLPlugin()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'MarketrixInApp',
      fileName: (_format) => 'meet.js',
      formats: ['iife'], // IIFE format for direct script inclusion
    },
    rollupOptions: {
      external: [], // Bundle everything including React for standalone use
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'temp.css'; // Temporary name for CSS file
          }
          return assetInfo.name || 'asset';
        },
      },
    },
    outDir: 'dist',
    sourcemap: false, // No sourcemap for cleaner output
    minify: 'terser', // Switch from esbuild to terser for better compression
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log statements
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false, // Remove all comments
      },
    },
    cssCodeSplit: false, // Include CSS in the JS file
    cssMinify: true, // Enable CSS minification
  },
  css: {
    postcss: {
      plugins: [
        autoprefixer,
        cssnano({
          preset: [
            'default',
            {
              discardComments: {
                removeAll: true,
              },
              normalizeWhitespace: true,
              colormin: true,
              minifySelectors: true,
              minifyParams: true,
              minifyGradients: true,
              convertValues: true,
              discardDuplicates: true,
              discardEmpty: true,
              mergeLonghand: true,
              mergeRules: true,
              normalizeUrl: true,
              orderedValues: true,
              reduceIdents: true,
              reduceInitial: true,
              reduceTransforms: true,
              svgo: true,
              uniqueSelectors: true,
              zindex: false,
            },
          ],
        }),
      ],
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'import.meta.env.VITE_API_URL': JSON.stringify(
      process.env.VITE_API_URL || 'http://localhost:8080'
    ),
  },
});
