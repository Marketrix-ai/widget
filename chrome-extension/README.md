# Marketrix Widget Chrome Extension

This Chrome extension automatically injects the Marketrix widget on all pages, persisting across full page navigations.

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select this folder (`widget-v2/chrome-extension`)

## Usage

1. Click the Marketrix extension icon in your browser toolbar
2. Configure the settings:
   - **Script URL**: URL to your meet.js file (e.g., `http://localhost:5174/meet.js`)
   - **Agent ID**: Your agent ID (e.g., `10`)
   - **Connection ID**: Your connection ID (e.g., `13`)
3. Click "Save Configuration"
4. Toggle "Enable Widget" to ON

The widget will now appear on every page you visit, including after full page navigations like Google search results.

## Why an Extension?

Bookmarklets cannot persist across full page navigations because:
- When a page navigates, ALL JavaScript is destroyed
- The new page loads fresh with no memory of previous scripts
- Only browser extensions can run code automatically on every page load

## Files

- `manifest.json` - Extension configuration
- `content.js` - Script that runs on every page
- `popup.html` - Extension popup UI
- `popup.js` - Popup logic
- `icon*.png` - Extension icons
