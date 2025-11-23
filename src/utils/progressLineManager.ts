/**
 * Progress Line Manager
 *
 * Utilities for managing progress steps in chat messages using structured objects.
 * Migrated to use MessagePart structure exclusively for state updates.
 */

import type { ChatMessage } from '../types';
import { addThinkingMarker, hasThinkingMarker } from './messageContentUtils';

/**
 * Ensure message has initialized parts
 */
function ensureMessageStructure(message: ChatMessage): ChatMessage {
  const msg = { ...message };

  // Ensure parts exist
  if (!msg.parts) {
    msg.parts = [];

    // Check if content needs to be treated as a text part
    const cleanContent = msg.content.replace(/\n\n__THINKING__$/, '').trim();
    if (cleanContent) {
      msg.parts.push({
        type: 'text',
        content: cleanContent,
      });
    }
  }

  return msg;
}

/**
 * Add a new progress step to a message
 */
export function addProgressLine(
  message: ChatMessage,
  toolName: string,
  explanation: string
): ChatMessage {
  const msg = ensureMessageStructure(message);
  const parts = msg.parts || [];

  // Update Parts
  const newParts = [...parts];
  const existingPartIndex = parts.findIndex(
    (part) => part.type === 'progress' && part.toolName === toolName && part.status === 'running'
  );

  if (existingPartIndex >= 0) {
    newParts[existingPartIndex] = {
      ...newParts[existingPartIndex],
      content: explanation,
    };
  } else {
    newParts.push({
      type: 'progress',
      content: explanation,
      status: 'running',
      toolName,
    });
  }

  return {
    ...msg,
    parts: newParts,
  };
}

/**
 * Update an existing progress step for a tool
 */
export function updateProgressLine(
  message: ChatMessage,
  toolName: string,
  status: 'pending' | 'completed' | 'failed',
  error?: string
): ChatMessage {
  const msg = ensureMessageStructure(message);
  const parts = msg.parts || [];

  // Update Parts
  const newParts = [...parts];
  const partIndex = parts
    .map((p) => (p.type === 'progress' ? p.toolName : ''))
    .lastIndexOf(toolName);

  const mappedStatus = status === 'pending' ? 'running' : status;

  if (partIndex >= 0) {
    newParts[partIndex] = {
      ...newParts[partIndex],
      status: mappedStatus,
    };

    if (status === 'failed' && error) {
      newParts[partIndex] = {
        ...newParts[partIndex],
        content: `${newParts[partIndex].content} (${error})`,
      };
    }
  } else {
    newParts.push({
      type: 'progress',
      content: `Executing ${toolName}...`,
      status: mappedStatus,
      toolName,
    });
  }

  return { ...msg, parts: newParts };
}

/**
 * Mark the last incomplete progress step as completed
 */
export function markProgressLineComplete(message: ChatMessage, toolName?: string): ChatMessage {
  const msg = ensureMessageStructure(message);
  const parts = msg.parts || [];

  // Update Parts
  const newParts = [...parts];
  let partIndex = -1;
  if (toolName) {
    partIndex = parts.map((p) => (p.type === 'progress' ? p.toolName : '')).lastIndexOf(toolName);
  } else {
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i].type === 'progress' && parts[i].status === 'running') {
        partIndex = i;
        break;
      }
    }
  }

  if (partIndex >= 0) {
    newParts[partIndex] = { ...newParts[partIndex], status: 'completed' };
  }

  return { ...msg, parts: newParts };
}

/**
 * Mark the last incomplete progress step as failed
 */
export function markProgressLineFailed(
  message: ChatMessage,
  toolName: string,
  error: string
): ChatMessage {
  const msg = ensureMessageStructure(message);
  const parts = msg.parts || [];

  // Update Parts
  const newParts = [...parts];
  let partIndex = parts.map((p) => (p.type === 'progress' ? p.toolName : '')).lastIndexOf(toolName);
  if (partIndex === -1) {
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i].type === 'progress' && parts[i].status === 'running') {
        partIndex = i;
        break;
      }
    }
  }

  if (partIndex >= 0) {
    newParts[partIndex] = {
      ...newParts[partIndex],
      status: 'failed',
      content: `${newParts[partIndex].content} (${error})`,
    };
  }

  return { ...msg, parts: newParts };
}

/**
 * Add or remove thinking marker based on task state
 */
export function updateThinkingMarker(
  message: ChatMessage,
  isTaskRunning: boolean,
  currentMode: 'show' | 'tell' | 'do'
): ChatMessage {
  const msg = ensureMessageStructure(message);

  if (!isTaskRunning || (currentMode !== 'show' && currentMode !== 'do')) {
    // Remove thinking marker
    if (hasThinkingMarker(msg.content)) {
      return {
        ...msg,
        content: msg.content.replace(/\n\n__THINKING__$/, '').replace(/__THINKING__/g, ''),
      };
    }
    return msg;
  }

  // Add thinking marker if not present
  if (!hasThinkingMarker(msg.content)) {
    return {
      ...msg,
      content: addThinkingMarker(msg.content),
    };
  }

  return msg;
}
