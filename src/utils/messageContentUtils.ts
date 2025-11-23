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

  // Always log parsing for debugging (can be filtered in console)
  console.log('[MessageContentUtils] [FLOW] parseProgressLines', {
    originalContent: content,
    originalContentLength: content.length,
    cleanContent,
    cleanContentLength: cleanContent.length,
    partsCount: parts.length,
    mainContent: mainContent.trim(),
    mainContentLength: mainContent.trim().length,
    progressLineCount: progressLines.length,
    progressLines,
    hasProgressIndicators: content.includes('○') || content.includes('●✓'),
    hasPendingIndicator: content.includes('○'),
    hasCompletedIndicator: content.includes('●✓'),
    parts: parts.map((p, i) => ({ index: i, content: p, length: p.length })),
  });

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

  let formattedLine: string;
  switch (status) {
    case 'pending':
      formattedLine = `○ ${progressText}`;
      break;
    case 'completed':
      formattedLine = `●✓ ${progressText}`;
      break;
    case 'failed':
      formattedLine = `○ ${progressText} ✗ (${error || 'Tool execution failed'})`;
      break;
    default:
      formattedLine = `○ ${progressText}`;
  }

  console.log('[MessageContentUtils] [FORMAT] formatProgressLine', {
    toolName,
    explanation,
    status,
    progressText,
    formattedLine,
    startsWithCircle: formattedLine.trim().startsWith('○'),
    startsWithCompleted: formattedLine.trim().startsWith('●✓'),
    length: formattedLine.length,
  });

  return formattedLine;
}

/**
 * Reconstruct message content from main content and progress lines
 */
export function reconstructMessageContent(mainContent: string, progressLines: string[]): string {
  const cleanMainContent = removeThinkingMarkers(mainContent).trim();
  let reconstructed: string;

  if (progressLines.length > 0) {
    reconstructed = [cleanMainContent, ...progressLines].join('\n\n');
    console.log('[MessageContentUtils] [FORMAT] reconstructMessageContent', {
      mainContent: cleanMainContent,
      progressLineCount: progressLines.length,
      progressLines,
      reconstructed,
      hasDoubleNewline: reconstructed.includes('\n\n'),
      doubleNewlineCount: (reconstructed.match(/\n\n/g) || []).length,
      length: reconstructed.length,
    });
  } else {
    reconstructed = cleanMainContent;
    console.log('[MessageContentUtils] [FORMAT] reconstructMessageContent (no progress lines)', {
      mainContent: cleanMainContent,
      reconstructed,
    });
  }

  return reconstructed;
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
