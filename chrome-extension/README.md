# Marketrix Widget Chrome Extension

This Chrome extension automatically injects the Marketrix widget on all pages,
persisting across full page navigations.

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select this folder (`widget/chrome-extension`)

## Usage

1. Click the Marketrix extension icon in your browser toolbar
2. Configure the settings:
   - **Script URL**: URL to your index.mjs file (e.g.,
     `http://localhost:5174/index.mjs` or `https://cdn.marketrix.io/widget/index.mjs`)
   - **API Host**: API server URL (e.g., `https://api.marketrix.ai`)
   - **AI Host**: Agent server URL (e.g., `https://agent.marketrix.ai`)
   - **App ID (mtx-app)**: Your connection/app ID
   - **Agent ID (mtx-agent)**: Your agent ID
3. Click "Save Configuration"
4. Toggle "Enable Widget" to ON

The widget will now appear on every page you visit, including after full page
navigations like Google search results.

## Why an Extension?

Bookmarklets cannot persist across full page navigations because:

- When a page navigates, ALL JavaScript is destroyed
- The new page loads fresh with no memory of previous scripts
- Only browser extensions can run code automatically on every page load

## Configuration Options

| Setting    | Description                 | Example                                     |
| ---------- | --------------------------- | ------------------------------------------- |
| Script URL | URL to the widget bundle    | `https://cdn.marketrix.io/widget/index.mjs` |
| API Host   | Marketrix API server URL    | `https://api.marketrix.ai`                  |
| AI Host    | Marketrix Agent server URL  | `https://agent.marketrix.ai`                |
| App ID     | Connection/App ID (mtx-app) | `123`                                       |
| Agent ID   | Agent ID (mtx-agent)        | `456`                                       |

## Files

- `manifest.json` - Extension configuration (Manifest V3)
- `content.js` - Script that runs on every page
- `popup.html` - Extension popup UI
- `popup.js` - Popup logic
- `icon*.png` - Extension icons (16x16, 48x48, 128x128)

## Development

### Local Development

1. Build and serve the widget locally:

   ```bash
   cd widget
   npm run build
   npx serve dist -l 5174 --cors
   ```

2. In the extension popup, set Script URL to:
   ```
   http://localhost:5174/index.mjs
   ```

### Production

Use the CDN URL:

```
https://cdn.marketrix.io/widget/index.mjs
```

## Troubleshooting

### Widget doesn't appear

- Check that the extension is enabled
- Verify the Script URL is accessible (try opening it in a new tab)
- Check browser console for errors
- Some sites have strict CSP that may block the widget

### Widget appears but doesn't work

- Verify API Host and AI Host are correct
- Check that App ID and Agent ID are valid
- Look for WebSocket connection errors in the console

### Mixed content errors

- If using local development (`http://localhost`) on HTTPS sites,
  you may see mixed content warnings
- For HTTPS sites, use HTTPS URLs or the CDN
