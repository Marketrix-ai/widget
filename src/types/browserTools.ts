/**
 * Browser Use Tools - TypeScript types for browser automation actions
 * Based on browser_use Python library views.py
 */

// Base action interface
export interface BaseBrowserAction {
  type: string;
}

// Extract Action
export interface ExtractAction extends BaseBrowserAction {
  type: 'extract';
  query: string;
  extract_links?: boolean;
  start_from_char?: number;
}

// Search Action
export interface SearchAction extends BaseBrowserAction {
  type: 'search';
  query: string;
  engine?: 'duckduckgo' | 'google' | 'bing';
}

// Navigate Action
export interface NavigateAction extends BaseBrowserAction {
  type: 'navigate';
  url: string;
  new_tab?: boolean;
}

// Click Element Action
export interface ClickElementAction extends BaseBrowserAction {
  type: 'click';
  index?: number | null;
  coordinate_x?: number | null;
  coordinate_y?: number | null;
}

// Input Text Action
export interface InputTextAction extends BaseBrowserAction {
  type: 'input_text';
  index: number;
  text: string;
  clear?: boolean;
}

// Done Action
export interface DoneAction extends BaseBrowserAction {
  type: 'done';
  text: string;
  success?: boolean;
  files_to_display?: string[] | null;
}

// Structured Output Action
export interface StructuredOutputAction<T = unknown> extends BaseBrowserAction {
  type: 'structured_output';
  success?: boolean;
  data: T;
}

// Switch Tab Action
export interface SwitchTabAction extends BaseBrowserAction {
  type: 'switch_tab';
  tab_id: string;
}

// Close Tab Action
export interface CloseTabAction extends BaseBrowserAction {
  type: 'close_tab';
  tab_id: string;
}

// Scroll Action
export interface ScrollAction extends BaseBrowserAction {
  type: 'scroll';
  down?: boolean;
  pages?: number;
  index?: number | null;
}

// Send Keys Action
export interface SendKeysAction extends BaseBrowserAction {
  type: 'send_keys';
  keys: string;
}

// Upload File Action
export interface UploadFileAction extends BaseBrowserAction {
  type: 'upload_file';
  index: number;
  path: string;
}

// No Params Action
export interface NoParamsAction extends BaseBrowserAction {
  type: 'no_params';
}

// Get Dropdown Options Action
export interface GetDropdownOptionsAction extends BaseBrowserAction {
  type: 'get_dropdown_options';
  index: number;
}

// Select Dropdown Option Action
export interface SelectDropdownOptionAction extends BaseBrowserAction {
  type: 'select_dropdown_option';
  index: number;
  text: string;
}

// Union type for all browser actions
export type BrowserAction =
  | ExtractAction
  | SearchAction
  | NavigateAction
  | ClickElementAction
  | InputTextAction
  | DoneAction
  | StructuredOutputAction
  | SwitchTabAction
  | CloseTabAction
  | ScrollAction
  | SendKeysAction
  | UploadFileAction
  | NoParamsAction
  | GetDropdownOptionsAction
  | SelectDropdownOptionAction;

// Tool metadata for UI display
export interface BrowserToolMetadata {
  id: string;
  name: string;
  description: string;
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

// All browser tools metadata
export const BROWSER_TOOLS: BrowserToolMetadata[] = [
  {
    id: 'navigate',
    name: 'Navigate',
    description: 'Navigate to a URL',
    category: 'navigation',
    actionType: 'navigate',
  },
  {
    id: 'search',
    name: 'Search',
    description: 'Search the web using a search engine',
    category: 'navigation',
    actionType: 'search',
  },
  {
    id: 'click',
    name: 'Click Element',
    description: 'Click on an element by index or coordinates',
    category: 'interaction',
    actionType: 'click',
  },
  {
    id: 'input_text',
    name: 'Input Text',
    description: 'Type text into an input field',
    category: 'interaction',
    actionType: 'input_text',
  },
  {
    id: 'scroll',
    name: 'Scroll',
    description: 'Scroll the page up or down',
    category: 'interaction',
    actionType: 'scroll',
  },
  {
    id: 'send_keys',
    name: 'Send Keys',
    description: 'Send keyboard keys or shortcuts',
    category: 'interaction',
    actionType: 'send_keys',
  },
  {
    id: 'extract',
    name: 'Extract',
    description: 'Extract content from the page',
    category: 'extraction',
    actionType: 'extract',
  },
  {
    id: 'get_dropdown_options',
    name: 'Get Dropdown Options',
    description: 'Get available options from a dropdown',
    category: 'extraction',
    actionType: 'get_dropdown_options',
  },
  {
    id: 'select_dropdown_option',
    name: 'Select Dropdown Option',
    description: 'Select an option from a dropdown',
    category: 'interaction',
    actionType: 'select_dropdown_option',
  },
  {
    id: 'upload_file',
    name: 'Upload File',
    description: 'Upload a file to an input field',
    category: 'interaction',
    actionType: 'upload_file',
  },
  {
    id: 'switch_tab',
    name: 'Switch Tab',
    description: 'Switch to a different browser tab',
    category: 'utility',
    actionType: 'switch_tab',
  },
  {
    id: 'close_tab',
    name: 'Close Tab',
    description: 'Close a browser tab',
    category: 'utility',
    actionType: 'close_tab',
  },
  {
    id: 'done',
    name: 'Done',
    description: 'Mark task as complete',
    category: 'utility',
    actionType: 'done',
  },
  {
    id: 'structured_output',
    name: 'Structured Output',
    description: 'Return structured data output',
    category: 'utility',
    actionType: 'structured_output',
  },
];
