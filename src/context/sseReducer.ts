/**
 * Pure SSE reducer — the single place where a `WidgetEvent` turns into the next
 * widget state. No transport, no tool execution, no localStorage: just
 * `(state, event) => { state, effects }`. The TaskContext effect wires this up,
 * runs the returned effects (tool exec, wsClient.send, setLoading), and re-enters
 * via `applyToolResult` once an async tool finishes.
 *
 * Keeping this pure makes the previously-untestable ~180-line SSE handler unit
 * testable and removes the nested setState-within-setState that hid bugs.
 */
import type { WidgetEvent } from '../sdk/schema';
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
      callId: string;
      tool: string;
      args: Record<string, unknown>;
      mode: InstructionType;
      explanation: string;
    }
  | { type: 'setLoading'; value: boolean }
  | { type: 'activateApiTask'; taskId: string };

export interface ReduceResult {
  state: SseState;
  effects: SseEffect[];
}

const noChange = (state: SseState): ReduceResult => ({ state, effects: [] });

type ProgressStatus = 'in_progress' | 'completed' | 'failed';

/**
 * Apply a progress-line transition to the message that owns the active task.
 * Mirrors the original `updateProgressForTool` body verbatim.
 */
function applyProgress(
  messages: ChatMessage[],
  isTaskRunning: boolean,
  currentMode: InstructionType,
  toolName: string,
  explanation: string,
  status: ProgressStatus,
  error?: string,
): ChatMessage[] {
  const friendlyName = getFriendlyToolName(toolName);
  const found = findMessageForProgress({
    messages,
    isTaskRunning,
    currentMode,
    requireContent: status === 'failed',
  });
  if (!found) return messages;

  let updatedMsg = found.message;
  const shouldWait = isTaskRunning && currentMode === 'show' && WAIT_FOR_USER_TOOLS.has(toolName);
  const isDoneTool = toolName === 'done';
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

/** Public: progress transition used by the wiring layer for tool lifecycle. */
export function reduceToolProgress(
  state: SseState,
  toolName: string,
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
      toolName,
      explanation,
      status,
      error,
    ),
  };
}

/** Public: terminal `done` tool — strip the in-flight `done` progress line and end the task. */
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
      part => !(part.type === 'progress' && part.toolName === 'done'),
    );
    messages[found.index] = { ...found.message, taskStatus: 'done', parts: updatedParts };
  }
  return { messages, task: { isTaskRunning: false, activeTaskId: null } };
}

/** Public: user-initiated stop — flag the active message `stopped` and end the task. */
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

/**
 * Pure reducer. Returns the next state plus any side effects the wiring must run.
 * Unknown / non-stateful events (registered, pong, heartbeat) are ignored.
 */
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
        event.tool,
        explanation,
        'in_progress',
      );
      return {
        state: { messages, task },
        effects: [
          { type: 'executeTool', callId: event.call_id, tool: event.tool, args: event.args, mode, explanation },
        ],
      };
    }

    case 'task/status': {
      const statusMessage = event.message || '';
      if (event.status === 'running') {
        // Activation is gated on both the API task_id and `agentRunning` being
        // present — that bookkeeping lives in the wiring (pendingTaskRef), so the
        // pure reducer leaves state untouched here.
        return noChange(state);
      }
      if (event.status === 'has_question') {
        // Paused awaiting a user answer — not terminal. Stop the spinner and flip
        // the active message to "waiting for you", leaving taskStatus unset.
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

    case 'chat/response': {
      const messages = state.messages.map(msg => {
        if (msg.id !== event.request_id) return msg;
        const newParts = [...(msg.parts ?? []), { type: 'text' as const, content: event.text }];
        return {
          ...msg,
          content: event.text,
          isPlaceholder: false,
          placeholderState: undefined,
          parts: newParts,
          ...(event.task_id && { taskId: event.task_id }),
        };
      });
      const effects: SseEffect[] = [{ type: 'setLoading', value: false }];
      if (event.task_id) effects.push({ type: 'activateApiTask', taskId: event.task_id });
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
