# Debug Tools - How It Works & How to Use

> Personal reference document for testing browser tools in isolation from the
> agent.

---

## What Are Debug Tools?

Debug tools let you **test widget browser tools without needing the AI agent**.
Instead of waiting for the agent to send commands, you can:

1. **Manually execute tools** from a visual panel
2. **Run commands in browser console**
3. **See which DOM elements are indexed**
4. **Verify tools work correctly**

---

## Files Overview

```
src/
├── debug.tsx                      # Entry point (loads debug panel)
├── utils/devTools.ts              # Console helpers (devTools object)
└── components/debug/DebugPanel.tsx # Visual UI panel

test.html                          # Test page with sample elements
vite.config.debug.ts               # Build config for debug.js
```

---

## How to Use

### Step 1: Start the Dev Server

```bash
npm run start
```

This starts Vite at `http://localhost:5173`

### Step 2: Open the Test Page

Open `test.html` in your browser:

```
http://localhost:5173/test.html
```

Or open it directly as a file (but scripts need the dev server running).

### Step 3: Use the Debug Panel

Press **`Ctrl+Shift+D`** to toggle the debug panel.

The panel appears in the **top-right corner** with a dark DevTools-style look.

---

## Debug Panel Features

### Tools Tab

![Tools Tab]

1. **Select Tool** - Dropdown with all available tools grouped by category:
   - Navigation: `navigate`, `search`, `go_back`
   - Interaction: `click_element`, `type_text`, `scroll`, etc.
   - Extraction: `extract`, `get_html`, `get_screenshot`
   - Utility: `wait`, `done`, `close_tab`

2. **Parameters** - Input fields appear based on selected tool:
   - Required params marked with red \*
   - Placeholder text shows expected values

3. **Mode Toggle**:
   - **Do** - Executes immediately (like agent's "do" mode)
   - **Show** - Shows confirmation overlay first (like agent's "show" mode)

4. **Execute Button** - Runs the tool

5. **Result Display** - Shows success/failure and output

### Elements Tab

1. **Index DOM Elements** button - Scans the page for interactable elements

2. **Element List** - Shows all indexed elements:
   - Index number (what you pass to tools)
   - Tag name (`<button>`, `<input>`, etc.)
   - ID if present
   - Text content preview

3. **Click** an element to highlight it on the page

4. **Double-click** to use that index in the Tools tab

---

## Console Commands (devTools)

Open browser DevTools (F12) and use the console:

```javascript
// Show all available commands
devTools.help();

// Index DOM elements (REQUIRED before using element tools!)
devTools.indexDOM();

// List elements in a table
devTools.listElements();

// Highlight element by index (stays highlighted for 2 seconds)
devTools.highlightElement(5);

// Execute a tool
await devTools.testTool('click_element', { index: 5 });
await devTools.testTool('type_text', { index: 3, text: 'Hello World' });
await devTools.testTool('scroll', { direction: 'down' });

// Execute with Show mode (confirmation UI)
await devTools.testTool('click_element', { index: 5 }, 'show', 'Click this button');

// Run a sequence of tools
await devTools.runSequence([
  { tool: 'click_element', args: { index: 0 } },
  { tool: 'type_text', args: { index: 1, text: 'test@email.com' }, delay: 500 },
  { tool: 'click_element', args: { index: 3 } },
]);

// Check WebSocket status
devTools.getConnectionStatus();

// Get chat messages
devTools.getMessages();

// Clear chat history
devTools.clearChat();
```

### Direct Service Access

```javascript
// DOM Service
domService.indexInteractableElements();
domService.getElementByIndex(5);
domService.isIndexActive();

// Tool Service
await toolExecutionService.executeTool('scroll', { direction: 'down' }, 'do');

// Chat Service
chatService.getMessages();
chatService.clearMessages();
```

---

## Tool Reference

### Navigation Tools

| Tool       | Parameters                                                      | Description         |
| ---------- | --------------------------------------------------------------- | ------------------- |
| `navigate` | `url` (required), `new_tab` (optional)                          | Go to a URL         |
| `search`   | `query` (required), `engine` (optional: google/bing/duckduckgo) | Web search          |
| `go_back`  | none                                                            | Browser back button |

### Interaction Tools

| Tool                     | Parameters                                 | Description                  |
| ------------------------ | ------------------------------------------ | ---------------------------- |
| `click_element`          | `index` (required)                         | Click element by index       |
| `type_text`              | `index`, `text` (required)                 | Type into input field        |
| `scroll`                 | `direction` (required: up/down/left/right) | Scroll page                  |
| `scroll_to_text`         | `text` (required)                          | Scroll until text is visible |
| `send_keys`              | `index`, `keys` (required)                 | Send keyboard events         |
| `select_dropdown_option` | `index`, `option` (required)               | Select dropdown value        |

### Extraction Tools

| Tool                   | Parameters         | Description                                        |
| ---------------------- | ------------------ | -------------------------------------------------- |
| `extract`              | none               | Get page title, URL, text, links                   |
| `get_html`             | none               | Get full HTML with data-id attributes              |
| `get_dropdown_options` | `index` (required) | Get dropdown options                               |
| `get_screenshot`       | none               | Capture screenshot (needs screen share permission) |

### Utility Tools

| Tool        | Parameters           | Description             |
| ----------- | -------------------- | ----------------------- |
| `wait`      | `seconds` (required) | Wait for specified time |
| `done`      | `success` (optional) | Mark task complete      |
| `close_tab` | none                 | Close current tab       |

---

## How DOM Indexing Works

Before you can use element-based tools (`click_element`, `type_text`, etc.), the
DOM must be indexed.

### What Indexing Does:

1. Walks through the entire page DOM
2. Finds all "interactable" elements:
   - Buttons, links, inputs, selects, textareas
   - Elements with click handlers
   - Elements with interactive roles
3. Assigns each element a number (0, 1, 2, ...)
4. Stores a CSS selector for each element

### When to Re-Index:

- After page navigation
- After dynamic content loads
- After elements are added/removed

### Example:

```javascript
// Index the page
devTools.indexDOM();
// Output: [DevTools] Indexed 15 interactable elements

// See what was indexed
devTools.listElements();
// Shows table: index, tag, id, class, text

// Use an index
await devTools.testTool('click_element', { index: 3 });
```

---

## Testing Workflow

### 1. Testing a Single Tool

```javascript
// 1. Index DOM
devTools.indexDOM();

// 2. Find the element you want
devTools.listElements();

// 3. Highlight to verify
devTools.highlightElement(5);

// 4. Execute tool
await devTools.testTool('click_element', { index: 5 });

// 5. Check result
// Output shows success/failure
```

### 2. Testing a Form Flow

```javascript
// Index first
devTools.indexDOM();

// Run sequence
await devTools.runSequence([
  { tool: 'type_text', args: { index: 2, text: 'John Doe' } },
  { tool: 'type_text', args: { index: 3, text: 'john@email.com' }, delay: 300 },
  {
    tool: 'select_dropdown_option',
    args: { index: 5, option: 'us' },
    delay: 300,
  },
  { tool: 'click_element', args: { index: 8 }, delay: 500 },
]);
```

### 3. Testing Show Mode

Show mode displays a confirmation overlay before executing:

```javascript
// With Debug Panel:
// 1. Select tool
// 2. Set mode to "Show"
// 3. Add explanation text
// 4. Click Execute
// 5. Confirmation overlay appears
// 6. Click confirm or cancel

// With Console:
await devTools.testTool('click_element', { index: 5 }, 'show', 'This will submit the form');
```

---

## Production Build

```bash
# Build debug.js (unminified, with sourcemaps)
npm run build:debug

# Output: dist/debug.js
```

To use in production:

```html
<script type="module" src="/path/to/debug.js"></script>
```

---

## Troubleshooting

### "Element not found" Error

**Cause:** DOM not indexed or index is stale

**Fix:**

```javascript
devTools.indexDOM();
```

### Tool Executes But Nothing Happens

**Cause:** Wrong element index

**Fix:**

```javascript
// Verify the element
devTools.highlightElement(5);
// If wrong element, re-index and find correct one
devTools.listElements();
```

### Debug Panel Not Appearing

**Cause:** Script not loaded or keyboard shortcut conflict

**Fix:**

1. Check browser console for errors
2. Try clicking in the page first (to give it focus)
3. Press `Ctrl+Shift+D` again
4. Check if `http://localhost:5173/debug.js` loads

### Cannot Type in Inputs

**Cause:** Element might not be an input, or wrong index

**Fix:**

```javascript
// Check element type
const el = domService.getElementByIndex(3);
console.log(el.tagName, el.type);
```

---

## Using Debug Tools on Any Website (Bookmarklet)

The debug panel can be injected into **any website** (Google, customer sites,
etc.) using a bookmarklet.

### What is a Bookmarklet?

A bookmarklet is a bookmark that runs JavaScript instead of opening a URL. Click
it on any page to inject the debug panel.

### Setup Instructions

#### Step 1: Choose Your Script URL

**For local development (dev server must be running):**

```
http://localhost:5173/debug.js
```

**For production (host debug.js on your CDN):**

```
https://your-cdn.com/debug.js
```

#### Step 2: Create the Bookmarklet

**Localhost version:**

```javascript
javascript: (function () {
  var s = document.createElement('script');
  s.type = 'module';
  s.src = 'http://localhost:5173/debug.js';
  document.body.appendChild(s);
})();
```

**Production CDN version:**

```javascript
javascript: (function () {
  var s = document.createElement('script');
  s.type = 'module';
  s.src = 'https://your-cdn.com/debug.js';
  document.body.appendChild(s);
})();
```

#### Step 3: Add to Browser Bookmarks

1. **Right-click** your bookmarks bar
2. Click **"Add page"** or **"Add bookmark"**
3. Set **Name:** `🔧 Marketrix Debug`
4. Set **URL:** Paste the bookmarklet code from Step 2
5. Click **Save**

#### Step 4: Use It!

1. Go to **any website** (Google, customer site, anywhere)
2. Click the **"🔧 Marketrix Debug"** bookmark
3. Debug panel appears in the top-right corner
4. Press `Ctrl+Shift+D` to toggle visibility

### Visual Guide

```
┌─────────────────────────────────────────────────────────────┐
│  ☆ Bookmarks Bar                                            │
│  ┌────────────────────┐                                     │
│  │ 🔧 Marketrix Debug │  ← Click this on any site           │
│  └────────────────────┘                                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Any Website (Google, customer site, etc.)                  │
│                                                             │
│                                      ┌────────────────────┐ │
│                                      │ 🔧 Debug Panel     │ │
│                                      │                    │ │
│                                      │ [Tools] [Elements] │ │
│                                      │                    │ │
│                                      │ Select Tool: ▼     │ │
│                                      │ click_element      │ │
│                                      │                    │ │
│                                      │ [Execute]          │ │
│                                      └────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Bookmarklet Troubleshooting

**Panel doesn't appear:**

- Make sure dev server is running (`npm run start`)
- Check browser console for CORS or loading errors
- Some sites block external scripts - try a different site

**"Module not found" error:**

- The script uses ES modules (`type="module"`)
- Older browsers may not support this
- Use Chrome, Firefox, or Edge (latest versions)

**Works locally but not on other sites:**

- Localhost scripts can't be loaded on HTTPS sites (mixed content)
- Solution: Host `debug.js` on HTTPS (your CDN)

### Hosting debug.js for Production Use

```bash
# 1. Build the debug script
npm run build:debug

# 2. Upload dist/debug.js to your CDN
# Example: https://cdn.marketrix.com/debug.js

# 3. Update bookmarklet with CDN URL
javascript:(function(){var s=document.createElement('script');s.type='module';s.src='https://cdn.marketrix.com/debug.js';document.body.appendChild(s);})()
```

---

## Files You Can Ignore in Git

Add to `.gitignore` if not already:

```
test.html
DEBUG_TOOLS_README.md
PERSONAL_README.md
dist/debug.js
```

These are personal development files, not for production or GitHub.
