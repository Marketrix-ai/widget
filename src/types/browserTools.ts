/**
 * Browser Use Tools - TypeScript types for browser automation actions
 * Based on browser_use Python library views.py
 *
 * IMPORTANT: This file is the single source of truth for widget tool metadata.
 * ALLOWED_TOOLS in TaskContext.tsx and TOOL_NAME_MAPPING in chat.ts are derived from BROWSER_TOOLS.
 */

// Base action interface
export interface BaseBrowserAction {
  type: string;
}

export interface ExtractAction extends BaseBrowserAction {
  type: 'extract';
  query: string;
  extract_links?: boolean;
  start_from_char?: number;
}

export interface SearchAction extends BaseBrowserAction {
  type: 'search';
  query: string;
  engine?: 'duckduckgo' | 'google' | 'bing';
}

export interface NavigateAction extends BaseBrowserAction {
  type: 'navigate';
  url: string;
  new_tab?: boolean;
}

export interface ClickElementAction extends BaseBrowserAction {
  type: 'click_element';
  index: number;
  coordinate_x?: number | null;
  coordinate_y?: number | null;
}

export interface TypeTextAction extends BaseBrowserAction {
  type: 'type_text';
  index: number;
  text: string;
  clear?: boolean;
}

export interface DoneAction extends BaseBrowserAction {
  type: 'done';
  text: string;
  success?: boolean;
  files_to_display?: string[] | null;
}

export interface SwitchTabAction extends BaseBrowserAction {
  type: 'switch_tab';
  tab_id: string;
}

export interface CloseTabAction extends BaseBrowserAction {
  type: 'close_tab';
}

export interface ScrollAction extends BaseBrowserAction {
  type: 'scroll';
  down?: boolean;
  pages?: number;
  index?: number | null;
}

export interface ScrollToTextAction extends BaseBrowserAction {
  type: 'scroll_to_text';
  text: string;
}

export interface SendKeysAction extends BaseBrowserAction {
  type: 'send_keys';
  index: number;
  keys: string;
}

export interface UploadFileAction extends BaseBrowserAction {
  type: 'upload_file';
  index: number;
  path: string;
}

export interface GetDropdownOptionsAction extends BaseBrowserAction {
  type: 'get_dropdown_options';
  index: number;
}

export interface SelectDropdownOptionAction extends BaseBrowserAction {
  type: 'select_dropdown_option';
  index: number;
  text: string;
}

export interface GoBackAction extends BaseBrowserAction {
  type: 'go_back';
}

export interface WaitAction extends BaseBrowserAction {
  type: 'wait';
  seconds: number;
}

export interface GetHtmlAction extends BaseBrowserAction {
  type: 'get_html';
}

export interface GetInteractableElementsAction extends BaseBrowserAction {
  type: 'get_interactable_elements';
}

export interface GetScreenshotAction extends BaseBrowserAction {
  type: 'get_screenshot';
}

// Union type for all browser actions
export type BrowserAction =
  | ExtractAction
  | SearchAction
  | NavigateAction
  | ClickElementAction
  | TypeTextAction
  | DoneAction
  | SwitchTabAction
  | CloseTabAction
  | ScrollAction
  | ScrollToTextAction
  | SendKeysAction
  | UploadFileAction
  | GetDropdownOptionsAction
  | SelectDropdownOptionAction
  | GoBackAction
  | WaitAction
  | GetHtmlAction
  | GetInteractableElementsAction
  | GetScreenshotAction;

// Tool metadata for UI display
export interface BrowserToolMetadata {
  id: string;
  name: string;
  description: string;
  displayAction: string;
  icon?: string;
  category: 'navigation' | 'interaction' | 'extraction' | 'utility';
  actionType: BrowserAction['type'];
}

// Tool categories
export const BROWSER_TOOL_CATEGORIES = {
  navigation: 'Navigation',
  interaction: 'Interaction',
  extraction: 'Extraction',
  utility: 'Utility',
} as const;

/**
 * Single source of truth for all widget tools.
 * - `id` = the wire tool name (matches ToolService switch, agent registry, ALLOWED_TOOLS)
 * - `actionType` = the discriminant used to build a default BrowserAction in the UI
 * - `displayAction` = friendly label shown in chat progress
 */
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
