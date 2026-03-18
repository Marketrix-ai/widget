# Marketrix Widget Chrome Extension

A Manifest V3 Chrome extension that automatically injects the Marketrix widget
on every page, persisting across full-page navigations.

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select this folder (`widget/chrome-extension`)

## Usage

1. Click the Marketrix extension icon in your browser toolbar
2. Configure the settings:
   - **Script URL** — URL to the widget bundle (e.g.
     `http://localhost:5174/index.mjs` or `https://storage.marketrix.ai/widget/index.mjs`)
   - **Agent ID** — The agent identifier
   - **Application ID** — The application identifier
3. Click **Save Configuration**
4. Toggle **Enable Widget** to ON

The widget will now appear on every page you visit, including after full-page
navigations.

> **Tip:** Toggling the widget off removes the injected script and container
> from the active tab immediately — no reload required.

## Configuration Options

| Setting       | Description              | Default / Example                 |
| ------------- | ------------------------ | --------------------------------- |
| Script URL    | URL to the widget bundle | `http://localhost:5174/index.mjs` |
| Agent ID      | Agent identifier         | `10`                              |
| Application ID | Application identifier  | `13`                              |

### Extended Attributes (content script)

The content script can also set additional `<script>` attributes when present
in the stored config object. These are not currently exposed in the popup UI
but can be set programmatically via `chrome.storage.local`:

| Config Key   | Script Attribute | Description           |
| ------------ | ---------------- | --------------------- |
| `mtxAgent`   | `mtx-agent`      | Agent ID              |
| `mtxApp`     | `mtx-app`        | Application ID        |
| `mtxId`      | `mtx-id`         | Widget instance ID    |
| `mtxKey`     | `mtx-key`        | API key               |
| `mtxApiHost` | `mtx-api-host`   | API server URL        |
| `mtxAiHost`  | `mtx-ai-host`    | Agent (AI) server URL |

## How It Works

1. **`content.js`** runs at `document_start` on every URL.
2. It reads `chrome.storage.local` for `enabled` and `config`.
3. If enabled, it waits for `DOMContentLoaded` + a short delay (500 ms) to
   avoid race conditions with the host page's own scripts, then appends a
   `<script>` tag with the configured attributes.
4. A duplicate-injection guard prevents the widget from loading twice (checks
   for `#marketrix-widget-script`, `script[mtx-id]`, `script[mtx-app]`, or
   `#marketrix-widget-container`).
5. The popup communicates with the content script via `chrome.runtime.onMessage`
   to inject or remove the widget in real time.

## Files

| File            | Purpose                                            |
| --------------- | -------------------------------------------------- |
| `manifest.json` | Extension manifest (Manifest V3)                   |
| `content.js`    | Content script — injected on every page            |
| `popup.html`    | Popup UI for configuration & enable/disable toggle |
| `popup.js`      | Popup logic (save config, toggle, message tab)     |
| `icon16.png`    | Toolbar icon (16×16)                               |
| `icon48.png`    | Extensions page icon (48×48)                       |
| `icon128.png`   | Chrome Web Store / install icon (128×128)          |

### Permissions

| Permission  | Reason                                                |
| ----------- | ----------------------------------------------------- |
| `storage`   | Persist configuration & enabled state across sessions |
| `activeTab` | Send messages to the currently active tab             |

## Development

### Local Development

1. Build and serve the widget locally:

   ```bash
   cd widget
   npm run build
   npx serve dist -l 5174 --cors
   ```

2. In the extension popup, set **Script URL** to:

   ```
   http://localhost:5174/index.mjs
   ```

3. After making changes to extension files, go to `chrome://extensions/` and
   click the reload button on the extension card.

### Production

Use the CDN URL:

```
https://storage.marketrix.ai/widget/index.mjs
```
