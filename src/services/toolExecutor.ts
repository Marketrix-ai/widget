/**
 * Tool Executor Service
 * Executes browser tools on the webpage DOM based on MCP tool calls.
 * Tool names must match exactly with MCP tool definitions in agent/mcp_server.py
 */

import {
  getElementByIndex,
  getFileInputByIndex,
  getSelectElementByIndex,
} from '../utils/elementFinder';
import { clearIndex, indexInteractableElements } from './elementIndexService';
import { startScreenShare } from './screenShareService';
import { cleanup, showToolAction } from './showModeService';

export interface ToolExecutionResult {
  success: boolean;
  result: string;
  error?: string;
}

/**
 * Execute a browser tool by name with given arguments.
 * @param toolName The name of the tool (must match MCP tool name)
 * @param arguments_ The tool arguments (without chat_id)
 * @param mode Execution mode - 'show' or 'do'
 * @param explanation Optional explanation for show mode
 * @returns Promise resolving to execution result
 */

export async function executeTool(
  toolName: string,
  arguments_: Record<string, unknown>,
  mode: string = 'do',
  explanation: string = ''
): Promise<ToolExecutionResult> {
  try {
    console.log(`[ToolExecutor] Executing tool: ${toolName} (mode: ${mode})`, arguments_);

    // For show mode, check if tool needs element highlighting
    const needsHighlighting = [
      'click_element',
      'type_text',
      'select_dropdown_option',
      'send_keys',
      'upload_file',
    ].includes(toolName);
    const isClickAction = toolName === 'click_element';

    if (mode === 'show' && needsHighlighting) {
      // Get element for highlighting
      const index = arguments_.index as number | undefined;
      if (index !== undefined) {
        const element = getElementByIndex(index);
        if (element) {
          // Show overlay and wait for user action
          const userConfirmed = await showToolAction({
            element,
            explanation: explanation || `Execute ${toolName}`,
            toolName,
            toolParams: arguments_,
            isClickAction,
          });

          if (!userConfirmed) {
            return {
              success: false,
              result: '',
              error: 'User cancelled action',
            };
          }

          // For keyboard actions, user has done the action manually - return success
          // For click actions, the user's click already happened, but we still need to
          // execute it programmatically to ensure it's registered properly
          if (!isClickAction) {
            return {
              success: true,
              result: 'User completed the action',
            };
          }
          // For click actions, continue to execute the click below
          // The user's click may have already happened, but we'll trigger it again
          // programmatically to ensure it's properly registered
        }
      }
    }

    // Execute the tool
    switch (toolName) {
      case 'navigate':
        return executeNavigate(arguments_);
      case 'search':
        return executeSearch(arguments_);
      case 'click_element':
        return await executeClickElement(arguments_);
      case 'type_text':
        return executeTypeText(arguments_);
      case 'scroll':
        return executeScroll(arguments_);
      case 'scroll_to_text':
        return executeScrollToText(arguments_);
      case 'extract':
        return executeExtract(arguments_);
      case 'go_back':
        return executeGoBack(arguments_);
      case 'wait':
        return executeWait(arguments_);
      case 'select_dropdown_option':
        return executeSelectDropdownOption(arguments_);
      case 'get_dropdown_options':
        return executeGetDropdownOptions(arguments_);
      case 'send_keys':
        return executeSendKeys(arguments_);
      case 'upload_file':
        return executeUploadFile(arguments_);
      case 'close_tab':
        return executeCloseTab(arguments_);
      case 'switch_tab':
        return executeSwitchTab(arguments_);
      case 'done':
        return executeDone(arguments_);
      case 'get_html':
        return executeGetHtml(arguments_);
      case 'get_screenshot':
        return await executeGetScreenshot(arguments_);
      default:
        return {
          success: false,
          result: '',
          error: `Unknown tool: ${toolName}`,
        };
    }
  } catch (error) {
    console.error(`[ToolExecutor] Error executing tool ${toolName}:`, error);
    cleanup(); // Clean up any show mode UI on error
    return {
      success: false,
      result: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Navigate to a URL
 */
function executeNavigate(args: Record<string, unknown>): ToolExecutionResult {
  const url = args.url as string | undefined;
  const newTab = (args.new_tab as boolean) ?? false;

  if (!url) {
    return {
      success: false,
      result: '',
      error: 'URL is required',
    };
  }

  try {
    if (newTab) {
      window.open(url, '_blank');
      return {
        success: true,
        result: `Opened ${url} in new tab`,
      };
    } else {
      window.location.href = url;
      return {
        success: true,
        result: `Navigating to ${url}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      result: '',
      error: `Failed to navigate: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Perform a web search
 */
function executeSearch(args: Record<string, unknown>): ToolExecutionResult {
  const query = args.query as string | undefined;
  const engine = (args.engine as string) ?? 'duckduckgo';

  if (!query) {
    return {
      success: false,
      result: '',
      error: 'Query is required',
    };
  }

  try {
    let searchUrl: string;
    const encodedQuery = encodeURIComponent(query);

    switch (engine.toLowerCase()) {
      case 'google':
        searchUrl = `https://www.google.com/search?q=${encodedQuery}`;
        break;
      case 'bing':
        searchUrl = `https://www.bing.com/search?q=${encodedQuery}`;
        break;
      case 'duckduckgo':
      default:
        searchUrl = `https://duckduckgo.com/?q=${encodedQuery}`;
        break;
    }

    window.location.href = searchUrl;
    return {
      success: true,
      result: `Searching for "${query}" on ${engine}`,
    };
  } catch (error) {
    return {
      success: false,
      result: '',
      error: `Failed to search: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Click on an element by index
 */
async function executeClickElement(args: Record<string, unknown>): Promise<ToolExecutionResult> {
  const index = args.index as number | undefined;

  if (index === undefined) {
    return {
      success: false,
      result: '',
      error: 'Index is required',
    };
  }

  const element = getElementByIndex(index);
  if (!element) {
    return {
      success: false,
      result: '',
      error: `Element at index ${index} not found`,
    };
  }

  try {
    // Scroll element into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Wait a bit for scroll to complete, then click
    // Use a promise to ensure click completes before returning
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        element.click();
        resolve();
      }, 100);
    });

    return {
      success: true,
      result: `Clicked element at index ${index}`,
    };
  } catch (error) {
    return {
      success: false,
      result: '',
      error: `Failed to click element: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Type text into an input element
 */
function executeTypeText(args: Record<string, unknown>): ToolExecutionResult {
  const index = args.index as number | undefined;
  const text = args.text as string | undefined;

  if (index === undefined) {
    return {
      success: false,
      result: '',
      error: 'Index is required',
    };
  }

  if (text === undefined) {
    return {
      success: false,
      result: '',
      error: 'Text is required',
    };
  }

  const element = getElementByIndex(index);
  if (!element) {
    return {
      success: false,
      result: '',
      error: `Element at index ${index} not found`,
    };
  }

  try {
    // Check if it's an input or textarea
    if (
      element.tagName === 'INPUT' ||
      element.tagName === 'TEXTAREA' ||
      element.getAttribute('contenteditable') === 'true'
    ) {
      // Focus the element
      element.focus();

      // Clear existing value
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        (element as HTMLInputElement | HTMLTextAreaElement).value = '';
      } else {
        element.textContent = '';
      }

      // Set the new value
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        (element as HTMLInputElement | HTMLTextAreaElement).value = text;
        // Trigger input event
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        element.textContent = text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }

      return {
        success: true,
        result: `Typed text into element at index ${index}`,
      };
    } else {
      return {
        success: false,
        result: '',
        error: `Element at index ${index} is not an input element`,
      };
    }
  } catch (error) {
    return {
      success: false,
      result: '',
      error: `Failed to type text: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Scroll the page in a direction
 */
function executeScroll(args: Record<string, unknown>): ToolExecutionResult {
  const direction = args.direction as string | undefined;

  if (!direction) {
    return {
      success: false,
      result: '',
      error: 'Direction is required (up, down, left, right)',
    };
  }

  try {
    const scrollAmount = window.innerHeight * 0.8; // Scroll 80% of viewport

    switch (direction.toLowerCase()) {
      case 'down':
        window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
        return {
          success: true,
          result: 'Scrolled down',
        };
      case 'up':
        window.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
        return {
          success: true,
          result: 'Scrolled up',
        };
      case 'right':
        window.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        return {
          success: true,
          result: 'Scrolled right',
        };
      case 'left':
        window.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        return {
          success: true,
          result: 'Scrolled left',
        };
      default:
        return {
          success: false,
          result: '',
          error: `Invalid direction: ${direction}. Must be up, down, left, or right`,
        };
    }
  } catch (error) {
    return {
      success: false,
      result: '',
      error: `Failed to scroll: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Scroll to find text on the page
 */
function executeScrollToText(args: Record<string, unknown>): ToolExecutionResult {
  const text = args.text as string | undefined;

  if (!text) {
    return {
      success: false,
      result: '',
      error: 'Text is required',
    };
  }

  try {
    // Try to find the text using various methods
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);

    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.textContent?.includes(text)) {
        const element = node.parentElement;
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return {
            success: true,
            result: `Scrolled to text: "${text}"`,
          };
        }
      }
    }

    // If not found, try using XPath
    const xpath = `//text()[contains(., '${text}')]`;
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    const textNode = result.singleNodeValue;
    if (textNode?.parentElement) {
      textNode.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return {
        success: true,
        result: `Scrolled to text: "${text}"`,
      };
    }

    return {
      success: false,
      result: '',
      error: `Text "${text}" not found on page`,
    };
  } catch (error) {
    return {
      success: false,
      result: '',
      error: `Failed to scroll to text: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Extract structured data from the current page
 */
function executeExtract(_args: Record<string, unknown>): ToolExecutionResult {
  try {
    // Extract main content
    const title = document.title;
    const url = window.location.href;
    const bodyText = document.body.innerText || document.body.textContent || '';

    // Extract links
    const links: Array<{ text: string; href: string }> = [];
    const linkElements = document.querySelectorAll('a[href]');
    linkElements.forEach((link) => {
      const href = link.getAttribute('href');
      if (href) {
        links.push({
          text: link.textContent?.trim() || '',
          href,
        });
      }
    });

    // Extract images
    const images: Array<{ src: string; alt: string }> = [];
    const imgElements = document.querySelectorAll('img[src]');
    imgElements.forEach((img) => {
      const src = img.getAttribute('src');
      if (src) {
        images.push({
          src,
          alt: img.getAttribute('alt') || '',
        });
      }
    });

    const result = {
      title,
      url,
      text: bodyText.substring(0, 10000), // Limit text length
      links: links.slice(0, 100), // Limit links
      images: images.slice(0, 50), // Limit images
    };

    return {
      success: true,
      result: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      success: false,
      result: '',
      error: `Failed to extract: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Navigate back in browser history
 */
function executeGoBack(_args: Record<string, unknown>): ToolExecutionResult {
  try {
    if (window.history.length > 1) {
      window.history.back();
      return {
        success: true,
        result: 'Navigated back',
      };
    } else {
      return {
        success: false,
        result: '',
        error: 'No history to go back to',
      };
    }
  } catch (error) {
    return {
      success: false,
      result: '',
      error: `Failed to go back: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Wait for a specified number of seconds
 */
async function executeWait(args: Record<string, unknown>): Promise<ToolExecutionResult> {
  const seconds = args.seconds as number | undefined;

  if (seconds === undefined) {
    return {
      success: false,
      result: '',
      error: 'Seconds is required',
    };
  }

  if (seconds < 0 || seconds > 30) {
    return {
      success: false,
      result: '',
      error: 'Seconds must be between 0 and 30',
    };
  }

  try {
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    return {
      success: true,
      result: `Waited ${seconds} seconds`,
    };
  } catch (error) {
    return {
      success: false,
      result: '',
      error: `Failed to wait: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Select an option from a dropdown element
 */
function executeSelectDropdownOption(args: Record<string, unknown>): ToolExecutionResult {
  const index = args.index as number | undefined;
  const option = args.option as string | undefined;

  if (index === undefined) {
    return {
      success: false,
      result: '',
      error: 'Index is required',
    };
  }

  if (!option) {
    return {
      success: false,
      result: '',
      error: 'Option is required',
    };
  }

  const selectElement = getSelectElementByIndex(index);
  if (!selectElement) {
    return {
      success: false,
      result: '',
      error: `Select element at index ${index} not found`,
    };
  }

  try {
    // Try to find option by value first
    let optionElement: HTMLOptionElement | null =
      Array.from(selectElement.options).find(
        (opt) => opt.value === option || opt.text === option
      ) || null;

    if (!optionElement) {
      // Try case-insensitive match
      optionElement =
        Array.from(selectElement.options).find(
          (opt) =>
            opt.value.toLowerCase() === option.toLowerCase() ||
            opt.text.toLowerCase() === option.toLowerCase()
        ) || null;
    }

    if (!optionElement) {
      return {
        success: false,
        result: '',
        error: `Option "${option}" not found in dropdown`,
      };
    }

    selectElement.value = optionElement.value;
    selectElement.dispatchEvent(new Event('change', { bubbles: true }));

    return {
      success: true,
      result: `Selected option "${option}" in dropdown at index ${index}`,
    };
  } catch (error) {
    return {
      success: false,
      result: '',
      error: `Failed to select dropdown option: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Get all available options from a dropdown element
 */
function executeGetDropdownOptions(args: Record<string, unknown>): ToolExecutionResult {
  const index = args.index as number | undefined;

  if (index === undefined) {
    return {
      success: false,
      result: '',
      error: 'Index is required',
    };
  }

  const selectElement = getSelectElementByIndex(index);
  if (!selectElement) {
    return {
      success: false,
      result: '',
      error: `Select element at index ${index} not found`,
    };
  }

  try {
    const options = Array.from(selectElement.options).map((opt) => ({
      value: opt.value,
      text: opt.text,
      selected: opt.selected,
    }));

    return {
      success: true,
      result: JSON.stringify(options, null, 2),
    };
  } catch (error) {
    return {
      success: false,
      result: '',
      error: `Failed to get dropdown options: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Send keyboard keys to an element
 */
function executeSendKeys(args: Record<string, unknown>): ToolExecutionResult {
  const index = args.index as number | undefined;
  const keys = args.keys as string | undefined;

  if (index === undefined) {
    return {
      success: false,
      result: '',
      error: 'Index is required',
    };
  }

  if (!keys) {
    return {
      success: false,
      result: '',
      error: 'Keys is required',
    };
  }

  const element = getElementByIndex(index);
  if (!element) {
    return {
      success: false,
      result: '',
      error: `Element at index ${index} not found`,
    };
  }

  try {
    element.focus();

    // Map common key names to key codes
    const keyMap: Record<string, string> = {
      Enter: 'Enter',
      Tab: 'Tab',
      Escape: 'Escape',
      Backspace: 'Backspace',
      Delete: 'Delete',
      ArrowUp: 'ArrowUp',
      ArrowDown: 'ArrowDown',
      ArrowLeft: 'ArrowLeft',
      ArrowRight: 'ArrowRight',
    };

    const key = keyMap[keys] || keys;

    // Create and dispatch keyboard event
    const event = new KeyboardEvent('keydown', {
      key,
      code: key,
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(event);

    const eventUp = new KeyboardEvent('keyup', {
      key,
      code: key,
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(eventUp);

    return {
      success: true,
      result: `Sent keys "${keys}" to element at index ${index}`,
    };
  } catch (error) {
    return {
      success: false,
      result: '',
      error: `Failed to send keys: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Upload a file to a file input element
 */
function executeUploadFile(args: Record<string, unknown>): ToolExecutionResult {
  const index = args.index as number | undefined;
  const path = args.path as string | undefined;

  if (index === undefined) {
    return {
      success: false,
      result: '',
      error: 'Index is required',
    };
  }

  if (!path) {
    return {
      success: false,
      result: '',
      error: 'Path is required',
    };
  }

  const fileInput = getFileInputByIndex(index);
  if (!fileInput) {
    return {
      success: false,
      result: '',
      error: `File input at index ${index} not found`,
    };
  }

  // Note: Browser security restrictions prevent programmatic file uploads
  // from local file paths. This would typically require user interaction
  // or a file object created from a blob/URL.
  // For now, we'll return an error explaining this limitation.
  return {
    success: false,
    result: '',
    error:
      'File upload from path is not supported due to browser security restrictions. File uploads require user interaction or a File/Blob object.',
  };
}

/**
 * Close the current browser tab
 */
function executeCloseTab(_args: Record<string, unknown>): ToolExecutionResult {
  try {
    // Browser security may prevent closing tabs that weren't opened by script
    window.close();
    return {
      success: true,
      result: 'Attempted to close tab (may be blocked by browser)',
    };
  } catch (error) {
    return {
      success: false,
      result: '',
      error: `Failed to close tab: ${error instanceof Error ? error.message : String(error)}. Note: Browsers may prevent closing tabs that weren't opened by script.`,
    };
  }
}

/**
 * Switch to a different browser tab
 */
function executeSwitchTab(args: Record<string, unknown>): ToolExecutionResult {
  const tabIndex = args.tab_index as number | undefined;

  if (tabIndex === undefined) {
    return {
      success: false,
      result: '',
      error: 'tab_index is required',
    };
  }

  // Browser security prevents switching tabs programmatically
  // This would require browser extension APIs
  return {
    success: false,
    result: '',
    error:
      'Tab switching is not supported due to browser security restrictions. This requires browser extension APIs.',
  };
}

/**
 * Mark the task as complete
 */
function executeDone(args: Record<string, unknown>): ToolExecutionResult {
  const success = args.success as boolean | undefined;
  const message = (args.message as string) || '';

  if (success === undefined) {
    return {
      success: false,
      result: '',
      error: 'success is required',
    };
  }

  return {
    success: true,
    result: success
      ? `Task completed successfully. ${message}`.trim()
      : `Task completed with failure. ${message}`.trim(),
  };
}

/**
 * Clean up HTML by removing unnecessary elements and attributes.
 * Based on Python HTMLSerializer logic.
 * @param root The root element to clean up
 */
function cleanupHtml(root: Element): void {
  try {
    // Elements to skip entirely
    const skipElements = new Set(['style', 'script', 'head', 'meta', 'link', 'title']);

    // Collect nodes to remove (can't remove while traversing)
    const nodesToRemove: Node[] = [];
    const attributesToRemove: Array<{ element: Element; attr: string }> = [];

    // Use the root's ownerDocument for TreeWalker (clone may be in different document context)
    const doc = root.ownerDocument || document;

    // Traverse and mark elements/attributes for removal
    const walker = doc.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT,
      null
    );

    let node: Node | null = walker.nextNode();
    while (node) {
      if (node.nodeType === Node.COMMENT_NODE) {
        // Remove comments
        nodesToRemove.push(node);
        node = walker.nextNode();
        continue;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        const tagName = element.tagName.toLowerCase();

        // Remove unwanted elements (but preserve noscript content for accessibility)
        if (skipElements.has(tagName)) {
          // Preserve noscript content - it's important for accessibility
          if (tagName === 'noscript') {
            node = walker.nextNode();
            continue;
          }
          nodesToRemove.push(element);
          node = walker.nextNode();
          continue;
        }

        // Remove code elements with display:none (often JSON state for SPAs)
        if (tagName === 'code') {
          const style = element.getAttribute('style') || '';
          const normalizedStyle = style.replace(/\s/g, '');
          if (normalizedStyle.includes('display:none')) {
            nodesToRemove.push(element);
            node = walker.nextNode();
            continue;
          }

          // Also check for common JSON data patterns in IDs
          const id = element.getAttribute('id') || '';
          if (id.includes('bpr-guid') || id.includes('data') || id.includes('state')) {
            nodesToRemove.push(element);
            node = walker.nextNode();
            continue;
          }
        }

        // Remove base64 inline images, but preserve legitimate ones
        // Legitimate images are typically larger (>1KB) or have meaningful dimensions
        if (tagName === 'img') {
          const src = element.getAttribute('src') || '';
          if (src.startsWith('data:image/')) {
            // Check if it's a small placeholder/tracking pixel
            // Base64 data URLs: data:image/type;base64,<data>
            const base64Data = src.split(',')[1] || '';
            const sizeInBytes = (base64Data.length * 3) / 4; // Approximate size

            // Remove if very small (<1KB) - likely placeholder/tracking pixel
            // Also check dimensions if available
            const width = element.getAttribute('width');
            const height = element.getAttribute('height');
            const isSmall = sizeInBytes < 1024;
            const isTinyDimension =
              (width && parseInt(width, 10) <= 1) || (height && parseInt(height, 10) <= 1);

            if (isSmall || isTinyDimension) {
              nodesToRemove.push(element);
              node = walker.nextNode();
              continue;
            }
            // Otherwise preserve - might be legitimate inline image
          }
        }

        // Preserve SVG elements and their children
        if (tagName === 'svg' || element.closest('svg')) {
          // Skip cleanup for SVG content - preserve structure
          node = walker.nextNode();
          continue;
        }

        // Preserve custom elements (web components)
        // Custom elements typically have hyphens in tag name
        if (tagName.includes('-')) {
          // Don't remove custom elements, but still clean their attributes
          // (continue to attribute cleanup below)
        }

        // Clean up attributes
        const attrsToRemove: string[] = [];
        for (let i = 0; i < element.attributes.length; i++) {
          const attr = element.attributes[i];
          const attrName = attr.name;

          // Remove href attributes (unless we want to keep them)
          if (attrName === 'href') {
            attrsToRemove.push(attrName);
          }

          // Remove data-* attributes EXCEPT data-id (which we need)
          if (attrName.startsWith('data-') && attrName !== 'data-id') {
            attrsToRemove.push(attrName);
          }
        }

        // Mark attributes for removal
        for (const attrName of attrsToRemove) {
          attributesToRemove.push({ element, attr: attrName });
        }
      }

      node = walker.nextNode();
    }

    // Remove marked attributes
    for (const { element, attr } of attributesToRemove) {
      element.removeAttribute(attr);
    }

    // Remove marked nodes (elements and comments)
    for (const nodeToRemove of nodesToRemove) {
      try {
        const parent = nodeToRemove.parentNode;
        if (parent) {
          parent.removeChild(nodeToRemove);
        }
      } catch (error) {
        // Continue on individual node removal errors
        console.warn('[CleanupHtml] Error removing node:', error);
      }
    }
  } catch (error) {
    // If cleanup fails completely, log but don't throw (HTML is still usable)
    console.error('[CleanupHtml] Error during HTML cleanup:', error);
  }
}

/**
 * Build element correspondence map between live DOM and clone.
 * Uses enhanced matching algorithm: position + tagName + id + classes + attributes.
 */
function buildElementCorrespondence(liveRoot: Element, cloneRoot: Element): Map<Element, Element> {
  const correspondence = new Map<Element, Element>();

  try {
    const liveElements: Element[] = [];
    const cloneElements: Element[] = [];

    // Helper to get element signature for matching
    const getElementSignature = (el: Element): string => {
      const parts: string[] = [el.tagName];
      const id = el.getAttribute('id');
      if (id) parts.push(`#${id}`);
      const className = el.getAttribute('class');
      if (className) parts.push(`.${className.split(/\s+/).sort().join('.')}`);
      // Add data-id if present (for indexed elements)
      const dataId = el.getAttribute('data-id');
      if (dataId) parts.push(`[data-id="${dataId}"]`);
      return parts.join('');
    };

    // Traverse live DOM and collect elements
    const liveWalker = document.createTreeWalker(liveRoot, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node: Node) => {
        if (node instanceof HTMLIFrameElement) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let liveNode: Element | null = liveWalker.nextNode() as Element | null;
    while (liveNode) {
      liveElements.push(liveNode);
      liveNode = liveWalker.nextNode() as Element | null;
    }

    // Traverse clone and collect elements (same order)
    const cloneDoc = cloneRoot.ownerDocument || document;
    const cloneWalker = cloneDoc.createTreeWalker(cloneRoot, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node: Node) => {
        if (node instanceof HTMLIFrameElement) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let cloneNode: Element | null = cloneWalker.nextNode() as Element | null;
    while (cloneNode) {
      cloneElements.push(cloneNode);
      cloneNode = cloneWalker.nextNode() as Element | null;
    }

    // Enhanced matching: try position + signature first, then fallback to signature-only
    const minLength = Math.min(liveElements.length, cloneElements.length);
    const usedCloneIndices = new Set<number>();

    // First pass: match by position and signature
    for (let i = 0; i < minLength; i++) {
      const liveEl = liveElements[i];
      const cloneEl = cloneElements[i];

      // Strong match: tagName + id (if present) + classes
      if (liveEl.tagName === cloneEl.tagName) {
        const liveId = liveEl.getAttribute('id');
        const cloneId = cloneEl.getAttribute('id');
        const liveClasses = liveEl.getAttribute('class') || '';
        const cloneClasses = cloneEl.getAttribute('class') || '';

        // If both have IDs, they must match
        if (liveId && cloneId && liveId !== cloneId) {
          continue;
        }

        // If both have classes, they should match (order-independent)
        if (liveClasses && cloneClasses) {
          const liveClassSet = new Set(liveClasses.split(/\s+/).filter(Boolean));
          const cloneClassSet = new Set(cloneClasses.split(/\s+/).filter(Boolean));
          if (liveClassSet.size !== cloneClassSet.size) {
            continue;
          }
          for (const cls of liveClassSet) {
            if (!cloneClassSet.has(cls)) {
              continue;
            }
          }
        }

        // Match found
        correspondence.set(liveEl, cloneEl);
        usedCloneIndices.add(i);
      }
    }

    // Second pass: match remaining elements by signature only (for elements that moved)
    for (let i = 0; i < liveElements.length; i++) {
      if (correspondence.has(liveElements[i])) {
        continue; // Already matched
      }

      const liveEl = liveElements[i];
      const liveSig = getElementSignature(liveEl);

      // Find best match in clone by signature
      for (let j = 0; j < cloneElements.length; j++) {
        if (usedCloneIndices.has(j)) {
          continue; // Already used
        }

        const cloneEl = cloneElements[j];
        if (liveEl.tagName !== cloneEl.tagName) {
          continue;
        }

        const cloneSig = getElementSignature(cloneEl);
        if (liveSig === cloneSig) {
          correspondence.set(liveEl, cloneEl);
          usedCloneIndices.add(j);
          break;
        }
      }
    }

    return correspondence;
  } catch (error) {
    console.error('[BuildCorrespondence] Error building element correspondence:', error);
    // Return empty map on error - get_html will still work, just without data-id attributes
    return correspondence;
  }
}

/**
 * Get a complete HTML snapshot of the current page with data-id attributes
 * on interactable elements.
 */
function executeGetHtml(_args: Record<string, unknown>): ToolExecutionResult {
  try {
    if (!document?.documentElement) {
      return {
        success: false,
        result: '',
        error: 'Document is not available',
      };
    }

    // Step 1: ALWAYS clear previous index first (fresh start)
    clearIndex();

    // Step 2: Index interactable elements on LIVE DOM
    const indexedElements = indexInteractableElements();

    // If indexing failed or no elements found, return HTML without data-id
    if (indexedElements.length === 0) {
      const html = document.documentElement.outerHTML;
      return {
        success: true,
        result: html,
      };
    }

    // Step 3: Clone document.documentElement (deep clone)
    const clone = document.documentElement.cloneNode(true) as Element;

    // Step 4: Build element correspondence map (live -> clone)
    const correspondence = buildElementCorrespondence(document.documentElement, clone);

    // Step 5: Add data-id attributes to clone elements
    let matchedCount = 0;
    let buttonsIndexed = 0;
    let buttonsMatched = 0;
    const unmatchedElements: Array<{ seq: number; tag: string; id?: string }> = [];

    for (const [sequenceNumber, liveElement] of indexedElements) {
      const isButton = liveElement.tagName.toLowerCase() === 'button';
      if (isButton) {
        buttonsIndexed++;
      }

      const cloneElement = correspondence.get(liveElement);
      if (cloneElement) {
        cloneElement.setAttribute('data-id', sequenceNumber.toString());
        matchedCount++;
        if (isButton) {
          buttonsMatched++;
        }
      } else {
        // Track unmatched elements for debugging
        unmatchedElements.push({
          seq: sequenceNumber,
          tag: liveElement.tagName,
          id: liveElement.id || undefined,
        });
        // Fallback: try to find by path if correspondence failed
        console.warn(
          `[ElementIndex] Could not find clone element for sequence ${sequenceNumber} (${liveElement.tagName}${liveElement.id ? `#${liveElement.id}` : ''})`
        );
      }
    }

    if (matchedCount < indexedElements.length) {
      const matchRate = ((matchedCount / indexedElements.length) * 100).toFixed(1);
      console.warn(
        `[ElementIndex] Only matched ${matchedCount} of ${indexedElements.length} elements (${matchRate}% match rate)`
      );
      if (buttonsIndexed > 0) {
        const buttonMatchRate = ((buttonsMatched / buttonsIndexed) * 100).toFixed(1);
        console.warn(
          `[ElementIndex] Button matching: ${buttonsMatched}/${buttonsIndexed} buttons matched (${buttonMatchRate}%)`
        );
      }
      if (unmatchedElements.length > 0 && unmatchedElements.length <= 10) {
        console.warn(
          `[ElementIndex] Unmatched elements:`,
          unmatchedElements.map((e) => `${e.seq}:${e.tag}${e.id ? `#${e.id}` : ''}`).join(', ')
        );
      }
    } else {
      console.log(
        `[ElementIndex] Successfully matched all ${matchedCount} indexed elements to clone`
      );
      if (buttonsIndexed > 0) {
        console.log(
          `[ElementIndex] Button matching: all ${buttonsMatched}/${buttonsIndexed} buttons successfully matched`
        );
      }
    }

    // Step 6: Clean up HTML (remove unnecessary elements and attributes)
    cleanupHtml(clone);

    // Step 7: Return clone.outerHTML
    const html = clone.outerHTML;
    return {
      success: true,
      result: html,
    };
  } catch (error) {
    // On error, clear index and return HTML without data-id
    clearIndex();
    try {
      const html = document.documentElement.outerHTML;
      return {
        success: true,
        result: html,
      };
    } catch {
      return {
        success: false,
        result: '',
        error: `Failed to get HTML: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

/**
 * Get a screenshot of the current page via screensharing
 */
async function executeGetScreenshot(_args: Record<string, unknown>): Promise<ToolExecutionResult> {
  let video: HTMLVideoElement | null = null;
  try {
    // Ensure screensharing is active
    const stream = await startScreenShare();

    if (!stream || stream.getVideoTracks().length === 0) {
      return {
        success: false,
        result: '',
        error: 'Failed to get screenshare stream',
      };
    }

    // Check if stream is still active
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack.readyState === 'ended') {
      return {
        success: false,
        result: '',
        error: 'Screenshare stream has ended',
      };
    }

    // Create a hidden video element
    video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    video.style.display = 'none';
    document.body.appendChild(video);

    // Wait for video to load and play
    await new Promise<void>((resolve, reject) => {
      if (!video) {
        reject(new Error('Video element not created'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Video load timeout'));
      }, 5000);

      const currentVideo = video; // Capture for closure

      currentVideo.onloadeddata = () => {
        clearTimeout(timeout);
        currentVideo
          .play()
          .then(() => {
            // Wait a bit for the frame to be ready
            setTimeout(resolve, 100);
          })
          .catch(reject);
      };

      currentVideo.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Video load error'));
      };
    });

    // Check for zero dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      if (video.parentNode) {
        video.parentNode.removeChild(video);
      }
      return {
        success: false,
        result: '',
        error: 'Video has zero dimensions - stream may not be ready',
      };
    }

    // Browser canvas size limits (typically 16,384px per dimension)
    const MAX_CANVAS_SIZE = 16384;
    let canvasWidth = video.videoWidth;
    let canvasHeight = video.videoHeight;
    let scale = 1.0;

    // Scale down if exceeds browser limits
    if (canvasWidth > MAX_CANVAS_SIZE || canvasHeight > MAX_CANVAS_SIZE) {
      scale = Math.min(MAX_CANVAS_SIZE / canvasWidth, MAX_CANVAS_SIZE / canvasHeight);
      canvasWidth = Math.floor(canvasWidth * scale);
      canvasHeight = Math.floor(canvasHeight * scale);
      console.warn(
        `[Screenshot] Scaling down from ${video.videoWidth}x${video.videoHeight} to ${canvasWidth}x${canvasHeight}`
      );
    }

    // Create canvas and draw video frame
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      if (video.parentNode) {
        video.parentNode.removeChild(video);
      }
      return {
        success: false,
        result: '',
        error: 'Failed to get canvas context',
      };
    }

    // Draw video frame (with scaling if needed)
    if (scale < 1.0) {
      ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);
    } else {
      ctx.drawImage(video, 0, 0);
    }

    // Convert canvas to base64 JPEG with compression (quality 0.75 for good balance)
    // JPEG significantly reduces file size compared to PNG (70-90% reduction)
    let base64: string;
    try {
      base64 = canvas.toDataURL('image/jpeg', 0.75);
    } catch (error) {
      // Fallback to PNG if JPEG conversion fails
      console.warn('JPEG conversion failed, falling back to PNG:', error);
      try {
        base64 = canvas.toDataURL('image/png');
      } catch (pngError) {
        if (video.parentNode) {
          video.parentNode.removeChild(video);
        }
        return {
          success: false,
          result: '',
          error: `Failed to convert canvas to image: ${pngError instanceof Error ? pngError.message : String(pngError)}`,
        };
      }
    }

    // Clean up video element (but keep stream active)
    if (video.parentNode) {
      video.parentNode.removeChild(video);
    }

    return {
      success: true,
      result: base64,
    };
  } catch (error) {
    // Ensure video cleanup in error path
    if (video?.parentNode) {
      try {
        video.parentNode.removeChild(video);
      } catch (cleanupError) {
        console.warn('[Screenshot] Error cleaning up video element:', cleanupError);
      }
    }
    return {
      success: false,
      result: '',
      error: `Failed to get screenshot: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
