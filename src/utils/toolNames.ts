/**
 * Tool Name Mapping Utility
 *
 * Provides friendly display names for technical tool names.
 * Used for showing user-friendly progress updates in the chat.
 */

export const TOOL_NAME_MAPPING: Record<string, string> = {
  // Navigation & Browser
  navigate_to_url: 'Navigating to URL',
  go_back: 'Going back',
  go_forward: 'Going forward',
  refresh_page: 'Refreshing page',

  // Interaction
  click_element: 'Clicking element',
  hover_element: 'Hovering element',
  type_text: 'Typing text',
  press_key: 'Pressing key',
  select_option: 'Selecting option',
  scroll_to_element: 'Scrolling to element',

  // Information Retrieval
  get_page_content: 'Reading page content',
  get_element_text: 'Reading element text',
  get_element_attribute: 'Reading element attribute',
  take_screenshot: 'Taking screenshot',

  // Logic & Flow
  wait_for_element: 'Waiting for element',
  sleep: 'Waiting',

  // Default fallback pattern handling in getFriendlyToolName
};

/**
 * Get a friendly display name for a tool
 * Converts snake_case to Title Case if no mapping exists
 */
export function getFriendlyToolName(toolName: string): string {
  // Check explicit mapping first
  if (TOOL_NAME_MAPPING[toolName]) {
    return TOOL_NAME_MAPPING[toolName];
  }

  // Fallback: Convert snake_case or camelCase to Title Case
  // e.g. "my_custom_tool" -> "My Custom Tool"
  // e.g. "myCustomTool" -> "My Custom Tool"
  return (
    toolName
      // Insert space before capital letters (camelCase)
      .replace(/([A-Z])/g, ' $1')
      // Replace underscores with spaces (snake_case)
      .replace(/_/g, ' ')
      // Trim extra spaces
      .trim()
      // Capitalize first letter of each word
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  );
}
