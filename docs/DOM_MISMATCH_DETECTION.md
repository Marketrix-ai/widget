# DOM Index Mismatch Detection

## Overview

This document describes the DOM mismatch detection system implemented in the
Marketrix widget. The system ensures reliable execution of agent commands by
validating that elements haven't changed between indexing and command execution.

## Problem Statement

The widget captures DOM elements and assigns sequential indices (0, 1, 2...)
which are sent to the AI agent. The agent responds with actions referencing
these indices (e.g., `click_element { index: 5 }`). However, due to the dynamic
nature of web applications, the DOM may change before the agent's response
arrives:

- New elements inserted (shifting indices)
- Elements removed
- SPA re-renders creating new DOM nodes
- Content updates changing element attributes
- Lazy-loaded content appearing

Without detection, the agent's command could execute on the **wrong element**,
causing unintended actions.

---

## Solution: Fingerprint-Based Validation

### High-Level Flow

```
Agent sends: click_element { index: 5 }
                    │
                    ▼
         ┌─────────────────────────┐
         │  getValidatedElement(5) │
         └─────────────────────────┘
                    │
                    ▼
         ┌─────────────────────────┐
         │ 1. Get stored fingerprint│
         │ 2. Get element from map  │
         │ 3. Check document.contains│
         │ 4. Match fingerprint     │
         │ 5. Check interactability │
         └─────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
     VALID                   MISMATCH
        │                       │
        ▼                       ▼
   Execute action         Return DOM_CHANGED
                          (agent must call get_html)
```

---

## Element Fingerprint

### What is a Fingerprint?

A fingerprint is a snapshot of an element's identifying attributes captured
during indexing. It allows us to verify if an element is still the "same"
element later.

### Fingerprint Structure

```typescript
interface ElementFingerprint {
  tagName: string; // e.g., "BUTTON", "INPUT"
  id: string | null; // HTML id attribute
  textContent: string | null; // Truncated to 100 chars
  type: string | null; // For inputs (text, submit, etc.)
  role: string | null; // ARIA role attribute
  ariaLabel: string | null; // Accessibility label
  name: string | null; // Form element name
  href: string | null; // For anchor tags
  selector: string; // CSS selector path
  indexVersion: number; // Version when indexed
}
```

### How Fingerprint is Generated

```typescript
// During indexing (DomService.ts)
generateFingerprint(element: Element, selector: string): ElementFingerprint {
  return {
    tagName: element.tagName,
    id: element.id || null,
    textContent: truncate(element.textContent, 100),
    type: element.getAttribute('type'),
    role: element.getAttribute('role'),
    ariaLabel: element.getAttribute('aria-label'),
    name: element.getAttribute('name'),
    href: element.getAttribute('href'),
    selector: selector,
    indexVersion: this.indexVersion,
  };
}
```

### Example Fingerprint

For this HTML button:

```html
<button id="buy-btn" type="submit" aria-label="Purchase item">Buy Now</button>
```

Generated fingerprint:

```javascript
{
  tagName: "BUTTON",
  id: "buy-btn",
  textContent: "Buy Now",
  type: "submit",
  role: null,
  ariaLabel: "Purchase item",
  name: null,
  href: null,
  selector: "div.product-card > button#buy-btn",
  indexVersion: 1
}
```

---

## Fingerprint Matching

We use **strict matching** with early exit on strong identifiers.

### Matching Logic

```typescript
matchesFingerprint(element, fingerprint): boolean {
  // 1. STRICT: Tag must match exactly
  if (element.tagName !== fingerprint.tagName) return false;

  // 2. STRONG: ID match = immediately accept
  if (fingerprint.id && element.id === fingerprint.id) return true;

  // 3. For inputs, type must match
  if (fingerprint.type && element.getAttribute('type') !== fingerprint.type)
    return false;

  // 4. ARIA attributes must match if present
  if (fingerprint.ariaLabel && element.getAttribute('aria-label') !== fingerprint.ariaLabel)
    return false;

  if (fingerprint.role && element.getAttribute('role') !== fingerprint.role)
    return false;

  // 5. For anchors, href must match
  if (fingerprint.href && fingerprint.tagName === 'A') {
    if (element.getAttribute('href') !== fingerprint.href) return false;
  }

  // 6. Form element name must match
  if (fingerprint.name && element.getAttribute('name') !== fingerprint.name)
    return false;

  return true;
}
```

### Matching Summary

| Field       | Matching Type           | Behavior                           |
| ----------- | ----------------------- | ---------------------------------- |
| `tagName`   | **Strict**              | Must match exactly (BUTTON ≠ A)    |
| `id`        | **Strong** (early exit) | If matches, skip all other checks  |
| `type`      | **Conditional**         | Only checked if fingerprint has it |
| `role`      | **Conditional**         | Only checked if fingerprint has it |
| `ariaLabel` | **Conditional**         | Only checked if fingerprint has it |
| `href`      | **Conditional**         | Only checked for anchors           |
| `name`      | **Conditional**         | Only checked if fingerprint has it |

---

## CSS Selector Generation

### How CSS Selector is Generated (During Indexing)

```typescript
generateSelector(element: Element): string {
  // Step 1: If element has unique ID, use it
  if (element.id) {
    if (document.querySelectorAll(`#${element.id}`).length === 1) {
      return `#${element.id}`;  // "#submit-btn"
    }
  }

  // Step 2: Build path from element to nearest ID or body
  const path = [];
  let current = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();  // "button"

    if (current.id) {
      selector += `#${current.id}`;  // "div#container"
      path.unshift(selector);
      break;  // ID is anchor point
    }

    // Add nth-of-type for uniqueness among siblings
    const siblings = Array.from(current.parentElement.children)
      .filter(el => el.tagName === current.tagName);

    if (siblings.length > 1) {
      const index = siblings.indexOf(current) + 1;
      selector += `:nth-of-type(${index})`;  // "button:nth-of-type(2)"
    }

    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(' > ');  // "div#app > form > button:nth-of-type(2)"
}
```

### Selector Usage

Selectors serve two purposes:

1. **Fallback lookup**: If the element reference is stale, try to find it via selector
2. **HTML snapshot**: Applied as `data-id` attributes for the agent

---

## Validation Flow

### `validateElementAtIndex(index)`

```typescript
validateElementAtIndex(index: number): ValidationResult {
  // 1. Get stored fingerprint
  const fingerprint = this.fingerprintMap.get(index);
  if (!fingerprint) {
    return { isValid: true }; // No fingerprint = assume OK
  }

  // 2. Get element from map
  const element = this.elementMap.get(index);

  // 3. Check if element still exists in DOM
  if (!element || !document.contains(element)) {
    return { isValid: false, mismatchReason: 'element_removed' };
  }

  // 4. Check if element matches fingerprint
  if (!this.matchesFingerprint(element, fingerprint)) {
    return { isValid: false, mismatchReason: 'element_changed' };
  }

  return { isValid: true };
}
```

### `getValidatedElement(index)` - Main Entry Point

```typescript
getValidatedElement(index: number): ValidatedElementResult {
  // 1. Validate element
  const validation = this.validateElementAtIndex(index);

  if (!validation.isValid) {
    const reason = validation.mismatchReason === 'element_removed'
      ? 'no longer exists' : 'has changed';
    return {
      element: null,
      validation,
      error: `DOM_CHANGED: Element at index ${index} ${reason}. Call get_html to get updated indices.`,
    };
  }

  // 2. Get element
  const element = this.elementMap.get(index);
  if (!element) {
    return { element: null, validation, error: `Element ${index} not found` };
  }

  // 3. Check interactability (visible, not hidden, not obscured)
  const interactError = this.checkInteractability(element, index);
  if (interactError) {
    return { element: null, validation, error: interactError };
  }

  return { element, validation };
}
```

---

## Interactability Checks

Before executing any action, the element is checked for interactability:

```typescript
checkInteractability(element: HTMLElement, index: number): string | null {
  // 1. In DOM?
  if (!document.body.contains(element)) {
    return `ELEMENT_NOT_INTERACTABLE: Element ${index} is not in the DOM`;
  }

  // 2. Visible?
  const style = window.getComputedStyle(element);
  if (style.display === 'none') return `ELEMENT_NOT_INTERACTABLE: Element ${index} has display:none`;
  if (style.visibility === 'hidden') return `ELEMENT_NOT_INTERACTABLE: Element ${index} has visibility:hidden`;
  if (parseFloat(style.opacity) === 0) return `ELEMENT_NOT_INTERACTABLE: Element ${index} has opacity:0`;

  // 3. Has dimensions?
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return `ELEMENT_NOT_INTERACTABLE: Element ${index} has zero dimensions`;
  }

  // 4. On screen?
  if (rect.bottom < 0 || rect.top > window.innerHeight ||
      rect.right < 0 || rect.left > window.innerWidth) {
    return `ELEMENT_NOT_INTERACTABLE: Element ${index} is off-screen`;
  }

  // 5. Not obscured?
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const topElement = document.elementFromPoint(centerX, centerY);

  if (topElement && topElement !== element && !element.contains(topElement)) {
    // Ignore Marketrix UI overlays
    const isMarketrixUI = topElement.closest('#marketrix-show-highlight') ||
                          topElement.closest('#marketrix-show-popup') ||
                          topElement.closest('[data-marketrix-widget]');
    if (!isMarketrixUI) {
      return `ELEMENT_OBSCURED: Element ${index} is covered by ${topElement.tagName}`;
    }
  }

  return null; // Element is interactable
}
```

---

## Error Handling for Agents

When DOM mismatch is detected:

```json
{
  "success": false,
  "error": "DOM_CHANGED: Element at index 5 no longer exists. Call get_html to get updated indices."
}
```

**Agent should**:

1. Call `get_html` to get fresh DOM snapshot with new indices
2. Re-identify target element in new indices
3. Retry the original action

---

## Validation Result Types

```typescript
interface ValidationResult {
  isValid: boolean;
  mismatchReason?: 'element_removed' | 'element_changed';
}

interface ElementLookupResult {
  element: HTMLElement | null;
  error?: string;
}

interface ValidatedElementResult extends ElementLookupResult {
  validation: ValidationResult;
}
```

---

## Files Involved

| File                          | Purpose                              |
| ----------------------------- | ------------------------------------ |
| `src/services/DomService.ts`  | Core fingerprint + validation logic  |
| `src/services/ToolService.ts` | Uses `getValidatedElement` for tools |
| `src/services/ChatService.ts` | Persists DOM state across page loads |

---

## Performance Considerations

### Computational Overhead

| Operation                  | When            | Cost             | Impact                  |
| -------------------------- | --------------- | ---------------- | ----------------------- |
| **Fingerprint generation** | During indexing | O(1) per element | ~1-2ms for 100 elements |
| **Fingerprint storage**    | During indexing | O(n) memory      | ~500 bytes per element  |
| **Validation**             | Each tool call  | O(1) lookup      | <1ms                    |
| **Interactability check**  | Each tool call  | O(1) DOM queries | ~1-5ms                  |

### Memory Overhead

```
Per indexed element:
- ElementFingerprint: ~200-500 bytes (depending on text content)
- Typical page (50 elements): ~25KB additional memory
- Large page (500 elements): ~250KB additional memory
```

---

## Browser Compatibility

- Uses standard DOM APIs (`document.contains`, `TreeWalker`, `querySelector`)
- No experimental features
- Works in all modern browsers (Chrome, Firefox, Safari, Edge)

---

## Testing with Debug Panel

Press `Ctrl+Shift+D` to open the debug panel, then:

1. **Index DOM Elements** - Creates fingerprints for all elements
2. **Test a tool** - Validates element before execution
3. **Check console** - See validation logs

```javascript
// In browser console:
devTools.indexDOM();
await devTools.testTool('click_element', { index: 5 });
// Will show DOM_CHANGED error if element has changed
```
