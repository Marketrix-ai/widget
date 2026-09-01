import type { WidgetEvent } from '../sdk';
import type { ChatMessage, InstructionType, MessagePart } from '../types';
import {
  addProgressLine,
  findMessageForProgress,
  getFriendlyToolName,
  markProgressLineComplete,
  markProgressLineFailed,
  updateThinkingMarker,
  WAIT_FOR_USER_TOOLS,
} from '../utils/chat';

export interface TaskState {
  activeTaskId: string | null;
  isTaskRunning: boolean;
}

export interface SseState {
  messages: ChatMessage[];
  task: TaskState;
}

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

/** The four terminal/pause transitions all stamp the progress message and clear the task; only the stamp differs. */
function stampProgressMessage(
  state: SseState,
  currentMode: InstructionType,
  stamp: (msg: ChatMessage) => ChatMessage,
): SseState {
  const found = findMessageForProgress({
    messages: state.messages,
    isTaskRunning: state.task.isTaskRunning,
    currentMode,
    requireContent: false,
  });
  const messages = [...state.messages];
  if (found) messages[found.index] = stamp(found.message);
  return { messages, task: { isTaskRunning: false, activeTaskId: null } };
}

export function reduceToolDone(state: SseState, currentMode: InstructionType): SseState {
  return stampProgressMessage(state, currentMode, msg => ({ ...msg, taskStatus: 'done' }));
}

export function reduceStop(state: SseState, currentMode: InstructionType): SseState {
  return stampProgressMessage(state, currentMode, msg => ({ ...msg, taskStatus: 'stopped' }));
}

const TASK_STATUS = { completed: 'done', failed: 'failed', stopped: 'stopped' } as const;

function reduceText(state: SseState, requestId: string, text: string, streaming: boolean): SseState {
  const messages = state.messages.map(msg => {
    if (msg.id !== requestId) return msg;
    const parts = [...(msg.parts ?? [])];
    const last = parts[parts.length - 1];
    // chat/delta fragments accumulate into the open streaming part; the final chat/response replaces it.
    const isOpenStream = last?.type === 'text' && last.streaming === true;
    const content = streaming && isOpenStream ? last.content + text : text;
    const part: MessagePart = { type: 'text', content, ...(streaming && { streaming: true }) };
    if (isOpenStream) parts[parts.length - 1] = part;
    else parts.push(part);
    return { ...msg, content, isPlaceholder: false, placeholderState: undefined, parts };
  });
  return { ...state, messages };
}

export function reduceSse(state: SseState, event: WidgetEvent, currentMode: InstructionType): ReduceResult {
  switch (event.type) {
    case 'tool/call': {
      // A tool/call can arrive before `task/status running`, so activate here too.
      const task = state.task.isTaskRunning ? state.task : { ...state.task, isTaskRunning: true };
      const explanation = event.explanation || '';
      const messages = applyProgress(
        state.messages,
        task.isTaskRunning,
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
            mode: event.mode || currentMode || 'do',
            explanation,
          },
        ],
      };
    }

    case 'task/status': {
      if (event.status === 'running') {
        // Activation is gated on API task_id + agentRunning, tracked in the wiring (pendingTaskRef).
        return noChange(state);
      }
      const content = event.message ? { content: event.message } : {};
      const status = event.status;
      // has_question is a pause, not a terminal status.
      const stamp =
        status === 'has_question'
          ? (msg: ChatMessage) => ({
              ...updateThinkingMarker(msg, false, currentMode),
              placeholderState: 'waiting-for-user' as const,
              ...content,
            })
          : (msg: ChatMessage) => ({ ...msg, taskStatus: TASK_STATUS[status], ...content });
      return { state: stampProgressMessage(state, currentMode, stamp), effects: [] };
    }

    case 'chat/delta':
      return { state: reduceText(state, event.request_id, event.text, true), effects: [] };

    case 'chat/response':
      return {
        state: reduceText(state, event.request_id, event.text, false),
        effects: [{ type: 'setLoading', value: false }],
      };

    case 'chat/error': {
      const errorMessage = `Error: ${event.error}`;
      const messages = state.messages.map(msg =>
        msg.id !== event.request_id
          ? msg
          : {
              ...msg,
              content: errorMessage,
              isPlaceholder: false,
              placeholderState: undefined,
              parts: [...(msg.parts ?? []), { type: 'text' as const, content: errorMessage }],
            },
      );
      return { state: { ...state, messages }, effects: [{ type: 'setLoading', value: false }] };
    }

    // registered / heartbeat carry no state.
    default:
      return noChange(state);
  }
}
