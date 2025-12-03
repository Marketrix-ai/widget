# Debug Panel Usage Guide

Quick guide for using the Debug Panel and Bookmarklet to test browser tools.

---

## Debug Panel (UI)

### Opening the Panel

Press **`Ctrl+Shift+D`** to toggle the debug panel (appears in top-right
corner).

### Tools Tab

1. **Select a tool** from the dropdown (e.g., `click_element`, `type_text`,
   `scroll`)
2. **Fill in parameters** - required fields marked with red \*
3. **Choose mode**:
   - **Do** - Execute immediately
   - **Show** - Show confirmation overlay first
4. Click **Execute**
5. See result below (success/error message)

### Elements Tab

1. Click **"Index DOM Elements"** to scan the page
2. View all interactable elements with their index numbers
3. **Click** an element to highlight it on the page
4. **Double-click** to use that index in the Tools tab

### Example: Click a Button

1. Open panel (`Ctrl+Shift+D`)
2. Go to **Elements** tab → Click **"Index DOM Elements"**
3. Find the button in the list, note its index (e.g., `5`)
4. Go to **Tools** tab → Select `click_element`
5. Enter `5` in the index field
6. Click **Execute**

---

## Bookmarklet (Use on Any Website)

### What is it?

A bookmark that injects the debug panel into any website (Google, customer
sites, etc.).

### Setup

1. **Make sure dev server is running:**

   ```bash
   npm run start
   ```

2. **Create a new bookmark:**
   - Right-click bookmarks bar → "Add page"
   - Name: `🔧 Debug Panel`
   - URL: paste this code:

   ```javascript
   javascript: (function () {
     var s = document.createElement('script');
     s.type = 'module';
     s.src = 'http://localhost:5173/debug.js';
     document.body.appendChild(s);
   })();
   ```

3. **Use it:**
   - Go to any website
   - Click the bookmark
   - Debug panel appears
   - Press `Ctrl+Shift+D` to toggle

### For Production (HTTPS sites)

Localhost won't work on HTTPS sites. Host debug.js on your CDN:

```bash
npm run build:debug
# Upload dist/debug.js to your CDN
```

Update bookmarklet URL:

```javascript
javascript: (function () {
  var s = document.createElement('script');
  s.type = 'module';
  s.src = 'https://your-cdn.com/debug.js';
  document.body.appendChild(s);
})();
```

---

## Console Commands (Alternative)

Open browser DevTools (F12) and use console:

```javascript
// Index DOM (required before using element tools)
devTools.indexDOM();

// List all indexed elements
devTools.listElements();

// Highlight element by index
devTools.highlightElement(5);

// Execute a tool
await devTools.testTool('click_element', { index: 5 });
await devTools.testTool('type_text', { index: 3, text: 'Hello' });
await devTools.testTool('scroll', { direction: 'down' });

// Show all available commands
devTools.help();
```

---

## Quick Reference

| Tool                     | Required Parameters | Example                         |
| ------------------------ | ------------------- | ------------------------------- |
| `click_element`          | `index`             | `{ index: 5 }`                  |
| `type_text`              | `index`, `text`     | `{ index: 3, text: "hello" }`   |
| `scroll`                 | `direction`         | `{ direction: "down" }`         |
| `send_keys`              | `index`, `keys`     | `{ index: 2, keys: "Enter" }`   |
| `select_dropdown_option` | `index`, `option`   | `{ index: 4, option: "us" }`    |
| `navigate`               | `url`               | `{ url: "https://google.com" }` |

### Keyboard Keys for `send_keys`

`Enter`, `Tab`, `Escape`, `Space`, `Backspace`, `Delete`, `ArrowUp`,
`ArrowDown`, `ArrowLeft`, `ArrowRight`, `Home`, `End`
