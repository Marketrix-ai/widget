// Pure SSE reducer `(state, event) => { state, effects }` — no transport/tool-exec/storage (ChatContext wires it up); pure so it stays unit-testable.
import type { WidgetEvent } from '../sdk';
import type { ChatMessage, InstructionType } from '../types';
import {
  addProgressLine,
  findMessageForProgress,
  getFriendlyToolName,
  markProgressLineComplete,
  markProgressLineFailed,
  updateThinkingMarker,
  WAIT_FOR_USER_TOOLS,
} from '../utils/chat';

export interface SseTaskState {
  activeTaskId: string | null;
  isTaskRunning: boolean;
}

export interface SseState {
  messages: ChatMessage[];
  task: SseTaskState;
}

/** Side effects the wiring layer must run after applying a reduced state. */
export type SseEffect =
  | {
      type: 'executeTool';
      toolCallId: string;
      tool: string;
      args: Record<string, unknown>;
      mode: InstructionType;
      explanation: string;
    }
  | { type: 'setLoading'; value: boolean };

export interface ReduceResult {
  state: SseState;
  effects: SseEffect[];
}

const noChange = (state: SseState): ReduceResult => ({ state, effects: [] });

type ProgressStatus = 'in_progress' | 'completed' | 'failed';

function applyProgress(
  messages: ChatMessage[],
  isTaskRunning: boolean,
  currentMode: InstructionType,
  browserToolName: string,
  explanation: string,
  status: ProgressStatus,
  error?: string,
): ChatMessage[] {
  const friendlyName = getFriendlyToolName(browserToolName);
  const found = findMessageForProgress({
    messages,
    isTaskRunning,
    currentMode,
    requireContent: status === 'failed',
  });
  if (!found) return messages;

  let updatedMsg = found.message;
  const shouldWait = isTaskRunning && currentMode === 'show' && WAIT_FOR_USER_TOOLS.has(browserToolName);
  const isDoneTool = browserToolName === 'done';
  const isShowOrDo = currentMode === 'show' || currentMode === 'do';

  if (status === 'in_progress') {
    if (!isDoneTool) {
      updatedMsg = addProgressLine(updatedMsg, friendlyName, explanation || friendlyName);
    }
    if (isTaskRunning && isShowOrDo) {
      updatedMsg = updateThinkingMarker(updatedMsg, isTaskRunning, currentMode, shouldWait);
    }
  } else if (status === 'completed') {
    if (!isDoneTool) {
      updatedMsg = markProgressLineComplete(updatedMsg);
    }
    if (isTaskRunning && isShowOrDo) {
      updatedMsg = updateThinkingMarker(updatedMsg, isTaskRunning, currentMode, false);
    }
  } else {
    updatedMsg = markProgressLineFailed(updatedMsg, friendlyName, error || '');
    if (isTaskRunning && isShowOrDo) {
      updatedMsg = updateThinkingMarker(updatedMsg, isTaskRunning, currentMode, false);
    }
  }

  const next = [...messages];
  next[found.index] = updatedMsg;
  return next;
}

export function reduceToolProgress(
  state: SseState,
  browserToolName: string,
  explanation: string,
  status: ProgressStatus,
  currentMode: InstructionType,
  error?: string,
): SseState {
  return {
    ...state,
    messages: applyProgress(
      state.messages,
      state.task.isTaskRunning,
      currentMode,
      browserToolName,
      explanation,
      status,
      error,
    ),
  };
}

// Terminal `done` tool — strip the in-flight `done` progress line and end the task.
export function reduceToolDone(state: SseState, currentMode: InstructionType): SseState {
  const found = findMessageForProgress({
    messages: state.messages,
    isTaskRunning: state.task.isTaskRunning,
    currentMode,
    requireContent: false,
  });
  const messages = [...state.messages];
  if (found) {
    const updatedParts = (found.message.parts ?? []).filter(
      part => !(part.type === 'progress' && part.browserToolName === 'done'),
    );
    messages[found.index] = { ...found.message, taskStatus: 'done', parts: updatedParts };
  }
  return { messages, task: { isTaskRunning: false, activeTaskId: null } };
}

// User-initiated stop — flag the active message `stopped` and end the task.
export function reduceStop(state: SseState, currentMode: InstructionType): SseState {
  const found = findMessageForProgress({
    messages: state.messages,
    isTaskRunning: state.task.isTaskRunning,
    currentMode,
    requireContent: false,
  });
  const messages = [...state.messages];
  if (found) {
    messages[found.index] = { ...found.message, taskStatus: 'stopped' };
  }
  return { messages, task: { isTaskRunning: false, activeTaskId: null } };
}

// Returns next state + effects. Unknown / non-stateful events (registered, heartbeat) are ignored.
export function reduceSse(state: SseState, event: WidgetEvent, currentMode: InstructionType): ReduceResult {
  switch (event.type) {
    case 'tool/call': {
      // Auto-activate the task if a tool arrives before `task/status running`.
      const task = state.task.isTaskRunning ? state.task : { ...state.task, isTaskRunning: true };
      const isTaskRunning = task.isTaskRunning;
      const mode = event.mode || currentMode || 'do';
      const explanation = event.explanation || '';
      const messages = applyProgress(
        state.messages,
        isTaskRunning,
        currentMode,
        event.browser_tool,
        explanation,
        'in_progress',
      );
      return {
        state: { messages, task },
        effects: [
          {
            type: 'executeTool',
            toolCallId: event.tool_call_id,
            tool: event.browser_tool,
            args: event.args,
            mode,
            explanation,
          },
        ],
      };
    }

    case 'task/status': {
      const statusMessage = event.message || '';
      if (event.status === 'running') {
        // Activation is gated on API task_id + agentRunning, tracked in the wiring (pendingTaskRef).
        return noChange(state);
      }
      if (event.status === 'has_question') {
        // Paused awaiting a user answer — not terminal. Stop spinner, flip to "waiting for you".
        const found = findMessageForProgress({
          messages: state.messages,
          isTaskRunning: state.task.isTaskRunning,
          currentMode,
          requireContent: false,
        });
        const messages = [...state.messages];
        if (found) {
          const cleared = updateThinkingMarker(found.message, false, currentMode);
          messages[found.index] = {
            ...cleared,
            placeholderState: 'waiting-for-user',
            ...(statusMessage && { content: statusMessage }),
          };
        }
        return { state: { messages, task: { isTaskRunning: false, activeTaskId: null } }, effects: [] };
      }
      // completed | failed | stopped — terminal.
      const found = findMessageForProgress({
        messages: state.messages,
        isTaskRunning: state.task.isTaskRunning,
        currentMode,
        requireContent: false,
      });
      const messages = [...state.messages];
      if (found) {
        let taskStatus: 'done' | 'failed' | 'stopped' = 'done';
        if (event.status === 'failed') taskStatus = 'failed';
        else if (event.status === 'stopped') taskStatus = 'stopped';
        messages[found.index] = {
          ...found.message,
          taskStatus,
          ...(statusMessage && { content: statusMessage }),
        };
      }
      return { state: { messages, task: { isTaskRunning: false, activeTaskId: null } }, effects: [] };
    }

    case 'chat/delta': {
      const messages = state.messages.map(msg => {
        if (msg.id !== event.request_id) return msg;
        const parts = [...(msg.parts ?? [])];
        const last = parts[parts.length - 1];
        let streamed: string;
        if (last?.type === 'text' && last.streaming) {
          streamed = last.content + event.text;
          parts[parts.length - 1] = { ...last, content: streamed };
        } else {
          streamed = event.text;
          parts.push({ type: 'text' as const, content: streamed, streaming: true });
        }
        return { ...msg, content: streamed, isPlaceholder: false, placeholderState: undefined, parts };
      });
      return { state: { ...state, messages }, effects: [] };
    }

    case 'chat/response': {
      const messages = state.messages.map(msg => {
        if (msg.id !== event.request_id) return msg;
        // Final full text REPLACES an in-flight streamed part (chat/delta accumulation), else appends its own.
        const parts = [...(msg.parts ?? [])];
        const last = parts[parts.length - 1];
        if (last?.type === 'text' && last.streaming) {
          parts[parts.length - 1] = { type: 'text' as const, content: event.text };
        } else {
          parts.push({ type: 'text' as const, content: event.text });
        }
        return {
          ...msg,
          content: event.text,
          isPlaceholder: false,
          placeholderState: undefined,
          parts,
        };
      });
      const effects: SseEffect[] = [{ type: 'setLoading', value: false }];
      return { state: { ...state, messages }, effects };
    }

    case 'chat/error': {
      const messages = state.messages.map(msg => {
        if (msg.id !== event.request_id) return msg;
        const errorMessage = `Error: ${event.error}`;
        const newParts = [...(msg.parts ?? []), { type: 'text' as const, content: errorMessage }];
        return { ...msg, content: errorMessage, isPlaceholder: false, placeholderState: undefined, parts: newParts };
      });
      return { state: { ...state, messages }, effects: [{ type: 'setLoading', value: false }] };
    }

    default:
      return noChange(state);
  }
}
