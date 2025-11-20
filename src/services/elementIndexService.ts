/**
 * Element Indexing Service
 * Manages indexing of interactable elements with sequence numbers (data-id attributes).
 * Indexing persists across tool calls until next get_html call or page navigation.
 */

import { isInteractable } from '../utils/htmlUtils';

// Module-level state
const _elementMap: Map<number, Element> = new Map();
const _elementToSequence: WeakMap<Element, number> = new WeakMap();
let _isIndexed: boolean = false;
let _indexingInProgress: boolean = false;
let _indexVersion: number = 0;

// Cache for validation results (element -> {isValid, timestamp})
// Cache expires after 100ms to handle temporary visibility changes
const _validationCache = new WeakMap<Element, { isValid: boolean; timestamp: number }>();
const CACHE_TTL = 100; // milliseconds

/**
 * Index all interactable elements in the live DOM.
 * ALWAYS clears previous index first (fresh start on each call).
 * @returns Array of [sequenceNumber, liveElement] pairs in document order
 */
export function indexInteractableElements(): Array<[number, Element]> {
  // Prevent concurrent indexing - skip if already in progress (no busy-wait)
  if (_indexingInProgress) {
    console.warn('[ElementIndex] Indexing already in progress, skipping concurrent call');
    return [];
  }

  try {
    _indexingInProgress = true;

    // ALWAYS clear previous index first (fresh start)
    _elementMap.clear();
    _isIndexed = false;
    _indexVersion++;

    const indexedElements: Array<[number, Element]> = [];
    let sequenceNumber = 0;
    let buttonsFound = 0;
    let buttonsIndexed = 0;

    // Traverse LIVE DOM using TreeWalker in document order
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node: Node) => {
        // Skip iframe content (separate documents)
        if (node instanceof HTMLIFrameElement) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    // Helper function to traverse shadow DOM recursively
    const traverseShadowRoot = (shadowRoot: ShadowRoot, depth = 0): void => {
      // Prevent infinite recursion (max depth 10)
      if (depth > 10) {
        console.warn('[ElementIndex] Shadow DOM traversal depth limit reached');
        return;
      }

      try {
        // Check if shadow root is accessible (not closed)
        if (!shadowRoot?.host) {
          return;
        }

        const shadowWalker = document.createTreeWalker(shadowRoot, NodeFilter.SHOW_ELEMENT, null);
        let shadowNode: Element | null = shadowWalker.nextNode() as Element | null;
        while (shadowNode) {
          try {
            if (isInteractable(shadowNode)) {
              _elementMap.set(sequenceNumber, shadowNode);
              _elementToSequence.set(shadowNode, sequenceNumber);
              indexedElements.push([sequenceNumber, shadowNode]);
              sequenceNumber++;
            }

            // Check if this shadow node is itself a shadow host (nested shadow DOM)
            // Retry logic: sometimes shadowRoot is created dynamically
            if (shadowNode.shadowRoot) {
              traverseShadowRoot(shadowNode.shadowRoot, depth + 1);
            } else {
              // Check if shadow root might be created later (for dynamic shadow DOMs)
              // This is a best-effort approach - we can't wait for async creation
            }
          } catch (error) {
            // Continue on individual shadow node errors
            console.warn('[ElementIndex] Error processing shadow node:', error);
          }

          shadowNode = shadowWalker.nextNode() as Element | null;
        }
      } catch (error) {
        // Handle closed shadow DOMs or inaccessible shadow roots
        // Closed shadow DOMs throw when accessed, so we silently skip them
        if (error instanceof Error && error.message.includes('closed')) {
          // Closed shadow DOM - expected, skip silently
          return;
        }
        console.warn('[ElementIndex] Error traversing shadow root:', error);
      }
    };

    let node: Element | null = walker.nextNode() as Element | null;
    while (node) {
      try {
        // Track button statistics
        const isButton = node.tagName.toLowerCase() === 'button';
        if (isButton) {
          buttonsFound++;
        }

        // Check if element is interactable on LIVE DOM
        if (isInteractable(node)) {
          // Assign sequence number and store in both maps
          _elementMap.set(sequenceNumber, node);
          _elementToSequence.set(node, sequenceNumber);
          indexedElements.push([sequenceNumber, node]);
          if (isButton) {
            buttonsIndexed++;
          }
          sequenceNumber++;
        }

        // Handle shadow DOM: check if this node is a shadow host
        // Try to access shadowRoot - it may throw for closed shadow DOMs
        try {
          if (node.shadowRoot) {
            traverseShadowRoot(node.shadowRoot, 0);
          }
        } catch (error) {
          // Closed shadow DOM - skip silently
          if (error instanceof Error && error.message.includes('closed')) {
            // Expected for closed shadow DOMs
          } else {
            console.warn('[ElementIndex] Error accessing shadow root:', error);
          }
        }
      } catch (error) {
        // Continue on individual element errors
        console.warn('[ElementIndex] Error processing element:', error);
      }

      node = walker.nextNode() as Element | null;
    }

    _isIndexed = true;
    console.log(
      `[ElementIndex] Indexed ${indexedElements.length} interactable elements (${buttonsIndexed}/${buttonsFound} buttons indexed)`
    );
    if (buttonsFound > 0 && buttonsIndexed < buttonsFound) {
      console.warn(
        `[ElementIndex] ${buttonsFound - buttonsIndexed} buttons were found but not indexed (may have failed interactability checks)`
      );
    }
    return indexedElements;
  } catch (error) {
    console.error('[ElementIndex] Error during indexing:', error);
    _isIndexed = false;
    return [];
  } finally {
    _indexingInProgress = false;
  }
}

/**
 * Get an element by its data-id sequence number.
 * Validates that element is still in DOM and still interactable.
 * Uses caching to optimize frequent lookups.
 * @param dataId The sequence number (data-id value)
 * @param skipValidation If true, skip interactability check (faster but less safe)
 * @returns The element if found and valid, null otherwise
 */
export function getElementByDataId(dataId: number, skipValidation = false): Element | null {
  // Check if indexing has been done
  if (!_isIndexed) {
    return null;
  }

  // Look up in map
  const element = _elementMap.get(dataId);
  if (!element) {
    return null;
  }

  // Fast path: skip validation if requested (for performance-critical code)
  if (skipValidation) {
    // Still check if element is in DOM (quick check)
    if (!document.contains(element)) {
      _elementMap.delete(dataId);
      return null;
    }
    return element;
  }

  // Check cache first
  const cached = _validationCache.get(element);
  const now = Date.now();
  if (cached && now - cached.timestamp < CACHE_TTL) {
    if (!cached.isValid) {
      return null;
    }
    // Cache hit - still verify element is in DOM (quick check)
    if (!document.contains(element)) {
      _elementMap.delete(dataId);
      _validationCache.delete(element);
      return null;
    }
    return element;
  }

  // Validate: element still in DOM
  if (!document.contains(element)) {
    // Element was removed, remove from map and cache
    _elementMap.delete(dataId);
    _validationCache.delete(element);
    return null;
  }

  // Validate: element still interactable (expensive check)
  const isValid = isInteractable(element);
  _validationCache.set(element, { isValid, timestamp: now });

  if (!isValid) {
    // Element is no longer interactable, but keep in map
    // (might become interactable again, or will be cleared on next get_html)
    return null;
  }

  return element;
}

/**
 * Clear the index (called on get_html or page navigation).
 */
export function clearIndex(): void {
  _elementMap.clear();
  _isIndexed = false;
  _indexVersion++;
  // Note: WeakMap entries are automatically garbage collected
  // No need to manually clear _elementToSequence or _validationCache
  console.log('[ElementIndex] Index cleared');
}

/**
 * Check if the current page is indexed.
 * @returns True if indexed, false otherwise
 */
export function isIndexed(): boolean {
  return _isIndexed;
}

/**
 * Get the number of indexed elements.
 * @returns The count of indexed elements
 */
export function getIndexedCount(): number {
  return _elementMap.size;
}

/**
 * Get the current index version (for debugging/validation).
 * @returns The current index version number
 */
export function getIndexVersion(): number {
  return _indexVersion;
}

// Navigation detection state
let _navigationDetectionInitialized = false;
let _originalPushState: typeof window.history.pushState | null = null;
let _originalReplaceState: typeof window.history.replaceState | null = null;
let _popstateHandler: (() => void) | null = null;
let _beforeunloadHandler: (() => void) | null = null;
let _mutationObserver: MutationObserver | null = null;

/**
 * Initialize navigation detection to clear index on page changes.
 * Should be called once when the service is first used.
 * Safe to call multiple times - will only initialize once.
 */
export function initializeNavigationDetection(): void {
  if (_navigationDetectionInitialized) {
    return; // Already initialized
  }

  if (typeof window === 'undefined') {
    return; // Not in browser environment
  }

  try {
    // Store original history methods for potential restoration
    _originalPushState = window.history.pushState;
    _originalReplaceState = window.history.replaceState;

    // Override pushState
    window.history.pushState = function (
      ...args: Parameters<typeof window.history.pushState>
    ): void {
      if (_originalPushState) {
        _originalPushState.apply(window.history, args);
      }
      clearIndex();
    };

    // Override replaceState
    window.history.replaceState = function (
      ...args: Parameters<typeof window.history.replaceState>
    ): void {
      if (_originalReplaceState) {
        _originalReplaceState.apply(window.history, args);
      }
      clearIndex();
    };

    // Listen to popstate event (back/forward navigation)
    _popstateHandler = () => {
      clearIndex();
    };
    window.addEventListener('popstate', _popstateHandler);

    // Clear on page unload
    _beforeunloadHandler = () => {
      clearIndex();
    };
    window.addEventListener('beforeunload', _beforeunloadHandler);

    // Use MutationObserver to detect major DOM changes (SPA route changes)
    // This catches framework-specific navigation that doesn't use History API
    let mutationDebounceTimer: number | null = null;
    _mutationObserver = new MutationObserver((mutations) => {
      let shouldClear = false;
      let totalAddedNodes = 0;

      for (const mutation of mutations) {
        // Detect significant structural changes
        if (mutation.type === 'childList') {
          totalAddedNodes += mutation.addedNodes.length;

          // Large number of nodes added - likely route change or major DOM update
          if (mutation.addedNodes.length > 10) {
            shouldClear = true;
            break;
          }

          // Check if a large subtree was replaced
          if (mutation.removedNodes.length > 10 && mutation.addedNodes.length > 10) {
            shouldClear = true;
            break;
          }
        }

        // Detect changes to document title (common in SPAs)
        if (mutation.target === document.head || mutation.target === document.body) {
          const target = mutation.target as Element;
          if (target.querySelector('title')) {
            shouldClear = true;
            break;
          }
        }

        // Detect if main content area changed significantly
        if (mutation.target instanceof Element) {
          const target = mutation.target as Element;
          // Check for common main content selectors
          if (
            target.id === 'app' ||
            target.id === 'root' ||
            target.id === 'main' ||
            target.classList.contains('app') ||
            target.classList.contains('main-content')
          ) {
            if (mutation.addedNodes.length > 5) {
              shouldClear = true;
              break;
            }
          }
        }
      }

      // Also check total added nodes across all mutations
      if (totalAddedNodes > 20) {
        shouldClear = true;
      }

      // Debounce clearing to avoid clearing too frequently
      if (shouldClear) {
        if (mutationDebounceTimer) {
          clearTimeout(mutationDebounceTimer);
        }
        mutationDebounceTimer = window.setTimeout(() => {
          clearIndex();
          mutationDebounceTimer = null;
        }, 100); // 100ms debounce
      }
    });

    // Observe document body for major changes
    if (document.body) {
      _mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    _navigationDetectionInitialized = true;
    console.log('[ElementIndex] Navigation detection initialized');
  } catch (error) {
    console.error('[ElementIndex] Error initializing navigation detection:', error);
  }
}

/**
 * Restore original navigation methods (for testing or cleanup).
 * Not typically needed in production.
 */
export function restoreNavigationDetection(): void {
  if (!_navigationDetectionInitialized) {
    return;
  }

  try {
    if (_originalPushState) {
      window.history.pushState = _originalPushState;
    }
    if (_originalReplaceState) {
      window.history.replaceState = _originalReplaceState;
    }
    if (_popstateHandler) {
      window.removeEventListener('popstate', _popstateHandler);
    }
    if (_beforeunloadHandler) {
      window.removeEventListener('beforeunload', _beforeunloadHandler);
    }
    if (_mutationObserver) {
      _mutationObserver.disconnect();
      _mutationObserver = null;
    }

    _navigationDetectionInitialized = false;
    _originalPushState = null;
    _originalReplaceState = null;
    _popstateHandler = null;
    _beforeunloadHandler = null;
  } catch (error) {
    console.error('[ElementIndex] Error restoring navigation detection:', error);
  }
}

// Initialize navigation detection when module loads
if (typeof window !== 'undefined') {
  initializeNavigationDetection();
}
