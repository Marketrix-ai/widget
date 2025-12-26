import React, { useState } from 'react';
import {
  HiOutlineArrowRight,
  HiOutlineDocumentText,
  HiOutlineGlobeAlt,
  HiOutlineMagnifyingGlass,
  HiOutlineXMark,
} from 'react-icons/hi2';
import { LuMousePointerClick, LuScroll } from 'react-icons/lu';
import { MdOutlineKeyboard, MdOutlineSelectAll } from 'react-icons/md';
import { TbArrowDown, TbFileUpload } from 'react-icons/tb';

import { useWidget } from '../hooks/useWidget';
import type { MarketrixConfig } from '../types';
import {
  BROWSER_TOOL_CATEGORIES,
  BROWSER_TOOLS,
  type BrowserAction,
  type BrowserToolMetadata,
} from '../types/browserTools';
import { addOpacity, getContrastingColor } from '../utils/format';

interface BrowserToolsProps {
  config?: MarketrixConfig;
  onToolSelect?: (tool: BrowserToolMetadata, action: BrowserAction) => void;
  width?: string;
}

export const BrowserTools: React.FC<BrowserToolsProps> = ({
  config,
  onToolSelect,
  width = '100%',
}) => {
  const { config: widgetConfig } = useWidget({ config });
  const [activeTab, setActiveTab] = useState<keyof typeof BROWSER_TOOL_CATEGORIES>('navigation');

  // Get tools for active category
  const toolsInCategory = BROWSER_TOOLS.filter((tool) => tool.category === activeTab);

  // Get icon for tool
  const getToolIcon = (tool: BrowserToolMetadata) => {
    switch (tool.actionType) {
      case 'navigate':
        return <HiOutlineGlobeAlt className='w-4 h-4' />;
      case 'search':
        return <HiOutlineMagnifyingGlass className='w-4 h-4' />;
      case 'click':
        return <LuMousePointerClick className='w-4 h-4' />;
      case 'input_text':
        return <HiOutlineDocumentText className='w-4 h-4' />;
      case 'scroll':
        return <LuScroll className='w-4 h-4' />;
      case 'send_keys':
        return <MdOutlineKeyboard className='w-4 h-4' />;
      case 'extract':
        return <HiOutlineDocumentText className='w-4 h-4' />;
      case 'get_dropdown_options':
        return <MdOutlineSelectAll className='w-4 h-4' />;
      case 'select_dropdown_option':
        return <TbArrowDown className='w-4 h-4' />;
      case 'upload_file':
        return <TbFileUpload className='w-4 h-4' />;
      case 'switch_tab':
        return <HiOutlineArrowRight className='w-4 h-4' />;
      case 'close_tab':
        return <HiOutlineXMark className='w-4 h-4' />;
      case 'done':
        return <LuMousePointerClick className='w-4 h-4' />;
      default:
        return <HiOutlineDocumentText className='w-4 h-4' />;
    }
  };

  // Handle tool click
  const handleToolClick = (tool: BrowserToolMetadata) => {
    // Create a basic action based on tool type
    let action: BrowserAction;

    switch (tool.actionType) {
      case 'navigate':
        action = { type: 'navigate', url: '', new_tab: false };
        break;
      case 'search':
        action = { type: 'search', query: '', engine: 'duckduckgo' };
        break;
      case 'click':
        action = { type: 'click', index: null, coordinate_x: null, coordinate_y: null };
        break;
      case 'input_text':
        action = { type: 'input_text', index: 0, text: '', clear: true };
        break;
      case 'scroll':
        action = { type: 'scroll', down: true, pages: 1.0, index: null };
        break;
      case 'send_keys':
        action = { type: 'send_keys', keys: '' };
        break;
      case 'extract':
        action = { type: 'extract', query: '', extract_links: false, start_from_char: 0 };
        break;
      case 'get_dropdown_options':
        action = { type: 'get_dropdown_options', index: 0 };
        break;
      case 'select_dropdown_option':
        action = { type: 'select_dropdown_option', index: 0, text: '' };
        break;
      case 'upload_file':
        action = { type: 'upload_file', index: 0, path: '' };
        break;
      case 'switch_tab':
        action = { type: 'switch_tab', tab_id: '' };
        break;
      case 'close_tab':
        action = { type: 'close_tab', tab_id: '' };
        break;
      case 'done':
        action = { type: 'done', text: '', success: true, files_to_display: null };
        break;
      case 'structured_output':
        action = { type: 'structured_output', success: true, data: {} };
        break;
      default:
        action = { type: 'no_params' };
    }

    if (onToolSelect) {
      onToolSelect(tool, action);
    }

    // Log tool selection
    console.log('🔧 Browser Tool Selected:', tool.name, action);
  };

  const accentColor = widgetConfig.widget_accent_color;
  const secondaryColor = widgetConfig.widget_secondary_color;
  const textColor = widgetConfig.widget_text_color;
  const borderColor = widgetConfig.widget_border_color;

  return (
    <div
      className='browser-tools-container'
      style={{
        width,
        backgroundColor: '#ffffff',
        border: `1px solid ${addOpacity(borderColor, 0.2)}`,
        borderRadius: widgetConfig.widget_border_radius,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Tabs Header */}
      <div
        className='flex border-b'
        style={{
          borderColor: addOpacity(borderColor, 0.2),
          backgroundColor: addOpacity(secondaryColor, 0.05),
        }}
      >
        {Object.entries(BROWSER_TOOL_CATEGORIES).map(([key, label]) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key as keyof typeof BROWSER_TOOL_CATEGORIES)}
              className='flex-1 px-3 py-2 text-xs font-medium transition-all duration-200'
              style={{
                backgroundColor: isActive ? accentColor : addOpacity(secondaryColor, 0.05),
                color: isActive ? getContrastingColor(accentColor) : textColor,
                borderBottom: isActive ? `2px solid ${accentColor}` : `2px solid transparent`,
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = addOpacity(secondaryColor, 0.1);
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = addOpacity(secondaryColor, 0.05);
                }
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Tools List */}
      <div
        className='flex-1 overflow-y-auto p-2'
        style={{
          maxHeight: '300px',
          scrollbarWidth: 'thin',
          scrollbarColor: `${addOpacity(borderColor, 0.3)} ${addOpacity(borderColor, 0.1)}`,
        }}
      >
        <div className='grid grid-cols-1 gap-2'>
          {toolsInCategory.map((tool) => (
            <button
              key={tool.id}
              onClick={() => handleToolClick(tool)}
              className='flex items-start gap-2 p-2 rounded-lg text-left transition-all duration-200 hover:shadow-md'
              style={{
                backgroundColor: addOpacity(secondaryColor, 0.1),
                border: `1px solid ${addOpacity(borderColor, 0.2)}`,
                color: textColor,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = addOpacity(accentColor, 0.1);
                e.currentTarget.style.borderColor = accentColor;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = addOpacity(secondaryColor, 0.1);
                e.currentTarget.style.borderColor = addOpacity(borderColor, 0.2);
              }}
            >
              <div
                className='shrink-0 flex items-center justify-center rounded'
                style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: addOpacity(accentColor, 0.1),
                  color: accentColor,
                }}
              >
                {getToolIcon(tool)}
              </div>
              <div className='flex-1 min-w-0'>
                <div className='text-sm font-medium' style={{ color: textColor }}>
                  {tool.name}
                </div>
                <div className='text-xs mt-0.5' style={{ color: addOpacity(textColor, 0.7) }}>
                  {tool.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Footer Info */}
      <div
        className='px-3 py-2 text-xs border-t'
        style={{
          borderColor: addOpacity(borderColor, 0.2),
          backgroundColor: addOpacity(secondaryColor, 0.05),
          color: addOpacity(textColor, 0.6),
        }}
      >
        {toolsInCategory.length} tool{toolsInCategory.length !== 1 ? 's' : ''} in{' '}
        {BROWSER_TOOL_CATEGORIES[activeTab]}
      </div>
    </div>
  );
};
