/**
 * Progress Line Manager
 *
 * Utilities for managing progress lines in chat messages.
 * Progress lines show tool execution status with ○ (pending) and ●✓ (completed) indicators.
 */

import type { ChatMessage } from '../types';
import {
  addThinkingMarker,
  findLastIncompleteProgressLineIndex,
  findProgressLineIndexByToolName,
  formatProgressLine,
  hasProgressLines,
  hasThinkingMarker,
  parseProgressLines,
  reconstructMessageContent,
  removeThinkingMarkers,
} from './messageContentUtils';

/**
 * Add a new progress line to a message
 */
export function addProgressLine(
  message: ChatMessage,
  toolName: string,
  explanation: string
): ChatMessage {
  const { mainContent, progressLines } = parseProgressLines(message.content);

  // Check if this tool already has a progress line
  const existingIndex = findProgressLineIndexByToolName(progressLines, toolName);

  const progressLine = formatProgressLine(toolName, explanation, 'pending');
  const updatedProgressLines = [...progressLines];

  if (existingIndex >= 0) {
    // Update existing line
    updatedProgressLines[existingIndex] = progressLine;
  } else {
    // Add new line
    updatedProgressLines.push(progressLine);
  }

  const updatedContent = reconstructMessageContent(mainContent, updatedProgressLines);

  return {
    ...message,
    content: updatedContent,
  };
}

/**
 * Update an existing progress line for a tool
 */
export function updateProgressLine(
  message: ChatMessage,
  toolName: string,
  status: 'pending' | 'completed' | 'failed',
  error?: string
): ChatMessage {
  const { mainContent, progressLines } = parseProgressLines(message.content);
  const toolIndex = findProgressLineIndexByToolName(progressLines, toolName);

  if (toolIndex >= 0) {
    const existingLine = progressLines[toolIndex];
    // Extract explanation from existing line (remove status indicators)
    // Handle "●✓" as a sequence first, then individual characters
    const explanation = existingLine
      .replace(/^●✓\s*/, '') // Remove "●✓" sequence first
      .replace(/^○\s*/, '') // Then remove "○"
      .replace(/^●\s*/, '') // Then remove "●" if any
      .replace(/^✓\s*/, '') // Then remove "✓" if any
      .replace(/\s*✗\s*\([^)]*\)$/, '') // Remove error markers
      .trim();

    const updatedProgressLines = [...progressLines];
    updatedProgressLines[toolIndex] = formatProgressLine(toolName, explanation, status, error);

    const updatedContent = reconstructMessageContent(mainContent, updatedProgressLines);

    return {
      ...message,
      content: updatedContent,
    };
  }

  // If tool not found, add it as pending
  return addProgressLine(message, toolName, `Executing ${toolName}...`);
}

/**
 * Mark the last incomplete progress line as completed
 */
export function markProgressLineComplete(message: ChatMessage, toolName?: string): ChatMessage {
  const { mainContent, progressLines } = parseProgressLines(message.content);

  if (progressLines.length === 0) {
    return message;
  }

  let indexToUpdate = -1;

  if (toolName) {
    // Find by tool name
    indexToUpdate = findProgressLineIndexByToolName(progressLines, toolName);
  } else {
    // Find last incomplete line
    indexToUpdate = findLastIncompleteProgressLineIndex(progressLines);
  }

  if (indexToUpdate >= 0) {
    const lastLine = progressLines[indexToUpdate];
    // Extract explanation from existing line
    // Handle "●✓" as a sequence first, then individual characters
    const explanation = lastLine
      .replace(/^●✓\s*/, '') // Remove "●✓" sequence first
      .replace(/^○\s*/, '') // Then remove "○"
      .replace(/^●\s*/, '') // Then remove "●" if any
      .replace(/^✓\s*/, '') // Then remove "✓" if any
      .replace(/\s*✗\s*\([^)]*\)$/, '') // Remove error markers
      .trim();

    // Replace ○ with ●✓
    const updatedLastLine = lastLine.trim().startsWith('○')
      ? lastLine.replace(/^○\s*/, '●✓ ')
      : `●✓ ${explanation}`;

    const updatedProgressLines = [
      ...progressLines.slice(0, indexToUpdate),
      updatedLastLine,
      ...progressLines.slice(indexToUpdate + 1),
    ];

    const updatedContent = reconstructMessageContent(mainContent, updatedProgressLines);

    return {
      ...message,
      content: updatedContent,
    };
  }

  return message;
}

/**
 * Mark the last incomplete progress line as failed
 */
export function markProgressLineFailed(
  message: ChatMessage,
  toolName: string,
  error: string
): ChatMessage {
  const { mainContent, progressLines } = parseProgressLines(message.content);

  if (progressLines.length === 0) {
    return message;
  }

  const indexToUpdate = findProgressLineIndexByToolName(progressLines, toolName);

  if (indexToUpdate >= 0) {
    const lastLine = progressLines[indexToUpdate];
    const updatedLastLine = `${lastLine} ✗ (${error})`;

    const updatedProgressLines = [
      ...progressLines.slice(0, indexToUpdate),
      updatedLastLine,
      ...progressLines.slice(indexToUpdate + 1),
    ];

    const updatedContent = reconstructMessageContent(mainContent, updatedProgressLines);

    return {
      ...message,
      content: updatedContent,
    };
  }

  return message;
}

/**
 * Add or remove thinking marker based on task state and progress lines
 */
export function updateThinkingMarker(
  message: ChatMessage,
  isTaskRunning: boolean,
  currentMode: 'show' | 'tell' | 'do'
): ChatMessage {
  // Only add thinking marker for show/do modes when task is running
  if (!isTaskRunning || (currentMode !== 'show' && currentMode !== 'do')) {
    // Remove thinking marker if present
    if (hasThinkingMarker(message.content)) {
      return {
        ...message,
        content: message.content.replace(/\n\n__THINKING__$/, '').replace(/__THINKING__/g, ''),
      };
    }
    return message;
  }

  // Check if we need to add or remove thinking marker
  const cleanContent = removeThinkingMarkers(message.content);
  const hasProgress = hasProgressLines(cleanContent);
  const hasThinking = hasThinkingMarker(message.content);

  // For show/do modes with task running:
  // - If there are progress lines, show both progress AND thinking (agent is still processing)
  // - If no progress lines yet, show thinking marker
  // - Only remove thinking when task completes (handled by the outer condition)
  if (!hasProgress && !hasThinking) {
    // Add thinking marker if no progress lines and no marker exists
    return {
      ...message,
      content: addThinkingMarker(message.content),
    };
  } else if (hasProgress && !hasThinking) {
    // Add thinking marker alongside progress lines (agent is still processing)
    return {
      ...message,
      content: addThinkingMarker(message.content),
    };
  }
  // If hasThinking is already true, keep it (whether or not progress exists)

  return message;
}
