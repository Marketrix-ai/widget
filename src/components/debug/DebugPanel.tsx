/**
 * Debug Panel Component
 *
 * A floating debug panel for testing browser tools in isolation.
 * Toggle with Ctrl+Shift+D
 *
 * Features:
 * - Tool selector with parameter inputs
 * - Mode toggle (Do/Show)
 * - Execute button with result display
 * - DOM element viewer
 * - Auto-index button
 */

import React, { useCallback, useEffect, useState } from 'react';

import { domService } from '../../services/DomService';
import { type ToolExecutionResult, toolExecutionService } from '../../services/ToolService';
import { TOOL_PARAMS } from '../../utils/devTools';

// Styles for debug panel (inline to keep it self-contained)
const styles = {
  overlay: {
    position: 'fixed' as const,
    top: '10px',
    right: '10px',
    width: '420px',
    maxHeight: 'calc(100vh - 20px)',
    backgroundColor: '#1e1e1e',
    border: '1px solid #3c3c3c',
    borderRadius: '8px',
    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
    fontSize: '12px',
    color: '#d4d4d4',
    zIndex: 999999,
    display: 'flex',
    flexDirection: 'column' as const,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
  },
  header: {
    padding: '10px 12px',
    backgroundColor: '#2d2d2d',
    borderBottom: '1px solid #3c3c3c',
    borderRadius: '8px 8px 0 0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontWeight: 'bold' as const,
    color: '#569cd6',
    fontSize: '13px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#808080',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '0 4px',
  },
  content: {
    padding: '12px',
    overflowY: 'auto' as const,
    flex: 1,
  },
  section: {
    marginBottom: '16px',
  },
  sectionTitle: {
    color: '#9cdcfe',
    marginBottom: '8px',
    fontWeight: 'bold' as const,
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  select: {
    width: '100%',
    padding: '8px',
    backgroundColor: '#3c3c3c',
    border: '1px solid #4c4c4c',
    borderRadius: '4px',
    color: '#d4d4d4',
    fontSize: '12px',
    cursor: 'pointer',
  },
  inputGroup: {
    marginBottom: '8px',
  },
  label: {
    display: 'block',
    color: '#9cdcfe',
    marginBottom: '4px',
    fontSize: '11px',
  },
  input: {
    width: '100%',
    padding: '8px',
    backgroundColor: '#3c3c3c',
    border: '1px solid #4c4c4c',
    borderRadius: '4px',
    color: '#d4d4d4',
    fontSize: '12px',
    boxSizing: 'border-box' as const,
  },
  row: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '8px',
  },
  modeBtn: (active: boolean) => ({
    flex: 1,
    padding: '8px',
    backgroundColor: active ? '#264f78' : '#3c3c3c',
    border: active ? '1px solid #569cd6' : '1px solid #4c4c4c',
    borderRadius: '4px',
    color: active ? '#ffffff' : '#d4d4d4',
    cursor: 'pointer',
    fontSize: '12px',
  }),
  executeBtn: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#0e639c',
    border: 'none',
    borderRadius: '4px',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold' as const,
  },
  executeBtnDisabled: {
    backgroundColor: '#4c4c4c',
    cursor: 'not-allowed',
  },
  result: {
    padding: '10px',
    backgroundColor: '#2d2d2d',
    borderRadius: '4px',
    marginTop: '8px',
    maxHeight: '150px',
    overflowY: 'auto' as const,
  },
  resultSuccess: {
    color: '#4ec9b0',
  },
  resultError: {
    color: '#f14c4c',
  },
  elementList: {
    maxHeight: '200px',
    overflowY: 'auto' as const,
    backgroundColor: '#2d2d2d',
    borderRadius: '4px',
  },
  elementItem: {
    padding: '6px 10px',
    borderBottom: '1px solid #3c3c3c',
    cursor: 'pointer',
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  elementIndex: {
    color: '#b5cea8',
    fontWeight: 'bold' as const,
    minWidth: '30px',
  },
  elementTag: {
    color: '#569cd6',
  },
  elementId: {
    color: '#ce9178',
  },
  elementText: {
    color: '#808080',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    flex: 1,
  },
  indexBtn: {
    padding: '8px 12px',
    backgroundColor: '#3c3c3c',
    border: '1px solid #4c4c4c',
    borderRadius: '4px',
    color: '#d4d4d4',
    cursor: 'pointer',
    fontSize: '12px',
    marginBottom: '8px',
  },
  badge: {
    backgroundColor: '#4ec9b0',
    color: '#1e1e1e',
    padding: '2px 6px',
    borderRadius: '10px',
    fontSize: '10px',
    marginLeft: '8px',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #3c3c3c',
    backgroundColor: '#252526',
  },
  tab: (active: boolean) => ({
    padding: '8px 16px',
    backgroundColor: active ? '#1e1e1e' : 'transparent',
    border: 'none',
    borderBottom: active ? '2px solid #569cd6' : '2px solid transparent',
    color: active ? '#ffffff' : '#808080',
    cursor: 'pointer',
    fontSize: '12px',
  }),
};

interface IndexedElement {
  index: number;
  tag: string;
  id: string;
  className: string;
  text: string;
}

type TabType = 'tools' | 'elements';

export const DebugPanel: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('tools');

  // Tool execution state
  const [selectedTool, setSelectedTool] = useState<string>('click_element');
  const [toolArgs, setToolArgs] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<'do' | 'show'>('do');
  const [explanation, setExplanation] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<ToolExecutionResult | null>(null);

  // DOM elements state
  const [indexedElements, setIndexedElements] = useState<IndexedElement[]>([]);
  const [isIndexing, setIsIndexing] = useState(false);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsVisible((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reset args when tool changes
  useEffect(() => {
    setToolArgs({});
    setResult(null);
  }, [selectedTool]);

  // Index DOM elements
  const handleIndexDOM = useCallback(() => {
    setIsIndexing(true);
    try {
      const elements = domService.indexInteractableElements();
      const mapped: IndexedElement[] = elements.map(([index, el]) => ({
        index,
        tag: el.tagName.toLowerCase(),
        id: el.id || '',
        className: el.className?.toString().slice(0, 30) || '',
        text: el.textContent?.trim().slice(0, 40) || '',
      }));
      setIndexedElements(mapped);
    } finally {
      setIsIndexing(false);
    }
  }, []);

  // Execute tool
  const handleExecute = useCallback(async () => {
    setIsExecuting(true);
    setResult(null);

    try {
      // Parse args (convert numeric strings to numbers)
      const parsedArgs: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(toolArgs)) {
        if (value === '') continue;
        // Try to parse as number
        const num = Number(value);
        parsedArgs[key] = isNaN(num) ? value : num;
      }

      const res = await toolExecutionService.executeTool(
        selectedTool,
        parsedArgs,
        mode,
        explanation
      );
      setResult(res);
    } catch (error) {
      setResult({
        success: false,
        result: '',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsExecuting(false);
    }
  }, [selectedTool, toolArgs, mode, explanation]);

  // Highlight element
  const handleHighlightElement = useCallback((index: number) => {
    const element = domService.getElementByIndex(index);
    if (element) {
      const originalOutline = element.style.outline;
      const originalBackground = element.style.background;

      element.style.outline = '3px solid #569cd6';
      element.style.background = 'rgba(86, 156, 214, 0.2)';
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      setTimeout(() => {
        element.style.outline = originalOutline;
        element.style.background = originalBackground;
      }, 2000);
    }
  }, []);

  // Use element in tool
  const handleUseElement = useCallback((index: number) => {
    setActiveTab('tools');
    setToolArgs((prev) => ({ ...prev, index: String(index) }));
  }, []);

  if (!isVisible) return null;

  const toolParams = TOOL_PARAMS[selectedTool] || { required: [], optional: [] };
  const allParams = [...toolParams.required, ...toolParams.optional];

  return (
    <div style={styles.overlay}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>
          🔧 Debug Panel
          <span style={{ ...styles.badge, backgroundColor: '#4ec9b0' }}>DEV</span>
        </span>
        <button
          style={styles.closeBtn}
          onClick={() => setIsVisible(false)}
          title='Close (Ctrl+Shift+D)'
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button style={styles.tab(activeTab === 'tools')} onClick={() => setActiveTab('tools')}>
          Tools
        </button>
        <button
          style={styles.tab(activeTab === 'elements')}
          onClick={() => setActiveTab('elements')}
        >
          Elements {indexedElements.length > 0 && `(${indexedElements.length})`}
        </button>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {activeTab === 'tools' ? (
          <>
            {/* Tool Selector */}
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Select Tool</div>
              <select
                style={styles.select}
                value={selectedTool}
                onChange={(e) => setSelectedTool(e.target.value)}
              >
                <optgroup label='Navigation'>
                  <option value='navigate'>navigate</option>
                  <option value='search'>search</option>
                  <option value='go_back'>go_back</option>
                </optgroup>
                <optgroup label='Interaction'>
                  <option value='click_element'>click_element</option>
                  <option value='type_text'>type_text</option>
                  <option value='scroll'>scroll</option>
                  <option value='scroll_to_text'>scroll_to_text</option>
                  <option value='send_keys'>send_keys</option>
                  <option value='select_dropdown_option'>select_dropdown_option</option>
                </optgroup>
                <optgroup label='Extraction'>
                  <option value='extract'>extract</option>
                  <option value='get_html'>get_html</option>
                  <option value='get_dropdown_options'>get_dropdown_options</option>
                  <option value='get_screenshot'>get_screenshot</option>
                </optgroup>
                <optgroup label='Utility'>
                  <option value='wait'>wait</option>
                  <option value='done'>done</option>
                  <option value='close_tab'>close_tab</option>
                </optgroup>
              </select>
            </div>

            {/* Parameters */}
            {allParams.length > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>Parameters</div>
                {allParams.map((param) => (
                  <div key={param} style={styles.inputGroup}>
                    <label style={styles.label}>
                      {param}
                      {toolParams.required.includes(param) && (
                        <span style={{ color: '#f14c4c' }}> *</span>
                      )}
                    </label>
                    <input
                      style={styles.input}
                      type='text'
                      value={toolArgs[param] || ''}
                      onChange={(e) =>
                        setToolArgs((prev) => ({ ...prev, [param]: e.target.value }))
                      }
                      placeholder={getPlaceholder(param)}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Mode Toggle */}
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Mode</div>
              <div style={styles.row}>
                <button style={styles.modeBtn(mode === 'do')} onClick={() => setMode('do')}>
                  Do (Auto)
                </button>
                <button style={styles.modeBtn(mode === 'show')} onClick={() => setMode('show')}>
                  Show (Confirm)
                </button>
              </div>
              {mode === 'show' && (
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Explanation</label>
                  <input
                    style={styles.input}
                    type='text'
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    placeholder='What this action does...'
                  />
                </div>
              )}
            </div>

            {/* Execute Button */}
            <button
              style={{
                ...styles.executeBtn,
                ...(isExecuting ? styles.executeBtnDisabled : {}),
              }}
              onClick={handleExecute}
              disabled={isExecuting}
            >
              {isExecuting ? 'Executing...' : `Execute ${selectedTool}`}
            </button>

            {/* Result */}
            {result && (
              <div style={styles.result}>
                <div style={result.success ? styles.resultSuccess : styles.resultError}>
                  {result.success ? '✓ Success' : '✗ Failed'}
                </div>
                {result.result && (
                  <pre
                    style={{
                      margin: '8px 0 0 0',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      fontSize: '11px',
                    }}
                  >
                    {typeof result.result === 'string' && result.result.length > 500
                      ? `${result.result.slice(0, 500)}...`
                      : result.result}
                  </pre>
                )}
                {result.error && (
                  <div style={{ marginTop: '8px', color: '#f14c4c' }}>{result.error}</div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Index Button */}
            <button style={styles.indexBtn} onClick={handleIndexDOM} disabled={isIndexing}>
              {isIndexing ? 'Indexing...' : '🔄 Index DOM Elements'}
            </button>

            {/* Element List */}
            {indexedElements.length > 0 ? (
              <div style={styles.elementList}>
                {indexedElements.map((el) => (
                  <div
                    key={el.index}
                    style={styles.elementItem}
                    onClick={() => handleHighlightElement(el.index)}
                    onDoubleClick={() => handleUseElement(el.index)}
                    title='Click to highlight, double-click to use in tool'
                  >
                    <span style={styles.elementIndex}>{el.index}</span>
                    <span style={styles.elementTag}>&lt;{el.tag}&gt;</span>
                    {el.id && <span style={styles.elementId}>#{el.id}</span>}
                    <span style={styles.elementText}>{el.text || el.className}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#808080', textAlign: 'center', padding: '20px' }}>
                Click "Index DOM Elements" to scan the page
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Helper to get placeholder text for params
function getPlaceholder(param: string): string {
  const placeholders: Record<string, string> = {
    index: '0',
    url: 'https://example.com',
    text: 'Hello world',
    query: 'search query',
    direction: 'down | up | left | right',
    keys: 'Enter',
    option: 'Option text or value',
    seconds: '2',
    engine: 'google | bing | duckduckgo',
    new_tab: 'true | false',
    success: 'true | false',
    path: '/path/to/file',
  };
  return placeholders[param] || '';
}

export default DebugPanel;
