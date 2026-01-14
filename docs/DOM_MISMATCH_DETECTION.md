# DOM Index Mismatch Detection and Auto-Recovery

## Overview

This document describes the DOM mismatch detection and auto-recovery system
implemented in the Marketrix widget. The system ensures reliable execution of
agent commands even when the DOM changes between indexing and command execution.

## Problem Statement

The widget captures DOM elements and assigns sequential indices (0, 1, 2...)
which are sent to the AI agent. The agent responds with actions referencing
these indices (e.g., `click_element { index: 5 }`). However, due to the dynamic
nature of web applications, the DOM may change before the agent's response
arrives:

- New elements inserted (shifting indices)
- Elements removed
- SPA re-renders creating new DOM nodes
- Content updates changing element text
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
         │ 4. Check DOM position    │
         │ 5. Match fingerprint     │
         └─────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
     VALID                   MISMATCH
        │                       │
        ▼                       ▼
   Execute action        attemptRecovery()
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
         CSS Selector    Search Indexed    DOM Search
              │                │                │
              └────────────────┴────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
                 RECOVERED             NOT FOUND
                    │                     │
                    ▼                     ▼
            Execute on recovered    Return DOM_CHANGED
            element (log shift)     (agent must retry)
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
  textContent: string; // Truncated to 100 chars
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
    textContent: element.textContent?.trim().substring(0, 100) || null,
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

### What is `aria-label`?

`aria-label` is an HTML attribute that provides an accessible name for elements,
primarily used by screen readers:

```html
<!-- Icon-only button needs aria-label for accessibility -->
<button aria-label="Close dialog">
  <svg><!-- X icon --></svg>
</button>

<!-- Distinguishes similar buttons -->
<button aria-label="Edit profile picture">Edit</button>
<button aria-label="Edit username">Edit</button>
```

We include it in fingerprints because:

- It's a **strong identifier** (unique per action)
- It's **stable** (developers rarely change accessibility labels)
- It's **descriptive** (tells us what the element does)

---

## Fingerprint Matching (Partial Matching)

We use **partial matching** - not all fields need to match exactly.

### Matching Logic

```typescript
matchesFingerprint(element, fingerprint): boolean {
  // 1. STRICT: Tag must match exactly
  if (element.tagName !== fingerprint.tagName) return false;

  // 2. STRONG: ID match = immediately accept
  if (fingerprint.id && element.id === fingerprint.id) return true;

  // 3. CONDITIONAL: Only check if fingerprint has the field
  if (fingerprint.type && element.getAttribute('type') !== fingerprint.type)
    return false;
  if (fingerprint.ariaLabel && element.getAttribute('aria-label') !== fingerprint.ariaLabel)
    return false;
  if (fingerprint.role && element.getAttribute('role') !== fingerprint.role)
    return false;
  if (fingerprint.href && element.getAttribute('href') !== fingerprint.href)
    return false;

  // 4. PARTIAL: Text similarity (70% threshold)
  if (fingerprint.textContent) {
    const similarity = calculateSimilarity(fingerprint.textContent, element.textContent);
    if (similarity < 0.7) return false;
  }

  return true;
}
```

### Matching Types Summary

| Field         | Matching Type           | Behavior                           |
| ------------- | ----------------------- | ---------------------------------- |
| `tagName`     | **Strict**              | Must match exactly (BUTTON ≠ A)    |
| `id`          | **Strong** (early exit) | If matches, skip all other checks  |
| `type`        | **Conditional**         | Only checked if fingerprint has it |
| `role`        | **Conditional**         | Only checked if fingerprint has it |
| `ariaLabel`   | **Conditional**         | Only checked if fingerprint has it |
| `href`        | **Conditional**         | Only checked for anchors           |
| `textContent` | **Partial (70%)**       | Uses Jaccard similarity            |
| `selector`    | **Not checked**         | Only used for recovery             |

### Text Similarity Algorithm (Jaccard)

We use word-based Jaccard similarity with a 70% threshold:

```typescript
calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));

  const intersection = /* words in BOTH sets */;
  const union = /* words in EITHER set */;

  return intersection.size / union.size;
}
```

**Examples:**

| Original      | Current                | Calculation | Result      |
| ------------- | ---------------------- | ----------- | ----------- |
| "Buy Now"     | "Buy Now"              | 2/2 = 1.0   | 100% MATCH  |
| "Add to Cart" | "Add to Shopping Cart" | 3/4 = 0.75  | 75% MATCH   |
| "Submit"      | "Cancel"               | 0/2 = 0.0   | 0% NO MATCH |
| "Click Here"  | "Click Here!"          | 2/2 = 1.0   | 100% MATCH  |

---

## The 3 Recovery Algorithms

When validation fails (element changed/shifted), we try to recover using three
strategies in order:

### Recovery Flow Diagram

```
                    Element validation failed
                              │
                              ▼
              ┌───────────────────────────────┐
              │ Strategy 1: CSS Selector      │
              │ document.querySelector(sel)   │
              │ Cost: O(1) - very fast        │
              └───────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                 FOUND              NOT FOUND
                    │                   │
                    ▼                   ▼
            matchesFingerprint?    ┌───────────────────────────────┐
                    │              │ Strategy 2: Search Indexed    │
              ┌─────┴─────┐        │ Loop through elementMap       │
              │           │        │ Cost: O(n) - n indexed elems  │
             YES          NO       └───────────────────────────────┘
              │           │                     │
              ▼           │           ┌─────────┴─────────┐
           RECOVERED      │           │                   │
                          │        FOUND              NOT FOUND
                          │           │                   │
                          │           ▼                   ▼
                          │      RECOVERED     ┌───────────────────────────────┐
                          │                    │ Strategy 3: DOM Search        │
                          │                    │ querySelectorAll + loop       │
                          │                    │ Cost: O(m) - m DOM elements   │
                          │                    └───────────────────────────────┘
                          │                                │
                          │                      ┌─────────┴─────────┐
                          │                      │                   │
                          │                   FOUND              NOT FOUND
                          │                      │                   │
                          │                      ▼                   ▼
                          │                 RECOVERED          ELEMENT_REMOVED
                          │                 (needs reindex)    (DOM_CHANGED error)
                          │
                          └──► Try next strategy
```

---

### Strategy 1: CSS Selector Recovery

**Goal:** Find element using its stored CSS path

#### How CSS Selector is Generated (During Indexing)

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

#### Example Selector Generation

```html
<body>
  <div id="app">
    <form>
      <button>Cancel</button>
      <button>Submit</button>
      <!-- Target element -->
    </form>
  </div>
</body>
```

**Building the selector path:**

```
Step 1: button (2nd button sibling) → "button:nth-of-type(2)"
Step 2: form (only form child)      → "form"
Step 3: div#app (has ID, stop!)     → "div#app"

Final: "div#app > form > button:nth-of-type(2)"
```

#### How Recovery Uses Selector

```typescript
// Get stored selector from fingerprint
const selector = fingerprint.selector; // "div#app > form > button:nth-of-type(2)"

// Query DOM
const element = document.querySelector(selector);

if (element) {
  // Check if it's the SAME element (just content changed)
  if (originalElement === element && document.contains(element)) {
    return { mismatchReason: 'element_changed', recoveredElement: element };
  }

  // Check if different element matches fingerprint
  if (matchesFingerprint(element, fingerprint)) {
    return { recoveredElement: element };
  }
}

// Selector failed, try next strategy
```

#### When Selector Succeeds

- Element is at same DOM path (structure unchanged)
- SPA re-rendered component but kept same structure
- Content changed but position unchanged

#### When Selector Fails

```html
<!-- BEFORE indexing -->
<form>
  <button>Cancel</button>
  <button>Submit</button>
  <!-- Selector: button:nth-of-type(2) -->
</form>

<!-- AFTER DOM change (new button inserted) -->
<form>
  <button>Back</button>
  <!-- NEW -->
  <button>Cancel</button>
  <button>Submit</button>
  <!-- Now at nth-of-type(3)! -->
</form>

Selector "button:nth-of-type(2)" now returns "Cancel" - WRONG! → matchesFingerprint("Cancel", {textContent: "Submit"}) =
false → Move to Strategy 2
```

---

### Strategy 2: Search Indexed Elements

**Goal:** Search through our stored element references to find a match

#### How It Works

When we index the DOM, `elementMap` stores **direct references** to DOM nodes:

```typescript
// During indexing
elementMap.set(0 /* reference to actual DOM node */);
elementMap.set(1 /* reference to actual DOM node */);
elementMap.set(2 /* reference to actual DOM node */);
```

These references remain valid even if the element moves in the DOM (as long as
it's not removed).

#### The Algorithm

```typescript
for (const [idx, elem] of this.elementMap.entries()) {
  // Skip elements removed from DOM
  if (!document.contains(elem)) {
    continue;
  }

  // Check if this element matches our target fingerprint
  if (this.matchesFingerprint(elem, fingerprint)) {
    return {
      mismatchReason: 'index_shifted',
      recoveredElement: elem,
      recoveredIndex: idx,
    };
  }
}
```

#### Visual Example

```
After indexing, elementMap holds references:

elementMap = {
  0 → [Reference to Cancel button]
  1 → [Reference to Submit button]  ← We want this (fingerprint: "Submit")
  2 → [Reference to Help button]
}

DOM changes: buttons reordered, but references still valid!

Search process:
  idx=0: elem="Cancel" vs fingerprint="Submit" → NO MATCH
  idx=1: elem="Submit" vs fingerprint="Submit" → MATCH!
         document.contains? YES ✓
         → Return { recoveredIndex: 1, recoveredElement: Submit }
```

#### When Strategy 2 Succeeds

- Element shifted to different position but reference still valid
- Our `elementMap` contains the element we're looking for

#### When Strategy 2 Fails

```typescript
// Element was REMOVED from DOM
const elem = elementMap.get(1); // Reference exists
document.contains(elem); // false! Element detached

// Skip this element, continue searching
// If no match found → Move to Strategy 3
```

---

### Strategy 3: DOM-Wide Search

**Goal:** Last resort - search the ENTIRE DOM for a matching element

#### How It Works

```typescript
searchDomForMatch(fingerprint: ElementFingerprint): HTMLElement | null {
  // Step 1: Build query from fingerprint (narrow down candidates)
  let query = fingerprint.tagName.toLowerCase();  // "button"

  if (fingerprint.id) {
    query = `#${CSS.escape(fingerprint.id)}`;        // "#submit-btn"
  } else if (fingerprint.type) {
    query = `${query}[type="${fingerprint.type}"]`;  // "input[type='email']"
  }

  // Step 2: Get ALL matching elements in entire page
  const candidates = document.querySelectorAll(query);

  // Step 3: Check each candidate against fingerprint
  for (let i = 0; i < Math.min(candidates.length, 1000); i++) {
    const elem = candidates[i];

    if (elem instanceof HTMLElement && this.matchesFingerprint(elem, fingerprint)) {
      return elem;  // Found it!
    }
  }

  return null;  // Not found anywhere
}
```

#### Visual Example

```
Fingerprint: { tagName: "BUTTON", textContent: "Submit", type: "submit" }

Query: "button[type='submit']"

Searching entire DOM:
┌─────────────────────────────────────────────────────────────┐
│ <html>                                                      │
│   <body>                                                    │
│     <header>                                                │
│       <button type="button">Menu</button>   ← Skip (wrong) │
│     </header>                                               │
│     <main>                                                  │
│       <form id="login">                                     │
│         <button type="submit">Login</button> ← Check: NO   │
│       </form>                                               │
│       <form id="contact">                                   │
│         <button type="submit">Submit</button> ← Check: YES!│
│       </form>                                               │
│     </main>                                                 │
│   </body>                                                   │
│ </html>                                                     │
└─────────────────────────────────────────────────────────────┘

candidates = querySelectorAll("button[type='submit']")
           = [Login button, Submit button]

Loop:
  candidates[0]: text="Login" vs fingerprint="Submit" → NO
  candidates[1]: text="Submit" vs fingerprint="Submit" → YES! Return it
```

#### When Strategy 3 is Needed

- CSS selector path broken (DOM restructured)
- Element wasn't in our indexed map
- Element moved to completely different part of page

#### When Strategy 3 Fails

- Element truly doesn't exist in DOM anymore
- Element changed so much it can't be identified
- Returns `null` → `element_removed` error

#### Performance Safeguard

```typescript
// Limit to 1000 candidates to prevent hanging on huge pages
const maxCandidates = Math.min(candidates.length, 1000);

// Query optimization helps:
// BAD:  querySelectorAll("*")             → Millions of elements
// GOOD: querySelectorAll("button")        → ~50 elements
// BEST: querySelectorAll("#unique-id")    → 1 element
```

---

## Strategy Comparison

| Strategy              | Method                    | Speed          | Best For                        | Fails When               |
| --------------------- | ------------------------- | -------------- | ------------------------------- | ------------------------ |
| **1. CSS Selector**   | `querySelector(path)`     | O(1) Very Fast | Same structure, content changed | Siblings added/removed   |
| **2. Search Indexed** | Loop `elementMap`         | O(n) Medium    | Element shifted position        | Element removed from DOM |
| **3. DOM Search**     | `querySelectorAll` + loop | O(m) Slow      | Element anywhere in DOM         | Element truly gone       |

---

## Implementation Proof: All 3 Strategies Are Active

All 3 recovery strategies are implemented and used in production. Here's the
actual code structure:

### Code Location (DomService.ts)

```
Line 235: // Strategy 1: Try CSS selector
Line 295: // Strategy 2: Search all currently indexed elements for a match
Line 310: // Strategy 3: Search entire DOM for matching element (expensive, last resort)
```

### The Actual Flow in `attemptRecovery()`

```typescript
attemptRecovery(index, fingerprint) {

  // ✅ Strategy 1: CSS Selector (lines 235-292)
  const selector = fingerprint.selector;
  if (selector) {
    const element = document.querySelector(selector);
    if (element && matchesFingerprint(element, fingerprint)) {
      return { recoveredElement: element };  // Found! Stop here.
    }
  }

  // ✅ Strategy 2: Search Indexed (lines 295-308)
  for (const [idx, elem] of this.elementMap.entries()) {
    if (document.contains(elem) && matchesFingerprint(elem, fingerprint)) {
      return { recoveredElement: elem, recoveredIndex: idx };  // Found! Stop here.
    }
  }

  // ✅ Strategy 3: DOM Search (lines 310-319)
  const matchingElement = this.searchDomForMatch(fingerprint);
  if (matchingElement) {
    return { recoveredElement: matchingElement, requiresReindex: true };  // Found!
  }

  // All strategies failed
  return { mismatchReason: 'element_removed', requiresReindex: true };
}
```

### When Each Strategy is Triggered

| Scenario                         | Strategy 1     | Strategy 2     | Strategy 3     | Result                     |
| -------------------------------- | -------------- | -------------- | -------------- | -------------------------- |
| Element shifted, selector valid  | **USED** ✓     | Skipped        | Skipped        | Recovered                  |
| Element shifted, selector broken | Tried → failed | **USED** ✓     | Skipped        | Recovered                  |
| Element in DOM but not indexed   | Tried → failed | Tried → failed | **USED** ✓     | Recovered (reindex needed) |
| Element removed from DOM         | Tried → failed | Tried → failed | Tried → failed | `DOM_CHANGED` error        |

### Key Points

1. **Strategies run in order**: Fast to slow (O(1) → O(n) → O(m))
2. **Early exit on success**: Once a strategy finds the element, subsequent
   strategies are skipped
3. **All strategies active**: No strategy is disabled or conditional
4. **Graceful degradation**: If faster strategies fail, slower ones are tried
   before giving up

---

## Cases Handled

### 1. Index Shift (Insert/Remove)

**Scenario**: Elements inserted or removed, causing indices to shift.

| Action               | Detection                                         | Recovery                               |
| -------------------- | ------------------------------------------------- | -------------------------------------- |
| Insert before target | `getCurrentDomPosition()` returns different index | Element recovered at new position      |
| Remove before target | Position shifted                                  | Element recovered at new position      |
| Remove target itself | `document.contains()` returns false               | `DOM_CHANGED` error, requires re-index |

**Example**:

```
Before: [btn0] [btn1] [btn2] [btn3]
Insert:  [btn0] [NEW] [btn1] [btn2] [btn3]
                              ↑
                    Agent requests index 2
                    But btn2 is now at index 3
                    → Detected via position check
                    → Recovered, execute on btn2 at index 3
```

### 2. SPA Re-renders

**Scenario**: React/Vue/Angular re-renders component, creating new DOM nodes.

| Scenario            | Detection                   | Recovery                           |
| ------------------- | --------------------------- | ---------------------------------- |
| Component re-render | Element reference invalid   | CSS selector finds new node        |
| Route navigation    | Entire index stale          | `DOM_CHANGED`, full re-index       |
| List re-order       | Elements at wrong positions | Position check + fingerprint match |

### 3. Content Changes

**Scenario**: Element text or attributes change dynamically.

| Change Type       | Detection                        | Recovery                          |
| ----------------- | -------------------------------- | --------------------------------- |
| Minor text change | 70% Jaccard similarity threshold | Element accepted                  |
| Major text change | Fingerprint mismatch             | Same element reference → accepted |
| Attribute change  | Fingerprint mismatch             | CSS selector recovery             |

### 4. Element Removal

**Scenario**: Target element completely removed from DOM.

- `document.contains(element)` returns `false`
- All recovery strategies fail (element not in DOM)
- Returns `element_removed` with `requiresReindex: true`
- Agent receives `DOM_CHANGED` error and must call `get_html` again

### 5. Hidden/Conditional Elements

**Scenario**: Modals, dropdowns, accordions becoming visible.

- Elements not in original index (weren't interactable)
- Cannot recover (never indexed)
- Requires re-index to capture new elements

---

## Design: Before vs After

### Previous Implementation

```typescript
// Old: Direct element lookup, no validation
getElementByIndex(index: number): Element | null {
  return this.elementMap.get(index) || null;
}

// Tool execution
clickElement(index: number) {
  const element = domService.getElementByIndex(index);
  if (!element) {
    return { error: "Element not found" };
  }
  element.click(); // Could be WRONG element!
}
```

**Problems**:

- No detection of DOM changes
- `elementMap` holds stale references
- Could click wrong element silently
- No recovery mechanism

### New Implementation

```typescript
// New: Validated element lookup with recovery
getValidatedElement(index: number): {
  element: HTMLElement | null;
  validation: ValidationResult
} {
  const validation = this.validateElementAtIndex(index);

  if (validation.isValid) {
    return { element: this.getElementByIndex(index), validation };
  }

  if (validation.recoveredElement) {
    return { element: validation.recoveredElement, validation };
  }

  return { element: null, validation };
}

// Tool execution with validation
clickElement(index: number) {
  const { element, validation } = domService.getValidatedElement(index);

  if (!element) {
    if (validation.requiresReindex) {
      domService.indexInteractableElements();
      return {
        error: "DOM_CHANGED: Element no longer exists. Call get_html for updated indices."
      };
    }
    return { error: "Element not found" };
  }

  // Safe to execute - element validated or recovered
  element.click();
}
```

**Improvements**:

- Validates element before execution
- Detects position shifts via DOM traversal
- 3-tier recovery (selector → indexed search → DOM search)
- Clear error messages for agent retry
- Logging of all validation/recovery events

---

## Production Impact

### What Changes in Production

1. **All element-based tools now validate first**:
   - `click_element`
   - `type_text`
   - `send_keys`
   - `select_dropdown_option`
   - `get_dropdown_options`

2. **New error type**: `DOM_CHANGED`
   - Agent must handle this by calling `get_html` again
   - Prevents silent wrong-element execution

3. **Recovery logging**:
   - Console logs when elements are recovered
   - Useful for debugging dynamic page issues

### What Doesn't Change

- Indexing mechanism unchanged
- Element selection UI unchanged
- Agent communication protocol unchanged
- State persistence format (backwards compatible)

---

## Performance Cost Analysis

### Computational Overhead

| Operation                  | When             | Cost               | Impact                     |
| -------------------------- | ---------------- | ------------------ | -------------------------- |
| **Fingerprint generation** | During indexing  | O(1) per element   | ~1-2ms for 100 elements    |
| **Fingerprint storage**    | During indexing  | O(n) memory        | ~500 bytes per element     |
| **Position check**         | Each validation  | O(n) DOM traversal | ~5-15ms for 100 elements   |
| **Selector recovery**      | On mismatch only | O(1) querySelector | <1ms                       |
| **Indexed search**         | On mismatch only | O(n) loop          | ~1-5ms for 100 elements    |
| **DOM search**             | Last resort only | O(m) full scan     | ~10-30ms for 1000 elements |

### Memory Overhead

```
Per indexed element:
- ElementFingerprint: ~200-500 bytes (depending on text content)
- Typical page (50 elements): ~25KB additional memory
- Large page (500 elements): ~250KB additional memory
```

### When Overhead Occurs

| Scenario                      | Overhead                         |
| ----------------------------- | -------------------------------- |
| Initial indexing              | +10-20% (fingerprint generation) |
| Command execution (no change) | +5-15ms (position check)         |
| Command execution (shifted)   | +10-30ms (recovery)              |
| Command execution (removed)   | +20-50ms (all strategies fail)   |

### Optimization Notes

1. **Position check uses TreeWalker**: Same efficient DOM traversal as indexing
2. **Early exit on valid**: If position matches, skips fingerprint comparison
3. **Lazy recovery**: Only attempts recovery on mismatch
4. **Cached element references**: `elementMap` still provides O(1) lookup
5. **Query optimization**: Selectors narrowed by tag/type before searching

### Browser Compatibility

- Uses standard DOM APIs (`document.contains`, `TreeWalker`, `querySelector`)
- No experimental features
- Works in all modern browsers (Chrome, Firefox, Safari, Edge)

---

## Development Testing

### Debug Panel (Dev Only)

Access via `Ctrl+Shift+D` or inject via bookmarklet:

```javascript
javascript: (function () {
  var s = document.createElement('script');
  s.src = 'http://localhost:5174/debug.js';
  document.body.appendChild(s);
})();
```

### Mismatch Tab Features

1. **DOM Mutations**: Insert, Remove, Rerender, Change Text
2. **Special Cases**: Modal, iFrame, Shadow DOM
3. **Test Scenarios**: Pre-built test cases
4. **Validation Log**: Real-time validation events

### Test Scenarios

| Scenario             | What It Tests                      | Expected Result    |
| -------------------- | ---------------------------------- | ------------------ |
| Index Shift - Insert | Position detection after insertion | PASS - recovered   |
| Index Shift - Remove | Element removal detection          | PASS - DOM_CHANGED |
| Content Change       | Text similarity matching           | PASS - executed    |
| SPA Re-render        | New DOM node recovery              | PASS - recovered   |

---

## Files Modified/Created

| File                                  | Purpose                               |
| ------------------------------------- | ------------------------------------- |
| `src/services/DomService.ts`          | Core fingerprint + validation logic   |
| `src/services/ToolService.ts`         | Validated element lookup integration  |
| `src/services/ChatService.ts`         | Fingerprint persistence               |
| `src/services/DevTestService.ts`      | Testing simulation methods (dev only) |
| `src/components/debug/DebugPanel.tsx` | Mismatch testing UI (dev only)        |

---

## Error Handling for Agents

When DOM mismatch cannot be recovered:

```json
{
  "success": false,
  "error": "DOM_CHANGED: Element at index 5 no longer exists. DOM has been re-indexed. Please call get_html to get updated element indices."
}
```

**Agent should**:

1. Call `get_html` to get fresh DOM snapshot
2. Re-identify target element in new indices
3. Retry the original action

---

## Validation Result Reference

```typescript
interface ValidationResult {
  isValid: boolean;
  mismatchReason?: 'element_removed' | 'element_changed' | 'index_shifted';
  recoveredElement?: HTMLElement;
  recoveredIndex?: number;
  requiresReindex?: boolean;
}
```

| Field              | Description                          |
| ------------------ | ------------------------------------ |
| `isValid`          | Element passed all validation checks |
| `mismatchReason`   | Why validation failed                |
| `recoveredElement` | Element found via recovery           |
| `recoveredIndex`   | New index if element shifted         |
| `requiresReindex`  | Agent should call `get_html`         |

---

## Future Improvements

1. **Mutation Observer**: Proactively detect DOM changes
2. **Confidence scoring**: Return confidence level with recovered elements
3. **Batch validation**: Validate multiple indices in single traversal
4. **Shadow DOM support**: Extend indexing to shadow roots
5. **iFrame support**: Cross-document element tracking
