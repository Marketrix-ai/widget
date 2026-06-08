/**
 * Browser Use Tools - widget tool registry.
 *
 * IMPORTANT: This file is the single source of truth for widget tool metadata.
 * ALLOWED_TOOLS in TaskContext.tsx and TOOL_NAME_MAPPING in chat.ts are derived
 * from BROWSER_TOOLS below.
 */

interface BrowserToolMetadata {
  id: string;
  name: string;
  description: string;
  displayAction: string;
  icon?: string;
  category: 'navigation' | 'interaction' | 'extraction' | 'utility';
  actionType: string;
}

export const BROWSER_TOOLS: BrowserToolMetadata[] = [
  {
    id: 'navigate',
    name: 'Navigate',
    description: 'Navigate to a URL',
    displayAction: 'Navigating',
    category: 'navigation',
    actionType: 'navigate',
  },
  {
    id: 'search',
    name: 'Search',
    description: 'Search the web using a search engine',
    displayAction: 'Searching',
    category: 'navigation',
    actionType: 'search',
  },
  {
    id: 'click_element',
    name: 'Click Element',
    description: 'Click on an element by index or coordinates',
    displayAction: 'Clicking element',
    category: 'interaction',
    actionType: 'click_element',
  },
  {
    id: 'type_text',
    name: 'Type Text',
    description: 'Type text into an input field',
    displayAction: 'Typing text',
    category: 'interaction',
    actionType: 'type_text',
  },
  {
    id: 'scroll',
    name: 'Scroll',
    description: 'Scroll the page up or down',
    displayAction: 'Scrolling',
    category: 'interaction',
    actionType: 'scroll',
  },
  {
    id: 'scroll_to_text',
    name: 'Scroll to Text',
    description: 'Scroll until text is visible',
    displayAction: 'Scrolling to text',
    category: 'interaction',
    actionType: 'scroll_to_text',
  },
  {
    id: 'send_keys',
    name: 'Send Keys',
    description: 'Send keyboard keys or shortcuts',
    displayAction: 'Pressing key',
    category: 'interaction',
    actionType: 'send_keys',
  },
  {
    id: 'extract',
    name: 'Extract',
    description: 'Extract content from the page',
    displayAction: 'Extracting content',
    category: 'extraction',
    actionType: 'extract',
  },
  {
    id: 'get_dropdown_options',
    name: 'Get Dropdown Options',
    description: 'Get available options from a dropdown',
    displayAction: 'Reading dropdown options',
    category: 'extraction',
    actionType: 'get_dropdown_options',
  },
  {
    id: 'select_dropdown_option',
    name: 'Select Dropdown Option',
    description: 'Select an option from a dropdown',
    displayAction: 'Selecting option',
    category: 'interaction',
    actionType: 'select_dropdown_option',
  },
  {
    id: 'upload_file',
    name: 'Upload File',
    description: 'Upload a file to an input field',
    displayAction: 'Uploading file',
    category: 'interaction',
    actionType: 'upload_file',
  },
  {
    id: 'go_back',
    name: 'Go Back',
    description: 'Browser back button',
    displayAction: 'Going back',
    category: 'navigation',
    actionType: 'go_back',
  },
  {
    id: 'wait',
    name: 'Wait',
    description: 'Wait for a specified duration',
    displayAction: 'Waiting',
    category: 'utility',
    actionType: 'wait',
  },
  {
    id: 'switch_tab',
    name: 'Switch Tab',
    description: 'Switch to a different browser tab',
    displayAction: 'Switching tab',
    category: 'utility',
    actionType: 'switch_tab',
  },
  {
    id: 'close_tab',
    name: 'Close Tab',
    description: 'Close the current browser tab',
    displayAction: 'Closing tab',
    category: 'utility',
    actionType: 'close_tab',
  },
  {
    id: 'done',
    name: 'Done',
    description: 'Mark task as complete',
    displayAction: 'Done',
    category: 'utility',
    actionType: 'done',
  },
  {
    id: 'get_html',
    name: 'Get HTML',
    description: 'Get full page HTML with data-id attributes',
    displayAction: 'Viewed your screen',
    category: 'extraction',
    actionType: 'get_html',
  },
  {
    id: 'get_interactable_elements',
    name: 'Get Interactable Elements',
    description: 'Get list of interactable elements',
    displayAction: 'Scanning elements',
    category: 'extraction',
    actionType: 'get_interactable_elements',
  },
  {
    id: 'get_screenshot',
    name: 'Get Screenshot',
    description: 'Capture a screenshot of the page',
    displayAction: 'Taking screenshot',
    category: 'extraction',
    actionType: 'get_screenshot',
  },
];
