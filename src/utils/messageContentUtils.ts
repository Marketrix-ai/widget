/**
 * Message Content Utilities
 *
 * Centralized utilities for message content transformation, including:
 * - Removing thinking markers
 * - Migrating legacy content string to structured progress steps (Legacy Support)
 */

import type { ChatMessage, ProgressStep } from '../types';

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
 * Parse progress lines from legacy string content
 * @deprecated Only used for migration of old messages in ensureMessageStructure
 */
export function parseProgressSteps(content: string): {
  mainContent: string;
  progressSteps: ProgressStep[];
} {
  const cleanContent = removeThinkingMarkers(content);
  const parts = cleanContent.split('\n\n');
  const mainContentParts: string[] = [];
  const progressSteps: ProgressStep[] = [];

  parts.forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) return;

    // Check for progress indicators
    if (trimmed.startsWith('○') || trimmed.startsWith('●✓')) {
      const isPending = trimmed.startsWith('○');
      // Remove indicators
      let text = trimmed
        .replace(/^●✓\s*/, '')
        .replace(/^○\s*/, '')
        .replace(/^●\s*/, '')
        .replace(/^✓\s*/, '')
        .trim();

      // Extract error if present: "text ✗ (error)"
      let error: string | undefined;
      const errorMatch = text.match(/(.*)\s*✗\s*\((.*)\)$/);

      let status: 'pending' | 'completed' | 'failed' = isPending ? 'pending' : 'completed';

      if (errorMatch) {
        text = errorMatch[1].trim();
        error = errorMatch[2].trim();
        status = 'failed';
      }

      // Extract tool name and explanation
      let tool = 'unknown';
      const explanation = text;

      const execMatch = text.match(/^Executing\s+(.+?)\.\.\.$/);
      if (execMatch) {
        tool = execMatch[1];
      } else {
        tool = text.split(' ')[0] || 'tool';
      }

      progressSteps.push({
        tool,
        status,
        explanation,
        error,
      });
    } else {
      mainContentParts.push(part);
    }
  });

  return {
    mainContent: mainContentParts.join('\n\n').trim(),
    progressSteps,
  };
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
  if (hasThinkingMarker(content)) return content;
  return `${content}\n\n__THINKING__`;
}

/**
 * Find the index of the last task message (agent message that's not system/placeholder/screen access)
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
 * Check if message has progress lines (either structured or legacy string)
 * @deprecated Use message.parts structure check instead
 */
export function hasProgressLines(contentOrMessage: string | ChatMessage): boolean {
  if (typeof contentOrMessage === 'string') {
    const cleanContent = removeThinkingMarkers(contentOrMessage);
    return cleanContent.includes('○') || cleanContent.includes('●✓');
  }

  // If ChatMessage, check parts first
  if (contentOrMessage.parts?.some((p) => p.type === 'progress')) {
    return true;
  }

  // Fallback to progressSteps
  if (contentOrMessage.progressSteps && contentOrMessage.progressSteps.length > 0) {
    return true;
  }

  // Fallback to checking content string
  const cleanContent = removeThinkingMarkers(contentOrMessage.content);
  return cleanContent.includes('○') || cleanContent.includes('●✓');
}
