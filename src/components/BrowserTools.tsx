import React, { useState } from 'react';

import type { MarketrixConfig } from '../types';
import {
  BROWSER_TOOL_CATEGORIES,
  BROWSER_TOOLS,
  type BrowserAction,
  type BrowserToolMetadata,
} from '../types/browserTools';
import type { IconName } from './base/icons';
import { type ToolCategory, type ToolItem, ToolPanel } from './blocks/ToolPanel';

interface BrowserToolsProps {
  config?: MarketrixConfig;
  onToolSelect?: (tool: BrowserToolMetadata, action: BrowserAction) => void;
  width?: string;
}

function getToolIconName(actionType: BrowserAction['type']): IconName {
  switch (actionType) {
    case 'navigate':
    case 'go_back':
      return 'globe';
    case 'search':
      return 'magnifyingGlass';
    case 'click_element':
      return 'mousePointerClick';
    case 'type_text':
      return 'documentText';
    case 'scroll':
    case 'scroll_to_text':
      return 'scroll';
    case 'send_keys':
      return 'keyboard';
    case 'extract':
    case 'get_html':
    case 'get_interactable_elements':
    case 'get_screenshot':
      return 'documentText';
    case 'get_dropdown_options':
      return 'selectAll';
    case 'select_dropdown_option':
      return 'tablerArrowDown';
    case 'upload_file':
      return 'fileUpload';
    case 'switch_tab':
      return 'arrowRight';
    case 'close_tab':
      return 'xMark';
    case 'done':
      return 'mousePointerClick';
    default:
      return 'documentText';
  }
}

function buildAction(tool: BrowserToolMetadata): BrowserAction {
  switch (tool.actionType) {
    case 'navigate':
      return { type: 'navigate', url: '', new_tab: false };
    case 'search':
      return { type: 'search', query: '', engine: 'duckduckgo' };
    case 'click_element':
      return { type: 'click_element', index: 1, coordinate_x: null, coordinate_y: null };
    case 'type_text':
      return { type: 'type_text', index: 0, text: '', clear: true };
    case 'scroll':
      return { type: 'scroll', down: true, pages: 1.0, index: null };
    case 'scroll_to_text':
      return { type: 'scroll_to_text', text: '' };
    case 'send_keys':
      return { type: 'send_keys', index: 0, keys: '' };
    case 'extract':
      return { type: 'extract', query: '', extract_links: false, start_from_char: 0 };
    case 'get_dropdown_options':
      return { type: 'get_dropdown_options', index: 0 };
    case 'select_dropdown_option':
      return { type: 'select_dropdown_option', index: 0, text: '' };
    case 'upload_file':
      return { type: 'upload_file', index: 0, path: '' };
    case 'go_back':
      return { type: 'go_back' };
    case 'wait':
      return { type: 'wait', seconds: 1 };
    case 'switch_tab':
      return { type: 'switch_tab', tab_id: '' };
    case 'close_tab':
      return { type: 'close_tab' };
    case 'done':
      return { type: 'done', text: '', success: true, files_to_display: null };
    case 'get_html':
      return { type: 'get_html' };
    case 'get_interactable_elements':
      return { type: 'get_interactable_elements' };
    case 'get_screenshot':
      return { type: 'get_screenshot' };
    default:
      return { type: tool.actionType };
  }
}

// Map BrowserToolMetadata to ToolItem for ToolPanel
function toToolItem(tool: BrowserToolMetadata): ToolItem {
  return {
    id: tool.id,
    name: tool.name,
    description: tool.description,
    icon: getToolIconName(tool.actionType),
  };
}

const TOOL_CATEGORIES: ToolCategory[] = Object.entries(BROWSER_TOOL_CATEGORIES).map(([key, label]) => ({
  id: key,
  label,
  tools: BROWSER_TOOLS.filter(t => t.category === key).map(toToolItem),
}));

// Map from ToolItem id back to BrowserToolMetadata for action building
const TOOL_METADATA_MAP = new Map(BROWSER_TOOLS.map(t => [t.id, t]));

export const BrowserTools: React.FC<BrowserToolsProps> = ({ onToolSelect, width: _width = '100%' }) => {
  const [activeCategory, setActiveCategory] = useState<string>('navigation');
  const [selectedTool, setSelectedTool] = useState<string | undefined>();

  const handleToolSelect = (item: ToolItem) => {
    setSelectedTool(item.id);
    const meta = TOOL_METADATA_MAP.get(item.id);
    if (!meta) return;
    const action = buildAction(meta);
    if (onToolSelect) {
      onToolSelect(meta, action);
    }
    console.log('Browser Tool Selected:', meta.name, action);
  };

  return (
    <ToolPanel
      categories={TOOL_CATEGORIES}
      activeCategory={activeCategory}
      onCategoryChange={setActiveCategory}
      onToolSelect={handleToolSelect}
      selectedTool={selectedTool}
    />
  );
};
