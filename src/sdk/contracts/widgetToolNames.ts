/**
 * The browser tools the widget runs on the agent's behalf: `WIDGET_TOOL_NAMES`, the one tuple every tool name
 * check reads. It imports neither zod nor oRPC, so the widget bundle can check a stored tool name for free.
 */
export const WIDGET_TOOL_NAMES = [
  'get_html',
  'get_screenshot',
  'click_element',
  'navigate',
  'type_text',
  'scroll',
  'scroll_to_text',
  'extract',
  'go_back',
  'send_keys',
  'close_tab',
  'select_dropdown_option',
  'get_dropdown_options',
  'wait',
  'search',
  'done',
] as const;
