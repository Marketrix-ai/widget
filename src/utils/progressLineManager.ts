/**
 * Progress Line Manager
 *
 * Utilities for managing progress steps in chat messages using structured objects.
 */

import type { ChatMessage } from '../types';
import { addThinkingMarker, hasThinkingMarker, parseProgressSteps } from './messageContentUtils';

/**
 * Ensure message has initialized progressSteps and parts
 */
function ensureMessageStructure(message: ChatMessage): ChatMessage {
  let msg = { ...message };

  // Ensure progressSteps
  if (!msg.progressSteps) {
    const { mainContent, progressSteps } = parseProgressSteps(msg.content);
    msg = {
      ...msg,
      content: mainContent + (hasThinkingMarker(msg.content) ? '\n\n__THINKING__' : ''),
      progressSteps,
    };
  }

  // Ensure parts
  if (!msg.parts) {
    msg.parts = [];
    // If we have progressSteps but no parts, migrate them
    if (msg.progressSteps && msg.progressSteps.length > 0) {
      // Add initial text content as a part if exists
      const cleanContent = msg.content.replace(/\n\n__THINKING__$/, '').trim();
      if (cleanContent) {
        msg.parts.push({
          type: 'text',
          content: cleanContent,
        });
      }
      // Add progress steps as parts
      msg.progressSteps.forEach((step) => {
        if (msg.parts) {
          msg.parts.push({
            type: 'progress',
            content: step.explanation || `Executing ${step.tool}...`,
            status: step.status === 'pending' ? 'running' : step.status,
            toolName: step.tool,
          });
        }
      });
    } else if (msg.content) {
      const cleanContent = msg.content.replace(/\n\n__THINKING__$/, '').trim();
      if (cleanContent) {
        msg.parts.push({
          type: 'text',
          content: cleanContent,
        });
      }
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
  const steps = msg.progressSteps || [];
  const parts = msg.parts || [];

  // Update ProgressSteps (Legacy)
  const newSteps = [...steps];
  const existingStepIndex = steps.findIndex(
    (step) => step.tool === toolName && step.status === 'pending'
  );

  if (existingStepIndex >= 0) {
    newSteps[existingStepIndex] = {
      ...newSteps[existingStepIndex],
      explanation,
    };
  } else {
    newSteps.push({
      tool: toolName,
      status: 'pending',
      explanation,
    });
  }

  // Update Parts (New)
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
    progressSteps: newSteps,
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
  const steps = msg.progressSteps || [];
  const parts = msg.parts || [];

  // Update ProgressSteps (Legacy)
  const newSteps = [...steps];
  const stepIndex = steps.map((s) => s.tool).lastIndexOf(toolName);

  if (stepIndex >= 0) {
    newSteps[stepIndex] = {
      ...newSteps[stepIndex],
      status,
      error,
    };
  } else {
    // If not found, add it (fallback)
    newSteps.push({
      tool: toolName,
      status,
      explanation: `Executing ${toolName}...`,
      error,
    });
  }

  // Update Parts (New)
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
    // Append error to content if failed? Or keep separate?
    // MessagePart doesn't have error field in previous step definition, let's verify.
    // I defined MessagePart with status, content, toolName.
    // Error is usually part of content for failed steps in UI display logic often.
    // But let's check if I should update content to include error.
    if (status === 'failed' && error) {
      // Append error to content if not already there?
      // Actually, the UI usually handles display.
      // But for `parts`, let's append it to content for now as simple solution
      // or rely on the UI to handle failed status.
      // The previous implementation of `markProgressLineFailed` added error to legacy string.
    }
  } else {
    newParts.push({
      type: 'progress',
      content: `Executing ${toolName}...`,
      status: mappedStatus,
      toolName,
    });
  }

  return { ...msg, progressSteps: newSteps, parts: newParts };
}

/**
 * Mark the last incomplete progress step as completed
 */
export function markProgressLineComplete(message: ChatMessage, toolName?: string): ChatMessage {
  const msg = ensureMessageStructure(message);
  const steps = msg.progressSteps || [];
  const parts = msg.parts || [];

  // Update ProgressSteps (Legacy)
  const newSteps = [...steps];
  let stepIndex = -1;
  if (toolName) {
    stepIndex = steps.map((s) => s.tool).lastIndexOf(toolName);
  } else {
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i].status === 'pending') {
        stepIndex = i;
        break;
      }
    }
  }

  if (stepIndex >= 0) {
    newSteps[stepIndex] = { ...newSteps[stepIndex], status: 'completed' };
  }

  // Update Parts (New)
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

  return { ...msg, progressSteps: newSteps, parts: newParts };
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
  const steps = msg.progressSteps || [];
  const parts = msg.parts || [];

  // Update ProgressSteps (Legacy)
  const newSteps = [...steps];
  let stepIndex = steps.map((s) => s.tool).lastIndexOf(toolName);
  if (stepIndex === -1) {
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i].status === 'pending') {
        stepIndex = i;
        break;
      }
    }
  }

  if (stepIndex >= 0) {
    newSteps[stepIndex] = { ...newSteps[stepIndex], status: 'failed', error };
  }

  // Update Parts (New)
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
      // Append error to content for visibility if needed, or rely on UI
      content: `${newParts[partIndex].content} (${error})`,
    };
  }

  return { ...msg, progressSteps: newSteps, parts: newParts };
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
