/**
 * Pure SSE reducer — the single place where a `WidgetEvent` turns into the next
 * widget state. No transport, no tool execution, no localStorage: just
 * `(state, event) => { state, effects }`. The ConversationContext effect wires
 * this up, runs the returned effects (tool exec, wsClient.send, setLoading), and
 * re-enters via the tool-progress helpers once an async tool finishes.
 *
 * Keeping this pure makes the previously-untestable ~180-line SSE handler unit
 * testable and removes the nested setState-within-setState that hid bugs.
 */
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

export interface SseSimulationState {
  activeSimulationId: string | null;
  isSimulationRunning: boolean;
}

export interface SseState {
  messages: ChatMessage[];
  task: SseSimulationState;
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
  | { type: 'setLoading'; value: boolean };

export interface ReduceResult {
  state: SseState;
  effects: SseEffect[];
}

const noChange = (state: SseState): ReduceResult => ({ state, effects: [] });

type ProgressStatus = 'in_progress' | 'completed' | 'failed';

/**
 * Apply a progress-line transition to the message that owns the active task.
 */
function applyProgress(
  messages: ChatMessage[],
  isSimulationRunning: boolean,
  currentMode: InstructionType,
  toolName: string,
  explanation: string,
  status: ProgressStatus,
  error?: string,
): ChatMessage[] {
  const friendlyName = getFriendlyToolName(toolName);
  const found = findMessageForProgress({
    messages,
    isSimulationRunning,
    currentMode,
    requireContent: status === 'failed',
  });
  if (!found) return messages;

  let updatedMsg = found.message;
  const shouldWait = isSimulationRunning && currentMode === 'show' && WAIT_FOR_USER_TOOLS.has(toolName);
  const isDoneTool = toolName === 'done';
  const isShowOrDo = currentMode === 'show' || currentMode === 'do';

  if (status === 'in_progress') {
    if (!isDoneTool) {
      updatedMsg = addProgressLine(updatedMsg, friendlyName, explanation || friendlyName);
    }
    if (isSimulationRunning && isShowOrDo) {
      updatedMsg = updateThinkingMarker(updatedMsg, isSimulationRunning, currentMode, shouldWait);
    }
  } else if (status === 'completed') {
    if (!isDoneTool) {
      updatedMsg = markProgressLineComplete(updatedMsg);
    }
    if (isSimulationRunning && isShowOrDo) {
      updatedMsg = updateThinkingMarker(updatedMsg, isSimulationRunning, currentMode, false);
    }
  } else {
    updatedMsg = markProgressLineFailed(updatedMsg, friendlyName, error || '');
    if (isSimulationRunning && isShowOrDo) {
      updatedMsg = updateThinkingMarker(updatedMsg, isSimulationRunning, currentMode, false);
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
      state.task.isSimulationRunning,
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
    isSimulationRunning: state.task.isSimulationRunning,
    currentMode,
    requireContent: false,
  });
  const messages = [...state.messages];
  if (found) {
    const updatedParts = (found.message.parts ?? []).filter(
      part => !(part.type === 'progress' && part.toolName === 'done'),
    );
    messages[found.index] = { ...found.message, simulationStatus: 'done', parts: updatedParts };
  }
  return { messages, task: { isSimulationRunning: false, activeSimulationId: null } };
}

/** Public: user-initiated stop — flag the active message `stopped` and end the task. */
export function reduceStop(state: SseState, currentMode: InstructionType): SseState {
  const found = findMessageForProgress({
    messages: state.messages,
    isSimulationRunning: state.task.isSimulationRunning,
    currentMode,
    requireContent: false,
  });
  const messages = [...state.messages];
  if (found) {
    messages[found.index] = { ...found.message, simulationStatus: 'stopped' };
  }
  return { messages, task: { isSimulationRunning: false, activeSimulationId: null } };
}

/**
 * Pure reducer. Returns the next state plus any side effects the wiring must run.
 * Unknown / non-stateful events (registered, pong, heartbeat) are ignored.
 */
export function reduceSse(state: SseState, event: WidgetEvent, currentMode: InstructionType): ReduceResult {
  switch (event.type) {
    case 'tool/call': {
      // Auto-activate the task if a tool arrives before `task/status running`.
      const task = state.task.isSimulationRunning ? state.task : { ...state.task, isSimulationRunning: true };
      const isSimulationRunning = task.isSimulationRunning;
      const mode = event.mode || currentMode || 'do';
      const explanation = event.explanation || '';
      const messages = applyProgress(
        state.messages,
        isSimulationRunning,
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
        // the active message to "waiting for you", leaving simulationStatus unset.
        const found = findMessageForProgress({
          messages: state.messages,
          isSimulationRunning: state.task.isSimulationRunning,
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
        return { state: { messages, task: { isSimulationRunning: false, activeSimulationId: null } }, effects: [] };
      }
      // completed | failed | stopped — terminal.
      const found = findMessageForProgress({
        messages: state.messages,
        isSimulationRunning: state.task.isSimulationRunning,
        currentMode,
        requireContent: false,
      });
      const messages = [...state.messages];
      if (found) {
        let simulationStatus: 'done' | 'failed' | 'stopped' = 'done';
        if (event.status === 'failed') simulationStatus = 'failed';
        else if (event.status === 'stopped') simulationStatus = 'stopped';
        messages[found.index] = {
          ...found.message,
          simulationStatus,
          ...(statusMessage && { content: statusMessage }),
        };
      }
      return { state: { messages, task: { isSimulationRunning: false, activeSimulationId: null } }, effects: [] };
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
