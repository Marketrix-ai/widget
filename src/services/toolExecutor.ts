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
import { startScreenShare } from './screenShareService';

export interface ToolExecutionResult {
  success: boolean;
  result: string;
  error?: string;
}

/**
 * Execute a browser tool by name with given arguments.
 * @param toolName The name of the tool (must match MCP tool name)
 * @param arguments_ The tool arguments (without chat_id)
 * @returns Promise resolving to execution result
 */
export async function executeTool(
  toolName: string,
  arguments_: Record<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    console.log(`[ToolExecutor] Executing tool: ${toolName}`, arguments_);

    switch (toolName) {
      case 'navigate':
        return executeNavigate(arguments_);
      case 'search':
        return executeSearch(arguments_);
      case 'click_element':
        return executeClickElement(arguments_);
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
function executeClickElement(args: Record<string, unknown>): ToolExecutionResult {
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
    setTimeout(() => {
      element.click();
    }, 100);

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
 * Get a complete HTML snapshot of the current page
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

    const html = document.documentElement.outerHTML;
    return {
      success: true,
      result: html,
    };
  } catch (error) {
    return {
      success: false,
      result: '',
      error: `Failed to get HTML: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Get a screenshot of the current page via screensharing
 */
async function executeGetScreenshot(_args: Record<string, unknown>): Promise<ToolExecutionResult> {
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

    // Create a hidden video element
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    video.style.display = 'none';
    document.body.appendChild(video);

    // Wait for video to load and play
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Video load timeout'));
      }, 5000);

      video.onloadeddata = () => {
        clearTimeout(timeout);
        video
          .play()
          .then(() => {
            // Wait a bit for the frame to be ready
            setTimeout(resolve, 100);
          })
          .catch(reject);
      };

      video.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Video load error'));
      };
    });

    // Create canvas and draw video frame
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      document.body.removeChild(video);
      return {
        success: false,
        result: '',
        error: 'Failed to get canvas context',
      };
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to base64 PNG
    const base64 = canvas.toDataURL('image/png');

    // Clean up video element (but keep stream active)
    document.body.removeChild(video);

    return {
      success: true,
      result: base64,
    };
  } catch (error) {
    return {
      success: false,
      result: '',
      error: `Failed to get screenshot: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
