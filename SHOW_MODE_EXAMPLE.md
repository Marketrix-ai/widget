# Show Mode Example: "Show me how to login"

This document explains how the "show" mode works when a user asks questions like "Show me how to login".

## Overview

When a user selects the "Show" mode and asks "Show me how to login", the widget will:
1. Automatically call `get_html` to get the page HTML with `data-id` attributes
2. Find the login button in the HTML
3. Highlight it with a visual spotlight effect
4. Show a tooltip saying "Click this button"

## Flow Diagram

```
User selects "Show" mode
    ↓
User types: "Show me how to login"
    ↓
ChatWindow.handleSendMessage()
    ↓
Detects show mode + "show me" question
    ↓
showModeHelper.handleShowModeQuestion()
    ↓
1. Calls executeTool('get_html', {})
    ↓
2. Gets HTML with data-id attributes
    ↓
3. elementHighlightService.processShowModeQuestion()
    ↓
4. Finds login button by:
   - data-demo-element="login-button"
   - Text content "Login"
   - id="login-button"
    ↓
5. Gets data-id value (e.g., 42)
    ↓
6. highlightElementByDataId(42, { tooltipText: "Click this button" })
    ↓
7. Element is highlighted with:
   - Spotlight overlay (dark background with cutout)
   - Pulsing border around element
   - Tooltip above element
   - Smooth scroll to element
```

## Code Components

### 1. Mode Selector (`modeSelector.tsx`)

The user selects "Show" mode using the mode selector:
- Three modes: Tell, Show, Do
- "Show" mode is for visual guidance

### 2. Chat Window (`chatWindow.tsx`)

When a message is sent in show mode:

```typescript
// In handleSendMessage()
if (currentMode === 'show') {
  import('../utils/showModeHelper').then(({ handleShowModeQuestion }) => {
    handleShowModeQuestion(messageContent).catch((error) => {
      console.error('[ChatWindow] Error in show mode helper:', error);
    });
  });
}
```

### 3. Show Mode Helper (`showModeHelper.ts`)

Handles the automatic highlighting:

```typescript
export async function handleShowModeQuestion(question: string): Promise<void> {
  // Step 1: Get HTML with data-id attributes
  const htmlResult = await executeTool('get_html', {});
  const html = htmlResult.result;
  
  // Step 2: Find and highlight element
  processShowModeQuestion(question, html, 'click_element');
}
```

### 4. Element Highlight Service (`elementHighlightService.ts`)

Finds and highlights elements:

```typescript
export function processShowModeQuestion(
  question: string,
  html: string,
  actionType?: string
): boolean {
  // Find element by searching HTML
  const dataId = findElementDataId(html, {
    dataDemoElement: 'login-button',
    text: 'login',
  });
  
  // Highlight with tooltip
  return highlightElementByDataId(dataId, {
    tooltipText: 'Click this button',
    tooltipPosition: 'top',
  });
}
```

## HTML Structure

The login button in `index.html` has:

```html
<button
  class="demo-button"
  data-demo-element="login-button"
  data-demo-description="User authentication and account access"
  onclick="showLoginForm()"
>
  🔐 Login
</button>
```

When `get_html` is called, this becomes:

```html
<button
  class="demo-button"
  data-demo-element="login-button"
  data-id="42"  <!-- Added by get_html -->
  onclick="showLoginForm()"
>
  🔐 Login
</button>
```

## Finding Elements

The `findElementDataId` function searches HTML using multiple strategies:

1. **By data-demo-element**:
   ```typescript
   findElementDataId(html, { dataDemoElement: 'login-button' })
   ```

2. **By text content**:
   ```typescript
   findElementDataId(html, { text: 'Login' })
   ```

3. **By id attribute**:
   ```typescript
   findElementDataId(html, { id: 'login-button' })
   ```

4. **By className**:
   ```typescript
   findElementDataId(html, { className: 'demo-button' })
   ```

## Highlighting Features

When an element is highlighted:

1. **Spotlight Overlay**: Dark semi-transparent overlay covers the page
2. **Element Cutout**: Bright border around the element with pulsing animation
3. **Element Highlight**: Background color and border on the element itself
4. **Tooltip**: Floating tooltip with instruction text
5. **Auto-scroll**: Element scrolls into view smoothly
6. **Responsive**: Highlight follows element on scroll/resize

## Visual Example

```
┌─────────────────────────────────────┐
│  [Dark Overlay - 30% opacity]     │
│                                     │
│    ┌─────────────────┐             │
│    │  [Tooltip]      │             │
│    │ Click this      │             │
│    │ button          │             │
│    └─────────────────┘             │
│         ↓                          │
│    ┌─────────────┐                │
│    │ 🔐 Login    │ ← Highlighted  │
│    └─────────────┘                │
│    [Pulsing border]                │
│                                     │
└─────────────────────────────────────┘
```

## Tool Call Flow

### MCP Server Side (`mcp_server.py`)

1. Agent receives show mode question
2. Agent calls `get_html` tool via WebSocket:
   ```json
   {
     "jsonrpc": "2.0",
     "id": "123",
     "method": "tools/call",
     "params": {
       "name": "get_html",
       "arguments": {}
     }
   }
   ```

3. Widget executes `get_html` and returns HTML with `data-id` attributes

4. Agent analyzes HTML and finds login button with `data-id="42"`

5. Agent may call `click_element`:
   ```json
   {
     "jsonrpc": "2.0",
     "id": "124",
     "method": "tools/call",
     "params": {
       "name": "click_element",
       "arguments": {
         "index": 42
       }
     }
   }
   ```

### Widget Side (`toolExecutor.ts`)

1. `executeGetHtml()` is called
2. Clears previous index
3. Indexes all interactable elements
4. Adds `data-id` attributes to cloned HTML
5. Returns HTML string

## Testing with MCP CLI

You can test the flow using `mcp_cli.py`:

```bash
# 1. Get HTML to see data-id values
python agent/mcp_cli.py
# Select: get_html
# chat_id: your-chat-id

# 2. Find login button in HTML output
# Look for: data-demo-element="login-button" data-id="42"

# 3. Click the button
python agent/mcp_cli.py
# Select: click_element
# chat_id: your-chat-id
# index: 42
```

## Supported Questions

The system recognizes various question patterns:

- "Show me how to login"
- "Show me the login button"
- "Where is the login button?"
- "How do I login?"
- "Find the login button"

All of these will trigger the same highlighting flow.

## Customization

You can customize highlighting by modifying `highlightElementByDataId` options:

```typescript
highlightElementByDataId(dataId, {
  tooltipText: 'Custom instruction',
  tooltipPosition: 'bottom', // 'top' | 'bottom' | 'left' | 'right'
  highlightColor: 'rgba(255, 0, 0, 0.2)', // Custom highlight color
  borderColor: 'rgba(255, 0, 0, 0.8)', // Custom border color
  animation: true, // Enable/disable pulsing animation
});
```

## Clearing Highlights

Highlights are automatically cleared when:
- User sends a new message
- Page navigates
- Element is clicked (if configured)
- `clearHighlight()` is called manually

## Error Handling

If element is not found:
- Console warning is logged
- User sees normal agent response
- No visual highlight appears
- System continues normally

## Future Enhancements

Potential improvements:
1. Support for multiple elements (e.g., "Show me all buttons")
2. Step-by-step tours for multi-step processes
3. Voice instructions alongside visual highlights
4. Custom tooltip styling per element type
5. Integration with screen reader for accessibility

