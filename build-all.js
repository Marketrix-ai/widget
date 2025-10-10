#!/usr/bin/env node

/**
 * Complete Build Script for Marketrix Widget
 * 
 * This script builds the widget and copies ALL necessary files
 * to create a complete dist directory ready for deployment.
 * 
 * Run with: npm run build
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting complete Marketrix Widget build...');

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

  // Step 2: Build the standalone widget (includes React)
  console.log('🔨 Building standalone widget...');
  execSync('vite build --config vite.standalone.config.ts', { stdio: 'inherit' });
  console.log('  ✅ Standalone widget built');

  // Step 3: Copy all source files and resources
  console.log('📋 Copying all source files and resources...');
  
  // Create directory structure
  const dirs = [
    'dist/src',
    'dist/src/config',
    'dist/src/components',
    'dist/src/services',
    'dist/src/utils',
    'dist/src/hooks',
    'dist/src/types'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Copy config files
  const configFiles = [
    'src/config/widget-atmosphere.json'
  ];
  
  configFiles.forEach(file => {
    if (fs.existsSync(file)) {
      const dest = file.replace('src/', 'dist/src/');
      fs.copyFileSync(file, dest);
      console.log(`  ✅ Copied ${file}`);
    }
  });

  // Copy TypeScript files (for reference/documentation)
  const tsFiles = [
    'src/components',
    'src/services', 
    'src/utils',
    'src/hooks',
    'src/types'
  ];
  
  function copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const files = fs.readdirSync(src);
    files.forEach(file => {
      const srcPath = path.join(src, file);
      const destPath = path.join(dest, file);
      
      if (fs.statSync(srcPath).isDirectory()) {
        copyDirectory(srcPath, destPath);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.json')) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`  ✅ Copied ${srcPath}`);
      }
    });
  }
  
  tsFiles.forEach(dir => {
    if (fs.existsSync(dir)) {
      const destDir = dir.replace('src/', 'dist/src/');
      copyDirectory(dir, destDir);
    }
  });

  // Step 4: Create index.html (main demo page)
  console.log('📄 Creating index.html...');
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Marketrix In-App Support Widget Demo</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="./style.css">
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
    }
    
    .demo-container {
      max-width: 1024px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
    }
    
    h1 {
      color: #333;
      text-align: center;
      margin-bottom: 30px;
    }
    
    .demo-content {
      line-height: 1.6;
      color: #666;
    }
    
    .demo-section {
      margin: 30px 0;
      padding: 20px;
      border-radius: 8px;
      background: #f8f9fa;
      transition: all 0.3s ease;
    }

    .demo-section:hover {
      background: #e3f2fd;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .demo-button {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      background: #f1f3f4;
      color: #333;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.3s ease;
      margin: 5px;
    }

    .demo-button:hover {
      background: #e8f0fe;
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    .demo-button.primary {
      background: #1976d2;
      color: white;
    }

    .demo-button.success {
      background: #2e7d32;
      color: white;
    }

    .highlight {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 4px;
      padding: 10px;
      margin: 15px 0;
    }

    .demo-highlight {
      position: relative;
      border: 2px solid #4CAF50 !important;
      box-shadow: 0 0 15px rgba(76, 175, 80, 0.3) !important;
      z-index: 10;
      transition: all 0.3s ease;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-top: 15px;
    }

    .metric-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      text-align: center;
      transition: all 0.3s ease;
      cursor: pointer;
      border: 2px solid transparent;
    }

    .metric-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
      border-color: #4CAF50;
    }

    .metric-icon {
      font-size: 24px;
      margin-bottom: 10px;
    }

    .metric-value {
      font-size: 28px;
      font-weight: bold;
      color: #333;
      margin-bottom: 5px;
    }

    .metric-label {
      color: #666;
      font-size: 14px;
      margin-bottom: 8px;
    }

    .metric-change {
      font-size: 12px;
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 12px;
      display: inline-block;
    }

    .metric-change.positive {
      background: #e8f5e8;
      color: #2e7d32;
    }

    .metric-change.negative {
      background: #ffebee;
      color: #c62828;
    }

    /* Login Form Styles */
    .login-form-container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      margin-top: 20px;
      border: 1px solid #e5e7eb;
      overflow: hidden;
    }

    .login-form-header {
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      color: white;
      padding: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .login-form-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    .close-form-btn {
      background: none;
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: background-color 0.2s;
    }

    .close-form-btn:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .login-form {
      padding: 20px;
    }

    .form-section {
      margin-bottom: 30px;
    }

    .form-section h4 {
      color: #374151;
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e7eb;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      margin-bottom: 20px;
    }

    .form-group label {
      font-weight: 500;
      color: #374151;
      margin-bottom: 6px;
      font-size: 14px;
    }

    .form-group input {
      padding: 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .form-group input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .form-options {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 16px;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      cursor: pointer;
      font-size: 14px;
      color: #374151;
    }

    .checkbox-label input[type="checkbox"] {
      margin-right: 8px;
    }

    .forgot-password {
      color: #3b82f6;
      text-decoration: none;
      font-size: 14px;
    }

    .forgot-password:hover {
      text-decoration: underline;
    }

    .form-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }

    .btn-secondary {
      padding: 12px 24px;
      background: white;
      color: #374151;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-secondary:hover {
      background: #f9fafb;
      border-color: #9ca3af;
    }

    .btn-primary {
      padding: 12px 24px;
      background: #3b82f6;
      color: white;
      border: 1px solid #3b82f6;
      border-radius: 6px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-primary:hover {
      background: #2563eb;
      border-color: #2563eb;
    }

    .input-hint {
      font-size: 12px;
      color: #6b7280;
      margin-top: 4px;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="demo-container">
    <h1>🚀 Marketrix Integration Demo</h1>
    
    <div class="demo-content">
      <p>
        Hover over any element to see it highlighted, 
        and the Marketrix AI assistant will provide contextual help about that feature.
      </p>
      
      <div class="highlight">
        <strong>Interactive Demo:</strong> Try hovering over different elements below - the AI assistant will 
        ask relevant questions about the highlighted areas and provide helpful guidance!
      </div>
      
      <!-- Navigation Bar -->
      <div class="demo-section" data-demo-area="navigation">
        <h2>📊 Dashboard Navigation</h2>
        <div>
          <button class="demo-button primary" data-demo-element="dashboard" data-demo-description="Main dashboard overview with key metrics and performance indicators">
            🏠 Dashboard
          </button>
          <button class="demo-button" data-demo-element="products" data-demo-description="Product catalog management - add, edit, and organize your inventory">
            📦 Products
          </button>
          <button class="demo-button" data-demo-element="settings" data-demo-description="System configuration and account settings management">
            ⚙️ Settings
          </button>
          <button class="demo-button" data-demo-element="login-button" data-demo-description="User authentication and account access">
            🔐 Login
          </button>
        </div>
      </div>

      <!-- Key Metrics Cards -->
      <div class="demo-section" data-demo-area="metrics">
        <h2>📈 Key Performance Metrics</h2>
        <div class="metrics-grid">
          <div class="metric-card" data-demo-element="revenue" data-demo-description="Total revenue generated this month with growth percentage">
            <div class="metric-icon">💰</div>
            <div class="metric-value">$24,563</div>
            <div class="metric-label">Monthly Revenue</div>
            <div class="metric-change positive">+12.5%</div>
          </div>
          <div class="metric-card" data-demo-element="orders-count" data-demo-description="Number of orders processed and their status breakdown">
            <div class="metric-icon">📋</div>
            <div class="metric-value">342</div>
            <div class="metric-label">Total Orders</div>
            <div class="metric-change positive">+8.3%</div>
          </div>
          <div class="metric-card" data-demo-element="customers-count" data-demo-description="Active customer base and new registrations this period">
            <div class="metric-icon">👤</div>
            <div class="metric-value">1,247</div>
            <div class="metric-label">Active Customers</div>
            <div class="metric-change positive">+15.2%</div>
          </div>
          <div class="metric-card" data-demo-element="conversion" data-demo-description="Conversion rate from visitors to paying customers">
            <div class="metric-icon">🎯</div>
            <div class="metric-value">3.8%</div>
            <div class="metric-label">Conversion Rate</div>
            <div class="metric-change negative">-2.1%</div>
          </div>
        </div>
      </div>

      <!-- Product Management -->
      <div class="demo-section" data-demo-area="product-management">
        <h2>📦 Product Management</h2>
        <div>
          <button class="demo-button success" data-demo-element="add-product" data-demo-description="Add new products to your inventory with details, pricing, and images">
            ➕ Add New Product
          </button>
          <button class="demo-button" data-demo-element="bulk-import" data-demo-description="Import multiple products at once using CSV or Excel files">
            📤 Bulk Import
          </button>
          <button class="demo-button" data-demo-element="categories" data-demo-description="Organize products into categories and subcategories for better navigation">
            🏷️ Manage Categories
          </button>
          <button class="demo-button" data-demo-element="inventory" data-demo-description="Monitor stock levels and set up low inventory alerts">
            📊 Inventory Status
          </button>
        </div>
      </div>

      <!-- Login Form (Hidden by default) -->
      <div id="login-form-simulation" class="login-form-container" style="display: none;" data-demo-element="login-form">
        <div class="login-form-header">
          <h3>🔐 User Login</h3>
          <button class="close-form-btn" onclick="document.getElementById('login-form-simulation').style.display='none'">×</button>
        </div>
        <form class="login-form">
          <div class="form-section">
            <h4>Account Credentials</h4>
            <div class="form-group">
              <label for="login-email">Username/Email *</label>
              <input type="email" id="login-email" data-demo-element="login-email" placeholder="Enter your username or email (e.g., john.doe@example.com)" required>
              <div class="input-hint">Enter your registered email address or username</div>
            </div>
            <div class="form-group">
              <label for="login-password">Password *</label>
              <input type="password" id="login-password" data-demo-element="login-password" placeholder="Enter your password" required>
              <div class="input-hint">Password should be at least 8 characters long</div>
            </div>
            <div class="form-options">
              <label class="checkbox-label">
                <input type="checkbox" id="remember-me">
                <span class="checkmark"></span>
                Remember me
              </label>
              <a href="#" class="forgot-password">Forgot password?</a>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" onclick="document.getElementById('login-form-simulation').style.display='none'">Cancel</button>
            <button type="submit" class="btn-primary" data-demo-element="login-submit">Sign In</button>
          </div>
        </form>
      </div>
      
      <div class="highlight">
        <strong>Try It Out:</strong> Hover over any button, card, or section above to see the Marketrix AI 
        assistant provide contextual help and ask relevant questions about that feature!
      </div>
    </div>
  </div>

  <!-- Include the built widget JavaScript -->
  <script src="./marketrix-inapp-standalone.umd.cjs"></script>
  
  <!-- Widget Script (Demo Mode) -->
  <script>
    // Demo interaction system
    let currentHighlighted = null;
    let highlightTimeout = null;
    let widgetInstance = null;

    // Context-aware messages for different elements
    const contextMessages = {
      'dashboard': {
        question: "I see you're looking at the Dashboard button! Would you like me to show you how to navigate to the main dashboard or explain what key metrics you'll find there?",
        responses: {
          'show': "Let me highlight the key areas of the dashboard for you! The main dashboard shows your most important business metrics at a glance.",
          'tell': "The dashboard is your command center! It displays real-time metrics like revenue, orders, customer count, and conversion rates. You can customize which widgets appear based on your business priorities.",
          'do': "I can help you customize your dashboard layout. Would you like me to add specific widgets or rearrange the current ones to better suit your workflow?"
        }
      },
      'products': {
        question: "Interested in product management? I can show you how to add new products, manage inventory, or explain the product catalog features!",
        responses: {
          'show': "Here's how product management works - I'll walk you through adding a new product step by step!",
          'tell': "The Products section lets you manage your entire inventory. You can add new items, set pricing, manage stock levels, organize into categories, and track performance metrics for each product.",
          'do': "I can help you add a new product right now! Just tell me the product details and I'll guide you through the process."
        }
      },
      'revenue': {
        question: "I notice you're checking the revenue metrics! Would you like me to explain what drives this number or show you how to improve revenue growth?",
        responses: {
          'show': "Let me break down your revenue sources and show you which products and channels are performing best!",
          'tell': "Your monthly revenue of $24,563 represents a healthy 12.5% growth! This includes sales from all channels minus returns and refunds. The growth indicates strong business momentum.",
          'do': "I can help you identify opportunities to increase revenue. Would you like me to analyze your top-performing products or suggest pricing optimizations?"
        }
      },
      'add-product': {
        question: "Ready to add a new product? I can walk you through the entire process step-by-step or explain what information you'll need!",
        responses: {
          'show': "Let me guide you through adding a new product - from basic details to pricing and inventory setup!",
          'tell': "Adding a product requires: product name, description, category, pricing, inventory count, images, and SEO details. You can also set up variants for different sizes/colors and configure shipping options.",
          'do': "I'll help you add a new product right now! What type of product are you adding? I'll collect all the necessary information and create the listing for you."
        }
      }
    };

    // Initialize highlighting system
    function initDemoHighlighting() {
      const demoElements = document.querySelectorAll('[data-demo-element]');
      
      demoElements.forEach(element => {
        element.addEventListener('mouseenter', (e) => {
          if (highlightTimeout) {
            clearTimeout(highlightTimeout);
          }
          
          // Remove previous highlight
          if (currentHighlighted) {
            currentHighlighted.classList.remove('demo-highlight');
          }
          
          // Add highlight to current element
          currentHighlighted = e.target;
          e.target.classList.add('demo-highlight');
          
          // Get context message
          const elementType = e.target.getAttribute('data-demo-element');
          const contextMessage = contextMessages[elementType];
          
          if (contextMessage && widgetInstance) {
            // Set demo context for the widget
            setWidgetDemoContext(elementType);
            
            // Trigger widget with contextual message
            highlightTimeout = setTimeout(() => {
              triggerWidgetMessage(contextMessage.question);
            }, 800);
          }
        });
        
        element.addEventListener('mouseleave', (e) => {
          if (highlightTimeout) {
            clearTimeout(highlightTimeout);
          }
          
          // Remove highlight after a short delay
          setTimeout(() => {
            if (currentHighlighted === e.target) {
              e.target.classList.remove('demo-highlight');
              currentHighlighted = null;
            }
          }, 300);
        });
      });
    }

    // Function to trigger widget messages
    function triggerWidgetMessage(message) {
      console.log('Widget would ask:', message);
      
      // Show a notification that the AI is ready to help
      showDemoNotification(message);
    }

    // Function to show demo notification
    function showDemoNotification(message) {
      // Create a simple notification
      const notification = document.createElement('div');
      notification.style.cssText = \`
        position: fixed;
        top: 20px;
        right: 20px;
        background: #1976d2;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        max-width: 300px;
        font-size: 14px;
      \`;
      notification.innerHTML = \`
        <div style="font-weight: 600; margin-bottom: 5px;">🤖 AI Assistant Ready!</div>
        <div>\${message}</div>
      \`;
      
      document.body.appendChild(notification);
      
      // Auto-remove after 3 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 3000);
    }

    // Function to set demo context when elements are highlighted
    function setWidgetDemoContext(elementType) {
      console.log('Setting demo context:', elementType);
      window.currentDemoContext = elementType;
    }

    // Initialize the widget with enhanced demo functionality
    function initializeWidget() {
      if (typeof MarketrixInApp !== 'undefined') {
        // The standalone build exports the widget as an object with methods
        const widgetAPI = MarketrixInApp.default || MarketrixInApp;
        widgetInstance = widgetAPI.initMarketrixWidget({
          marketrixId: 'demo-marketrix-id',
          marketrixKey: 'demo-marketrix-key',
          position: 'bottom-right',
          theme: 'light',
          enabledModes: ['show', 'tell', 'do']
        });
        console.log('Widget initialized:', widgetInstance);
      } else {
        console.log('Widget not loaded yet, retrying...');
        setTimeout(initializeWidget, 100);
      }
    }
    
    // Initialize widget after DOM is loaded
    document.addEventListener('DOMContentLoaded', initializeWidget);

    // Initialize demo highlighting after DOM is loaded
    document.addEventListener('DOMContentLoaded', initDemoHighlighting);
    
    // If DOM is already loaded, initialize immediately
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initDemoHighlighting);
    } else {
      initDemoHighlighting();
    }

    // Add some demo introduction messages
    setTimeout(() => {
      console.log('Demo ready! Try hovering over different elements to see contextual AI assistance.');
    }, 2000);
  </script>
</body>
</html>`;
  
  fs.writeFileSync(path.join('dist', 'index.html'), indexHtml);
  console.log('  ✅ Created index.html');

  // Step 5: Create test.html
  console.log('🧪 Creating test.html...');
  const testHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Marketrix Widget Test</title>
    <link rel="stylesheet" href="./style.css">
    <style>
        body { font-family: sans-serif; margin: 20px; }
        .status { padding: 10px; margin-top: 10px; border-radius: 5px; }
        .status.success { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .status.error { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .status.info { background-color: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
        .results-container { margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px; }
        .results-container .status { margin-bottom: 10px; }
    </style>
</head>
<body>
    <h1>Marketrix Widget Test Page</h1>
    <div id="status-message" class="status info">Initializing...</div>
    <button onclick="testWidget()">Initialize Widget</button>
    <button onclick="destroyWidget()">Destroy Widget</button>
    <button onclick="updateConfig()">Update Config</button>
    <div class="results-container" id="test-results">
        <h2>Test Results:</h2>
    </div>

    <script src="./marketrix-inapp-standalone.umd.cjs"></script>
    <script>
        let widgetInstance = null;

        function updateStatus(message, type = 'info') {
            const statusDiv = document.getElementById('status-message');
            statusDiv.className = \`status \${type}\`;
            statusDiv.textContent = message;
        }

        function addTestResult(message, type = 'info') {
            const resultsDiv = document.getElementById('test-results');
            const resultDiv = document.createElement('div');
            resultDiv.className = \`status \${type}\`;
            resultDiv.innerHTML = \`<strong>Test Result:</strong> \${message}\`;
            resultsDiv.appendChild(resultDiv);
        }
        
        function testWidget() {
          try {
            if (typeof MarketrixInApp === 'undefined') {
              addTestResult('MarketrixInApp class not found!', 'error');
              return;
            }
            
            if (widgetInstance) {
              addTestResult('Widget already initialized', 'error');
              return;
            }
            
            // The standalone build exports the widget as an object with methods
            const widgetAPI = MarketrixInApp.default || MarketrixInApp;
            widgetInstance = widgetAPI.initMarketrixWidget({
              marketrixId: 'test-widget',
              marketrixKey: 'test-key',
              position: 'bottom-right',
              theme: 'light',
              enabledModes: ['show', 'tell', 'do']
            });
            
            addTestResult('Widget created successfully!', 'success');
            updateStatus('Widget initialized successfully', 'success');
            
          } catch (error) {
            addTestResult(\`Error creating widget: \${error.message}\`, 'error');
            updateStatus('Failed to initialize widget', 'error');
            console.error('Widget creation error:', error);
          }
        }

        function destroyWidget() {
            try {
                if (!widgetInstance) {
                    addTestResult('No widget to destroy', 'error');
                    return;
                }
                if (MarketrixInApp.destroyMarketrixWidget) {
                    MarketrixInApp.destroyMarketrixWidget();
                    widgetInstance = null;
                    addTestResult('Widget destroyed successfully!', 'success');
                    updateStatus('Widget destroyed', 'info');
                } else {
                    addTestResult('destroyMarketrixWidget not found on MarketrixInApp', 'error');
                }
            } catch (error) {
                addTestResult(\`Error destroying widget: \${error.message}\`, 'error');
                updateStatus('Failed to destroy widget', 'error');
                console.error('Widget destruction error:', error);
            }
        }

        function updateConfig() {
            try {
                if (!widgetInstance) {
                    addTestResult('No widget initialized to update config', 'error');
                    return;
                }
                if (MarketrixInApp.updateMarketrixConfig) {
                    MarketrixInApp.updateMarketrixConfig({ theme: 'dark' });
                    addTestResult('Widget config updated to dark theme!', 'success');
                    updateStatus('Widget config updated', 'info');
                } else {
                    addTestResult('updateMarketrixConfig not found on MarketrixInApp', 'error');
                }
            } catch (error) {
                addTestResult(\`Error updating config: \${error.message}\`, 'error');
                updateStatus('Failed to update widget config', 'error');
                console.error('Widget config update error:', error);
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            updateStatus('Page loaded. Click "Initialize Widget" to start.');
        });
    </script>
</body>
</html>`;
  
  fs.writeFileSync(path.join('dist', 'test.html'), testHtml);
  console.log('  ✅ Created test.html');

  // Step 6: Create integration guide
  console.log('📚 Creating integration guide...');
  const integrationGuide = `# Marketrix Widget Integration Guide

This guide provides instructions on how to integrate the Marketrix In-App Support Widget into your website using the built files.

## 📦 **Built Files Overview**

After running \`npm run build\`, the \`dist/\` folder will contain the following essential files:

-   \`marketrix-inapp-standalone.umd.cjs\`: The main widget JavaScript bundle, including all its dependencies (like React). This is the recommended file for direct script inclusion.
-   \`style.css\`: The CSS file containing all the necessary styles for the widget.
-   \`index.html\`: A demo page showcasing the widget's features and integration.
-   \`test.html\`: A simple page to quickly test if the widget loads and initializes correctly.
-   \`src/\`: Complete source code including components, services, utils, and configuration files.

## 🚀 **Integration Methods**

### **Method 1: Direct Script Inclusion (Recommended for most websites)**

This method is suitable for most web projects where you want to embed the widget directly into your HTML.

1.  **Upload Files:** Upload the \`marketrix-inapp-standalone.umd.cjs\` and \`style.css\` files from your \`dist/\` folder to your web server.

2.  **Add to HTML:** Include the CSS file in the \`<head>\` section and the JavaScript file before the closing \`</body>\` tag of your website.

    \`\`\`html
    <!DOCTYPE html>
    <html>
    <head>
        <link rel="stylesheet" href="./style.css">
    </head>
    <body>
        <!-- Your website content -->
        
        <!-- Load the widget -->
        <script src="./marketrix-inapp-standalone.umd.cjs"></script>
        <script>
            // The standalone build exports the widget as an object with methods
            const widgetAPI = MarketrixInApp.default || MarketrixInApp;
            const widget = widgetAPI.initMarketrixWidget({
                marketrixId: 'your-widget-id',
                marketrixKey: 'your-widget-key',
                position: 'bottom-right',
                theme: 'light',
                enabledModes: ['show', 'tell', 'do']
            });
        </script>
    </body>
    </html>
    \`\`\`

## ✨ **Widget Features**

The Marketrix widget provides a comprehensive in-app support experience, including:

-   ✅ **AI Assistant** - Contextual help and automated responses
-   ✅ **Live Chat** - Real-time communication with support agents
-   ✅ **Knowledge Base** - Access to articles and FAQs
-   ✅ **Screen Sharing** - Seamless screen sharing for guided assistance
-   ✅ **Interactive Guides** - Step-by-step tours for onboarding and feature adoption
-   ✅ **iPhone-style Notifications** - Attractive success and info messages
-   ✅ **Multiple modes** - Show, Tell, Do interaction modes
-   ✅ **Responsive design** - Works on all devices and screen sizes

## 🔧 **Configuration Options**

\`\`\`javascript
// The standalone build exports the widget as an object with methods
const widgetAPI = MarketrixInApp.default || MarketrixInApp;
const widget = widgetAPI.initMarketrixWidget({
    // Required
    marketrixId: 'your-widget-id',
    marketrixKey: 'your-widget-key',
    
    // Optional
    position: 'bottom-right',        // 'bottom-right', 'bottom-left', 'top-right', 'top-left'
    theme: 'light',                  // 'light', 'dark', 'auto'
    enabledModes: ['show', 'tell', 'do'], // Available interaction modes
    avatarUrl: 'https://...',        // Custom avatar image
    agentName: 'AI Assistant',       // Custom agent name
    debug: false,                    // Enable debug logging
    zIndex: 40                       // CSS z-index for positioning
});
\`\`\`

## 🧪 **Testing Your Widget**

### **Test the Widget:**
1. Open \`test.html\` in your browser (from the \`dist/\` folder).
2. Click the "Initialize Widget" button.
3. Verify that the widget appears and there are no console errors.
4. Use the "Destroy Widget" and "Update Config" buttons to test other functionalities.

### **Test the Demo Page:**
1. Open \`index.html\` in your browser (from the \`dist/\` folder).
2. Interact with the demo elements (hover, click buttons, fill forms).
3. Observe the contextual help and iPhone-style notifications.
4. Ensure all interactive features work as expected.

---
*Marketrix In-App Support Widget - Built for seamless customer experience.*`;
  
  fs.writeFileSync(path.join('dist', 'INTEGRATION_GUIDE.md'), integrationGuide);
  console.log('  ✅ Created INTEGRATION_GUIDE.md');

  // Step 7: Create README for dist
  console.log('📖 Creating README...');
  const readme = `# Marketrix Widget - Built Files

This directory contains the complete built Marketrix In-App Support Widget ready for deployment.

## 🚀 Quick Start

1. **Demo the Widget**: Open \`index.html\` in your browser to see the interactive demo
2. **Test the Widget**: Open \`test.html\` to test widget initialization
3. **Integration Guide**: See \`INTEGRATION_GUIDE.md\` for detailed integration instructions

## 📁 File Structure

\`\`\`
dist/
├── index.html                           # Interactive demo page
├── test.html                            # Widget test page
├── style.css                            # Widget styles
├── marketrix-inapp-standalone.umd.cjs   # Main widget bundle (includes React)
├── INTEGRATION_GUIDE.md                 # Integration instructions
├── README.md                            # This file
└── src/                                 # Complete source code
    ├── config/
    │   └── widget-atmosphere.json       # Widget configuration
    ├── components/                      # React components
    ├── services/                        # API and demo services
    ├── utils/                          # Utility functions
    ├── hooks/                          # React hooks
    └── types/                          # TypeScript types
\`\`\`

## 🔧 Usage

### For Demo/Testing:
- Open \`index.html\` in your browser
- Hover over elements to see AI assistance
- Test the widget functionality

### For Integration:
- Use \`marketrix-inapp-standalone.umd.cjs\` and \`style.css\`
- Follow instructions in \`INTEGRATION_GUIDE.md\`
- Customize using files in \`src/\` directory

## 📞 Support

For integration help or questions, refer to the \`INTEGRATION_GUIDE.md\` file or contact the development team.

---
*Built with ❤️ by the Marketrix team*`;
  
  fs.writeFileSync(path.join('dist', 'README.md'), readme);
  console.log('  ✅ Created README.md');

  // Step 8: List final files
  console.log('\\n📋 Final dist directory contents:');
  const distFiles = fs.readdirSync('dist', { recursive: true });
  distFiles.forEach(file => {
    const filePath = typeof file === 'string' ? file : file.join('/');
    console.log(`  - ${filePath}`);
  });

  console.log('\\n🎉 Build completed successfully!');
  console.log('\\n📁 All files are ready in the dist/ directory');
  console.log('\\n🚀 You can now:');
  console.log('  - Open dist/index.html in your browser to see the demo');
  console.log('  - Open dist/test.html to test the widget');
  console.log('  - Deploy the dist/ folder to any web server');
  console.log('  - Use dist/marketrix-inapp-standalone.umd.cjs in your projects');
  console.log('  - Reference dist/src/ for source code and customization');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
