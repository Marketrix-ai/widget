#!/usr/bin/env node

/**
 * Minimal Production Build Script for Marketrix Widget
 * 
 * This script builds only the essential files:
 * - meet.js: Standalone widget bundle with all dependencies
 * - index.html: Demo page that imports meet.js via script tag
 * 
 * Usage: npm run build
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting minimal Marketrix Widget build...');

try {
  // Step 1: Clean and prepare dist directory
  console.log('📁 Preparing dist directory...');
  if (fs.existsSync('dist')) {
    try {
      fs.rmSync('dist', { recursive: true, force: true });
      console.log('  ✅ Cleaned existing dist directory');
    } catch (error) {
      console.log('  ⚠️  Could not clean dist directory (may be in use), continuing...');
    }
  }
  
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }

  // Step 2: Build the widget
  console.log('🔨 Building widget...');
  execSync('vite build', { stdio: 'inherit' });
  console.log('  ✅ Widget built successfully');

  // Step 2.5: Inject CSS into meet.js and remove separate CSS file
  console.log('🎨 Injecting CSS into meet.js...');
  const cssPath = path.join('dist', 'style.css');
  const jsPath = path.join('dist', 'meet.js');
  
  if (fs.existsSync(cssPath) && fs.existsSync(jsPath)) {
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    
    // Inject CSS at the beginning of the JS file
    const cssInjection = `
// Inject CSS styles
const style = document.createElement('style');
style.textContent = \`${cssContent}\`;
document.head.appendChild(style);
`;
    
    const newJsContent = cssInjection + jsContent;
    fs.writeFileSync(jsPath, newJsContent);
    
    // Remove the separate CSS file
    fs.unlinkSync(cssPath);
    console.log('  ✅ CSS injected into meet.js and separate CSS file removed');
  } else {
    console.log('  ⚠️  CSS file not found, skipping injection');
  }

  // Step 3: Create minimal demo page
  console.log('📄 Creating demo page...');
  const demoHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Marketrix Widget Demo</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
    }
    .demo-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
    }
    h1 { color: #333; text-align: center; margin-bottom: 30px; }
    .demo-content { line-height: 1.6; color: #666; }
    .highlight {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 4px;
      padding: 15px;
      margin: 20px 0;
    }
    .code-block {
      background: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 4px;
      padding: 15px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 14px;
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <div class="demo-container">
    <h1>🚀 Marketrix Widget Demo</h1>
    
    <div class="demo-content">
      <p>This page demonstrates the Marketrix In-App Support Widget. The widget should appear in the bottom-right corner.</p>
      
      <div class="highlight">
        <strong>Integration:</strong> To add this widget to your website, use the following script tag:
      </div>
      
      <div class="code-block">
&lt;script src="./meet.js" 
        marketrix-id="your-marketrix-id" 
        marketrix-key="your-marketrix-key"&gt;&lt;/script&gt;
      </div>
      
      <p>Replace <code>your-marketrix-id</code> and <code>your-marketrix-key</code> with your actual Marketrix credentials.</p>
      
      <div class="highlight">
        <strong>Features:</strong> The widget provides AI-powered support with Show, Tell, and Do interaction modes.
      </div>
    </div>
  </div>

  <!-- Load the widget -->
  <script src="./meet.js" 
          marketrix-id="demo-marketrix-id" 
          marketrix-key="demo-marketrix-key">
  </script>
</body>
</html>`;
  
  fs.writeFileSync(path.join('dist', 'index.html'), demoHtml);
  console.log('  ✅ Created demo page');

  // Step 4: List final files
  console.log('\\n📋 Final dist directory contents:');
  const distFiles = fs.readdirSync('dist', { recursive: true });
  distFiles.forEach(file => {
    const filePath = typeof file === 'string' ? file : file.join('/');
    console.log(`  - ${filePath}`);
  });

  console.log('\\n🎉 Build completed successfully!');
  console.log('\\n📁 Files ready in dist/ directory');
  console.log('\\n🚀 Next steps:');
  console.log('  - Open dist/index.html to see the demo');
  console.log('  - Deploy dist/meet.js to S3/CDN');
  console.log('  - Use meet.js in your projects with script tags');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}