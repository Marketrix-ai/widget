/**
 * Message Content Utilities
 *
 * Centralized utilities for message content transformation, including:
 * - Removing thinking markers
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
