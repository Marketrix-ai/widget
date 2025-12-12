/**
 * Development Tools - Browser Console Injection
 *
 * Exposes widget services on window object for testing in browser console.
 * Only active in development mode.
 *
 * Usage in browser console:
 *   // Index DOM first
 *   await devTools.indexDOM()
 *
 *   // Test tools
 *   await devTools.testTool('click_element', { index: 5 })
 *   await devTools.testTool('type_text', { index: 3, text: 'Hello' })
 *
 *   // Direct service access
 *   domService.getElementByIndex(5)
 *   toolExecutionService.executeTool('scroll', { direction: 'down' }, 'do')
 */

import { chatService } from '../services/ChatService';
import { domService } from '../services/DomService';
import { type ToolExecutionResult, toolExecutionService } from '../services/ToolService';
import { WebSocketClient } from '../services/WebSocketClient';

// Tool parameter definitions for reference
export const TOOL_PARAMS: Record<string, { required: string[]; optional: string[] }> = {
  navigate: { required: ['url'], optional: ['new_tab'] },
  search: { required: ['query'], optional: ['engine'] },
  click_element: { required: ['index'], optional: [] },
  type_text: { required: ['index', 'text'], optional: [] },
  scroll: { required: ['direction'], optional: [] },
  scroll_to_text: { required: ['text'], optional: [] },
  send_keys: { required: ['index', 'keys'], optional: [] },
  select_dropdown_option: { required: ['index', 'option'], optional: [] },
  get_dropdown_options: { required: ['index'], optional: [] },
  extract: { required: [], optional: [] },
  get_html: { required: [], optional: [] },
  get_screenshot: { required: [], optional: [] },
  go_back: { required: [], optional: [] },
  wait: { required: ['seconds'], optional: [] },
  close_tab: { required: [], optional: [] },
  switch_tab: { required: ['tab_index'], optional: [] },
  upload_file: { required: ['index', 'path'], optional: [] },
  done: { required: ['success'], optional: ['message'] },
};

// Dev tools helper object
export const devTools = {
  /**
   * Index all interactable DOM elements
   * Must be called before using element-based tools
   */
  indexDOM(): Array<[number, Element]> {
    const elements = domService.indexInteractableElements();
    console.log(`[DevTools] Indexed ${elements.length} interactable elements`);
    return elements;
  },

  /**
   * Get indexed elements list with details
   */
  listElements(): void {
    const elements = this.indexDOM();
    console.table(
      elements.map(([index, el]) => ({
        index,
        tag: el.tagName.toLowerCase(),
        id: el.id || '-',
        class: el.className?.toString().slice(0, 30) || '-',
        text: el.textContent?.slice(0, 30) || '-',
      }))
    );
  },

  /**
   * Highlight an element by index (for visual verification)
   */
  highlightElement(index: number, duration: number = 2000): void {
    const element = domService.getElementByIndex(index);
    if (!element) {
      console.error(`[DevTools] Element ${index} not found. Run indexDOM() first.`);
      return;
    }

    const originalOutline = element.style.outline;
    const originalBackground = element.style.background;

    element.style.outline = '3px solid red';
    element.style.background = 'rgba(255, 0, 0, 0.2)';
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    setTimeout(() => {
      element.style.outline = originalOutline;
      element.style.background = originalBackground;
    }, duration);

    console.log(`[DevTools] Highlighting element ${index}:`, element);
  },

  /**
   * Test a tool with given arguments
   */
  async testTool(
    toolName: string,
    args: Record<string, unknown> = {},
    mode: 'do' | 'show' = 'do',
    explanation: string = ''
  ): Promise<ToolExecutionResult> {
    // Validate tool exists
    if (!TOOL_PARAMS[toolName]) {
      console.error(`[DevTools] Unknown tool: ${toolName}`);
      console.log('[DevTools] Available tools:', Object.keys(TOOL_PARAMS));
      return { success: false, result: '', error: `Unknown tool: ${toolName}` };
    }

    // Check required params
    const { required } = TOOL_PARAMS[toolName];
    const missing = required.filter((param) => !(param in args));
    if (missing.length > 0) {
      console.error(`[DevTools] Missing required params for ${toolName}:`, missing);
      return { success: false, result: '', error: `Missing params: ${missing.join(', ')}` };
    }

    console.log(`[DevTools] Executing ${toolName}`, { args, mode, explanation });
    const startTime = window.performance.now();

    try {
      const result = await toolExecutionService.executeTool(toolName, args, mode, explanation);
      const duration = (window.performance.now() - startTime).toFixed(2);

      if (result.success) {
        console.log(`[DevTools] ✓ ${toolName} succeeded in ${duration}ms`, result.result);
      } else {
        console.error(`[DevTools] ✗ ${toolName} failed in ${duration}ms`, result.error);
      }

      return result;
    } catch (error) {
      console.error(`[DevTools] ✗ ${toolName} threw error:`, error);
      return { success: false, result: '', error: String(error) };
    }
  },

  /**
   * Run a sequence of tools
   */
  async runSequence(
    sequence: Array<{ tool: string; args?: Record<string, unknown>; delay?: number }>
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];

    for (let i = 0; i < sequence.length; i++) {
      const { tool, args = {}, delay = 500 } = sequence[i];
      console.log(`[DevTools] Step ${i + 1}/${sequence.length}: ${tool}`);

      const result = await this.testTool(tool, args);
      results.push(result);

      if (!result.success) {
        console.error(`[DevTools] Sequence stopped at step ${i + 1} due to failure`);
        break;
      }

      if (i < sequence.length - 1 && delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return results;
  },

  /**
   * Get WebSocket connection status
   */
  getConnectionStatus(): string {
    const wsClient = WebSocketClient.getInstance();
    return wsClient.getStatus();
  },

  /**
   * Get chat messages
   */
  getMessages() {
    return chatService.getMessages();
  },

  /**
   * Clear chat history
   */
  clearChat(): void {
    chatService.clearMessages();
    console.log('[DevTools] Chat history cleared');
  },

  /**
   * Print help
   */
  help(): void {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                    DevTools Help                           ║
╠════════════════════════════════════════════════════════════╣
║ devTools.indexDOM()           - Index all DOM elements     ║
║ devTools.listElements()       - List indexed elements      ║
║ devTools.highlightElement(i)  - Highlight element by index ║
║ devTools.testTool(name, args) - Execute a tool             ║
║ devTools.runSequence([...])   - Run tool sequence          ║
║ devTools.getConnectionStatus()- WebSocket status           ║
║ devTools.getMessages()        - Get chat messages          ║
║ devTools.clearChat()          - Clear chat history         ║
║ devTools.help()               - Show this help             ║
╠════════════════════════════════════════════════════════════╣
║ Direct service access:                                     ║
║   domService, toolExecutionService, chatService            ║
╠════════════════════════════════════════════════════════════╣
║ Example:                                                   ║
║   devTools.indexDOM()                                      ║
║   devTools.testTool('click_element', { index: 5 })         ║
║   devTools.testTool('type_text', { index: 3, text: 'Hi' }) ║
╚════════════════════════════════════════════════════════════╝
    `);
  },
};

/**
 * Initialize dev tools - expose on window object
 */
export function initDevTools(): void {
  if (typeof window === 'undefined') return;

  // Expose services
  (window as any).domService = domService;
  (window as any).toolExecutionService = toolExecutionService;
  (window as any).chatService = chatService;
  (window as any).WebSocketClient = WebSocketClient;

  // Expose dev tools helper
  (window as any).devTools = devTools;

  console.log(`
╔════════════════════════════════════════════════════════════╗
║           Marketrix Widget DevTools Loaded                 ║
║                                                            ║
║  Type devTools.help() for available commands               ║
╚════════════════════════════════════════════════════════════╝
  `);
}
