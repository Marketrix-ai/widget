/**
 * Message Content Utilities
 *
 * Centralized utilities for message content transformation, including:
 * - Removing thinking markers
 * - Parsing and formatting progress lines
 * - Reconstructing message content
 * - Finding task messages
 */

import type { ChatMessage } from '../types';

/**
 * Remove all __THINKING__ markers from message content
 */
export function removeThinkingMarkers(content: string): string {
  return content.replace(/__THINKING__/g, '');
}

/**
 * Remove thinking marker from end of content (for display)
 */
export function removeThinkingMarkerFromEnd(content: string): string {
  return content.replace(/\n\n__THINKING__$/, '').replace(/__THINKING__/g, '');
}

/**
 * Parse message content into main content and progress lines
 * Progress lines are separated by \n\n and start with ○ or ●✓
 */
export function parseProgressLines(content: string): {
  mainContent: string;
  progressLines: string[];
} {
  const cleanContent = removeThinkingMarkers(content);
  const parts = cleanContent.split('\n\n');
  const mainContent = parts[0] || '';
  const progressLines = parts
    .slice(1)
    .filter((line) => line.trim().length > 0 && !line.trim().includes('__THINKING__'));

  return {
    mainContent: mainContent.trim(),
    progressLines,
  };
}

/**
 * Format a progress line with the appropriate status indicator
 */
export function formatProgressLine(
  toolName: string,
  explanation: string,
  status: 'pending' | 'completed' | 'failed',
  error?: string
): string {
  const progressText = explanation || `Executing ${toolName}...`;

  switch (status) {
    case 'pending':
      return `○ ${progressText}`;
    case 'completed':
      return `●✓ ${progressText}`;
    case 'failed':
      return `○ ${progressText} ✗ (${error || 'Tool execution failed'})`;
    default:
      return `○ ${progressText}`;
  }
}

/**
 * Reconstruct message content from main content and progress lines
 */
export function reconstructMessageContent(mainContent: string, progressLines: string[]): string {
  const cleanMainContent = removeThinkingMarkers(mainContent).trim();
  if (progressLines.length > 0) {
    return [cleanMainContent, ...progressLines].join('\n\n');
  }
  return cleanMainContent;
}

/**
 * Find the index of the last task message (agent message that's not system/placeholder/screen access)
 * Returns -1 if not found
 */
export function findTaskMessageIndex(messages: ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (
      msg.sender === 'agent' &&
      !msg.isSystemMessage &&
      !msg.isScreenAccessRequest &&
      !msg.isPlaceholder
    ) {
      return i;
    }
  }
  return -1;
}

/**
 * Check if content has progress lines (○ or ●✓ indicators)
 */
export function hasProgressLines(content: string): boolean {
  const cleanContent = removeThinkingMarkers(content);
  return cleanContent.includes('○') || cleanContent.includes('●✓');
}

/**
 * Check if content has thinking marker
 */
export function hasThinkingMarker(content: string): boolean {
  return content.includes('__THINKING__');
}

/**
 * Add thinking marker to content
 */
export function addThinkingMarker(content: string): string {
  return `${content}\n\n__THINKING__`;
}

/**
 * Find the last incomplete progress line index (starts with ○ but not ●✓)
 */
export function findLastIncompleteProgressLineIndex(progressLines: string[]): number {
  for (let i = progressLines.length - 1; i >= 0; i--) {
    const line = progressLines[i];
    if (line.trim().startsWith('○') && !line.trim().startsWith('●✓')) {
      return i;
    }
  }
  return -1;
}

/**
 * Find progress line index by tool name
 */
export function findProgressLineIndexByToolName(progressLines: string[], toolName: string): number {
  return progressLines.findIndex(
    (line) =>
      (line.trim().startsWith('○') || line.trim().startsWith('●✓')) && line.includes(toolName)
  );
}
