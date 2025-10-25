#!/usr/bin/env node

/**
 * Marketrix Widget Deployment Script
 * 
 * This script helps you deploy your widget to various hosting platforms
 * Run with: node deploy.js [platform]
 * 
 * Supported platforms:
 * - netlify: Deploy to Netlify
 * - vercel: Deploy to Vercel
 * - github: Deploy to GitHub Pages
 * - zip: Create a deployment zip file
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const platforms = {
  netlify: {
    name: 'Netlify',
    command: 'npx netlify-cli deploy --prod --dir=dist',
    install: 'npm install -g netlify-cli',
    description: 'Deploy to Netlify (requires netlify-cli)'
  },
  vercel: {
    name: 'Vercel',
    command: 'npx vercel --prod',
    install: 'npm install -g vercel',
    description: 'Deploy to Vercel (requires vercel-cli)'
  },
  github: {
    name: 'GitHub Pages',
    command: 'npx gh-pages -d dist',
    install: 'npm install -g gh-pages',
    description: 'Deploy to GitHub Pages (requires gh-pages)'
  },
  zip: {
    name: 'ZIP File',
    command: 'node -e "require(\'child_process\').execSync(\'cd dist && zip -r ../marketrix-widget-deploy.zip .\')"',
    install: 'No additional installation required',
    description: 'Create a deployment zip file'
  }
};

function showHelp() {
  console.log('\n🚀 Marketrix Widget Deployment Script\n');
  console.log('Usage: node deploy.js [platform]\n');
  console.log('Available platforms:');
  
  Object.entries(platforms).forEach(([key, platform]) => {
    console.log(`  ${key.padEnd(10)} - ${platform.description}`);
  });
  
  console.log('\nExamples:');
  console.log('  node deploy.js netlify  # Deploy to Netlify');
  console.log('  node deploy.js vercel   # Deploy to Vercel');
  console.log('  node deploy.js zip      # Create zip file');
  console.log('\nPrerequisites:');
  console.log('  - Make sure you have run "npm run build" first');
  console.log('  - Install the required CLI tools for your chosen platform\n');
}

function checkBuildFiles() {
  const distPath = path.join(__dirname, 'dist');
  
  if (!fs.existsSync(distPath)) {
    console.error('❌ Error: dist/ folder not found. Please run "npm run build" first.');
    process.exit(1);
  }
  
  const requiredFiles = ['index.html', 'meet.js'];
  const missingFiles = requiredFiles.filter(file => !fs.existsSync(path.join(distPath, file)));
  
  if (missingFiles.length > 0) {
    console.error(`❌ Error: Missing required files: ${missingFiles.join(', ')}`);
    console.error('Please run "npm run build" first.');
    process.exit(1);
  }
  
  console.log('✅ Build files found and ready for deployment');
}

function createNetlifyConfig() {
  const netlifyConfig = {
    redirects: [
      {
        from: "/*",
        to: "/index.html",
        status: 200
      }
    ],
    headers: [
      {
        for: "/*.js",
        values: {
          "Cache-Control": "public, max-age=31536000, immutable"
        }
      },
      {
        for: "/*.css",
        values: {
          "Cache-Control": "public, max-age=31536000, immutable"
        }
      }
    ]
  };
  
  fs.writeFileSync(
    path.join(__dirname, 'dist', '_redirects'),
    netlifyConfig.redirects.map(r => `${r.from} ${r.to} ${r.status}`).join('\n')
  );
  
  fs.writeFileSync(
    path.join(__dirname, 'dist', 'netlify.toml'),
    `[build]
  publish = "dist"
  
  [[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
  
  [[headers]]
  for = "/*.js"
  [headers.values]
  Cache-Control = "public, max-age=31536000, immutable"
  
  [[headers]]
  for = "/*.css"
  [headers.values]
  Cache-Control = "public, max-age=31536000, immutable"`
  );
  
  console.log('✅ Created Netlify configuration files');
}

function createVercelConfig() {
  const vercelConfig = {
    version: 2,
    builds: [
      {
        src: "dist/**/*",
        use: "@vercel/static"
      }
    ],
    routes: [
      {
        src: "/(.*)",
        dest: "/dist/$1"
      }
    ]
  };
  
  fs.writeFileSync(
    path.join(__dirname, 'vercel.json'),
    JSON.stringify(vercelConfig, null, 2)
  );
  
  console.log('✅ Created Vercel configuration file');
}

function createGitHubPagesConfig() {
  const githubConfig = {
    name: "Deploy to GitHub Pages",
    on: {
      push: {
        branches: ["main"]
      }
    },
    jobs: {
      deploy: {
        "runs-on": "ubuntu-latest",
        steps: [
          {
            name: "Checkout",
            uses: "actions/checkout@v2"
          },
          {
            name: "Setup Node.js",
            uses: "actions/setup-node@v2",
            with: {
              "node-version": "18"
            }
          },
          {
            name: "Install dependencies",
            run: "npm install"
          },
          {
            name: "Build",
            run: "npm run build"
          },
          {
            name: "Deploy to GitHub Pages",
            uses: "peaceiris/actions-gh-pages@v3",
            with: {
              github_token: "${{ secrets.GITHUB_TOKEN }}",
              publish_dir: "./dist"
            }
          }
        ]
      }
    }
  };
  
  const workflowsDir = path.join(__dirname, '.github', 'workflows');
  if (!fs.existsSync(workflowsDir)) {
    fs.mkdirSync(workflowsDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(workflowsDir, 'deploy.yml'),
    `name: Deploy to GitHub Pages
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Build
        run: npm run build
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: \${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist`
  );
  
  console.log('✅ Created GitHub Pages workflow');
}

function deploy(platform) {
  console.log(`\n🚀 Deploying to ${platforms[platform].name}...\n`);
  
  try {
    switch (platform) {
      case 'netlify':
        createNetlifyConfig();
        execSync(platforms[platform].command, { stdio: 'inherit' });
        break;
        
      case 'vercel':
        createVercelConfig();
        execSync(platforms[platform].command, { stdio: 'inherit' });
        break;
        
      case 'github':
        createGitHubPagesConfig();
        console.log('✅ GitHub Pages workflow created');
        console.log('📝 Next steps:');
        console.log('   1. Commit and push your changes');
        console.log('   2. Go to your repository settings');
        console.log('   3. Enable GitHub Pages in the Pages section');
        console.log('   4. Select "GitHub Actions" as the source');
        break;
        
      case 'zip':
        execSync('cd dist && powershell Compress-Archive -Path * -DestinationPath ../marketrix-widget-deploy.zip -Force', { stdio: 'inherit' });
        console.log('✅ Created marketrix-widget-deploy.zip');
        console.log('📁 You can now upload this zip file to any hosting service');
        break;
        
      default:
        console.error(`❌ Unknown platform: ${platform}`);
        showHelp();
        process.exit(1);
    }
    
    console.log(`\n🎉 Successfully deployed to ${platforms[platform].name}!`);
    
  } catch (error) {
    console.error(`❌ Deployment failed: ${error.message}`);
    console.log(`\n💡 Make sure you have installed the required CLI tool:`);
    console.log(`   ${platforms[platform].install}`);
    process.exit(1);
  }
}

// Main execution
const platform = process.argv[2];

if (!platform || platform === 'help' || platform === '--help' || platform === '-h') {
  showHelp();
  process.exit(0);
}

if (!platforms[platform]) {
  console.error(`❌ Unknown platform: ${platform}`);
  showHelp();
  process.exit(1);
}

checkBuildFiles();
deploy(platform);
