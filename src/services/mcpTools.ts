/**
 * MCP Tools Implementation
 *
 * JavaScript implementations of all MCP browser-use tools.
 * These tools interact with the browser DOM to perform actions.
 */

import type { MCPClient, MCPToolHandler } from './mcpClient';

/**
 * Get all interactive elements on the page
 */
function getInteractiveElements(): HTMLElement[] {
  const selectors = [
    'a',
    'button',
    'input',
    'select',
    'textarea',
    '[onclick]',
    '[role="button"]',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ];
  const elements: HTMLElement[] = [];
  selectors.forEach((selector) => {
    const found = document.querySelectorAll<HTMLElement>(selector);
    found.forEach((el) => {
      if (el.offsetParent !== null) {
        // Visible elements only
        elements.push(el);
      }
    });
  });
  return elements;
}

/**
 * Get element by index from interactive elements
 */
function getElementByIndex(index: number): HTMLElement | null {
  const elements = getInteractiveElements();
  return elements[index] || null;
}

/**
 * Search tool - opens a search engine with the query
 */
export const searchTool: MCPToolHandler = async (_toolName, args) => {
  const query = typeof args.query === 'string' ? args.query : undefined;
  const engine = typeof args.engine === 'string' ? args.engine : 'duckduckgo';

  if (!query) {
    throw new Error('Query parameter is required');
  }

  const searchUrls: Record<string, string> = {
    duckduckgo: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
    google: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    bing: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
  };

  const url = searchUrls[engine] || searchUrls.duckduckgo;
  window.open(url, '_blank');

  return {
    content: [
      {
        type: 'text',
        text: `Opened ${engine} search for: ${query}`,
      },
    ],
  };
};

/**
 * Navigate tool - navigates to a URL
 */
export const navigateTool: MCPToolHandler = async (_toolName, args) => {
  const url = typeof args.url === 'string' ? args.url : undefined;
  const new_tab = typeof args.new_tab === 'boolean' ? args.new_tab : false;

  if (!url) {
    throw new Error('URL parameter is required');
  }

  try {
    if (new_tab) {
      window.open(url, '_blank');
    } else {
      window.location.href = url;
    }

    return {
      content: [
        {
          type: 'text',
          text: `Navigated to: ${url}`,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to navigate: ${errorMessage}`);
  }
};

/**
 * Go back tool - navigates back in browser history
 */
export const goBackTool: MCPToolHandler = async (_toolName, _args) => {
  if (window.history.length > 1) {
    window.history.back();
    return {
      content: [
        {
          type: 'text',
          text: 'Navigated back in browser history',
        },
      ],
    };
  } else {
    throw new Error('Cannot go back: no history available');
  }
};

/**
 * Wait tool - waits for specified seconds
 */
export const waitTool: MCPToolHandler = async (_toolName, args) => {
  const seconds = typeof args.seconds === 'number' ? args.seconds : 3;

  if (seconds < 0 || seconds > 30) {
    throw new Error('Seconds must be between 0 and 30');
  }

  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));

  return {
    content: [
      {
        type: 'text',
        text: `Waited for ${seconds} seconds`,
      },
    ],
  };
};

/**
 * Click element tool - clicks an element by index
 */
export const clickElementTool: MCPToolHandler = async (_toolName, args) => {
  const { index } = args;

  if (typeof index !== 'number') {
    throw new Error('Index parameter is required and must be a number');
  }

  const element = getElementByIndex(index);
  if (!element) {
    throw new Error(`Element at index ${index} not found`);
  }

  // Scroll element into view
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Click the element
  element.click();

  return {
    content: [
      {
        type: 'text',
        text: `Clicked element at index ${index}`,
      },
    ],
  };
};

/**
 * Type text tool - types text into an input element
 */
export const typeTextTool: MCPToolHandler = async (_toolName, args) => {
  const { index, text } = args;

  if (typeof index !== 'number') {
    throw new Error('Index parameter is required and must be a number');
  }
  if (typeof text !== 'string') {
    throw new Error('Text parameter is required and must be a string');
  }

  const element = getElementByIndex(index) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!element) {
    throw new Error(`Element at index ${index} not found`);
  }

  const isInput = element.tagName === 'INPUT' || element.tagName === 'TEXTAREA';
  const isContentEditable = 'isContentEditable' in element && element.isContentEditable;

  if (!isInput && !isContentEditable) {
    throw new Error(
      `Element at index ${index} is not an input, textarea, or contenteditable element`
    );
  }

  // Focus the element
  element.focus();
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Clear existing value
  if (isInput && 'value' in element) {
    (element as HTMLInputElement | HTMLTextAreaElement).value = '';
  } else if (isContentEditable && 'textContent' in element) {
    element.textContent = '';
  }

  // Type the text
  if (isInput && 'value' in element) {
    (element as HTMLInputElement | HTMLTextAreaElement).value = text;
    // Trigger input event
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (isContentEditable && 'textContent' in element) {
    element.textContent = text;
  }

  return {
    content: [
      {
        type: 'text',
        text: `Typed text into element at index ${index}`,
      },
    ],
  };
};

/**
 * Scroll tool - scrolls the page in a direction
 */
export const scrollTool: MCPToolHandler = async (_toolName, args) => {
  const direction = typeof args.direction === 'string' ? args.direction : undefined;

  if (!direction || !['up', 'down', 'left', 'right'].includes(direction)) {
    throw new Error('Direction must be one of: up, down, left, right');
  }

  const scrollAmount = window.innerHeight * 0.8; // Scroll 80% of viewport

  switch (direction) {
    case 'down':
      window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
      break;
    case 'up':
      window.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
      break;
    case 'right':
      window.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      break;
    case 'left':
      window.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      break;
  }

  await new Promise((resolve) => setTimeout(resolve, 300));

  return {
    content: [
      {
        type: 'text',
        text: `Scrolled ${direction}`,
      },
    ],
  };
};

/**
 * Scroll to text tool - scrolls to find text on the page
 */
export const scrollToTextTool: MCPToolHandler = async (_toolName, args) => {
  const text = typeof args.text === 'string' ? args.text : undefined;

  if (!text) {
    throw new Error('Text parameter is required');
  }

  // Find element containing the text
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);

  let node: Node | null;
  let found = false;
  while ((node = walker.nextNode())) {
    if (node.textContent?.includes(text)) {
      const element = node.parentElement;
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        found = true;
        break;
      }
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 300));

  if (!found) {
    throw new Error(`Text "${text}" not found on page`);
  }

  return {
    content: [
      {
        type: 'text',
        text: `Scrolled to text: ${text}`,
      },
    ],
  };
};

/**
 * Extract tool - extracts structured data from the current page
 */
export const extractTool: MCPToolHandler = async (_toolName, _args) => {
  const data: Record<string, unknown> = {
    url: window.location.href,
    title: document.title,
    headings: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((h) => ({
      level: h.tagName,
      text: h.textContent?.trim(),
    })),
    links: Array.from(document.querySelectorAll('a[href]'))
      .slice(0, 50)
      .map((a) => ({
        text: a.textContent?.trim(),
        href: a.getAttribute('href'),
      })),
    images: Array.from(document.querySelectorAll('img[src]'))
      .slice(0, 20)
      .map((img) => ({
        alt: img.getAttribute('alt') || '',
        src: img.getAttribute('src') || '',
      })),
    forms: Array.from(document.querySelectorAll('form')).map((form) => ({
      action: form.getAttribute('action') || '',
      method: form.getAttribute('method') || 'get',
      inputs: Array.from(form.querySelectorAll('input, select, textarea')).map((input) => ({
        type: input.getAttribute('type') || input.tagName.toLowerCase(),
        name: input.getAttribute('name') || '',
        id: input.getAttribute('id') || '',
      })),
    })),
    interactiveElements: getInteractiveElements()
      .slice(0, 50)
      .map((el, idx) => ({
        index: idx,
        tag: el.tagName.toLowerCase(),
        text: el.textContent?.trim().substring(0, 100) || '',
        type: el.getAttribute('type') || '',
        id: el.getAttribute('id') || '',
        className: el.className || '',
      })),
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
};

/**
 * Upload file tool - uploads a file to a file input element
 */
export const uploadFileTool: MCPToolHandler = async (_toolName, args) => {
  const { index, path } = args;

  if (typeof index !== 'number') {
    throw new Error('Index parameter is required and must be a number');
  }
  if (!path) {
    throw new Error('Path parameter is required');
  }

  const element = getElementByIndex(index) as HTMLInputElement | null;
  if (element?.tagName !== 'INPUT' || element.type !== 'file') {
    throw new Error(`Element at index ${index} is not a file input`);
  }

  // Note: Browser security prevents programmatic file uploads from local paths
  // This would need to be handled differently in a real implementation
  // For now, we'll just trigger the file picker
  element.click();

  return {
    content: [
      {
        type: 'text',
        text: `File input at index ${index} opened. Note: Browser security prevents automatic file uploads from local paths.`,
      },
    ],
  };
};

/**
 * Done tool - marks the task as complete
 */
export const doneTool: MCPToolHandler = async (_toolName, args) => {
  const success = typeof args.success === 'boolean' ? args.success : true;
  const message = typeof args.message === 'string' ? args.message : undefined;

  return {
    content: [
      {
        type: 'text',
        text: message || (success ? 'Task completed successfully' : 'Task completed with errors'),
      },
    ],
  };
};

/**
 * Select dropdown option tool - selects an option from a dropdown
 */
export const selectDropdownOptionTool: MCPToolHandler = async (_toolName, args) => {
  const index = typeof args.index === 'number' ? args.index : undefined;
  const option = typeof args.option === 'string' ? args.option : undefined;

  if (typeof index !== 'number') {
    throw new Error('Index parameter is required and must be a number');
  }
  if (!option) {
    throw new Error('Option parameter is required');
  }

  const element = getElementByIndex(index) as HTMLSelectElement | null;
  if (element?.tagName !== 'SELECT') {
    throw new Error(`Element at index ${index} is not a select element`);
  }

  // Try to find option by value or text
  const options = Array.from(element.options);
  const foundOption = options.find((opt) => opt.value === option || opt.text === option);

  if (!foundOption) {
    throw new Error(`Option "${option}" not found in dropdown`);
  }

  element.value = foundOption.value;
  element.dispatchEvent(new Event('change', { bubbles: true }));

  return {
    content: [
      {
        type: 'text',
        text: `Selected option "${option}" in dropdown at index ${index}`,
      },
    ],
  };
};

/**
 * Get dropdown options tool - gets all options from a dropdown
 */
export const getDropdownOptionsTool: MCPToolHandler = async (_toolName, args) => {
  const { index } = args;

  if (typeof index !== 'number') {
    throw new Error('Index parameter is required and must be a number');
  }

  const element = getElementByIndex(index) as HTMLSelectElement | null;
  if (element?.tagName !== 'SELECT') {
    throw new Error(`Element at index ${index} is not a select element`);
  }

  const options = Array.from(element.options).map((opt) => ({
    value: opt.value,
    text: opt.text,
    selected: opt.selected,
  }));

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(options, null, 2),
      },
    ],
  };
};

/**
 * Close tab tool - closes the current browser tab
 */
export const closeTabTool: MCPToolHandler = async (_toolName, _args) => {
  // Note: Browser security prevents closing tabs that weren't opened by script
  // This will only work if the tab was opened by the same script
  window.close();

  return {
    content: [
      {
        type: 'text',
        text: 'Attempted to close tab (may be blocked by browser security)',
      },
    ],
  };
};

/**
 * Switch tab tool - switches to a different browser tab
 */
export const switchTabTool: MCPToolHandler = async (_toolName, args) => {
  const { tab_index } = args;

  if (typeof tab_index !== 'number') {
    throw new Error('tab_index parameter is required and must be a number');
  }

  // Note: Browser security prevents programmatic tab switching
  // This is a limitation of browser APIs
  return {
    content: [
      {
        type: 'text',
        text: `Tab switching is not supported due to browser security restrictions. Requested tab index: ${tab_index}`,
      },
    ],
  };
};

/**
 * Send keys tool - sends keyboard keys to an element
 */
export const sendKeysTool: MCPToolHandler = async (_toolName, args) => {
  const index = typeof args.index === 'number' ? args.index : undefined;
  const keys = typeof args.keys === 'string' ? args.keys : undefined;

  if (typeof index !== 'number') {
    throw new Error('Index parameter is required and must be a number');
  }
  if (!keys) {
    throw new Error('Keys parameter is required');
  }

  const element = getElementByIndex(index);
  if (!element) {
    throw new Error(`Element at index ${index} not found`);
  }

  // Focus the element
  element.focus();
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Map special keys
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
  const keyEvent = new KeyboardEvent('keydown', {
    key,
    code: key,
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(keyEvent);

  const keyUpEvent = new KeyboardEvent('keyup', {
    key,
    code: key,
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(keyUpEvent);

  return {
    content: [
      {
        type: 'text',
        text: `Sent keys "${keys}" to element at index ${index}`,
      },
    ],
  };
};

/**
 * Register all MCP tools with the MCP client
 */
export function registerAllTools(mcpClient: MCPClient): void {
  mcpClient.registerToolHandler('search', searchTool);
  mcpClient.registerToolHandler('navigate', navigateTool);
  mcpClient.registerToolHandler('go_back', goBackTool);
  mcpClient.registerToolHandler('wait', waitTool);
  mcpClient.registerToolHandler('click_element', clickElementTool);
  mcpClient.registerToolHandler('type_text', typeTextTool);
  mcpClient.registerToolHandler('scroll', scrollTool);
  mcpClient.registerToolHandler('scroll_to_text', scrollToTextTool);
  mcpClient.registerToolHandler('extract', extractTool);
  mcpClient.registerToolHandler('upload_file', uploadFileTool);
  mcpClient.registerToolHandler('done', doneTool);
  mcpClient.registerToolHandler('select_dropdown_option', selectDropdownOptionTool);
  mcpClient.registerToolHandler('get_dropdown_options', getDropdownOptionsTool);
  mcpClient.registerToolHandler('close_tab', closeTabTool);
  mcpClient.registerToolHandler('switch_tab', switchTabTool);
  mcpClient.registerToolHandler('send_keys', sendKeysTool);
}
