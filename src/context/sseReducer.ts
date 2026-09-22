/**
 * Pure state machine behind `ChatContext`: folds incoming SSE events and local transitions into
 * `{messages, task}` and returns the tool runs the caller must perform. No I/O, no React.
 *
 * Tool progress, completion and stop all patch the running message's parts and the task's phase;
 * `reduceDispatch` appends the next placeholder and reopens the task for a new turn. Terminal
 * transitions clear `isPlaceholder` so the composer re-enables. `reduceError`, `reduceTransportFailure`
 * and `reduceStaleReply` each settle a stuck message as failed, covering a bad reply, a dead
 * connection, and a healthy stream that simply never answers. `reduceText` drops an exact repeat of the
 * last closed text segment, since a duplicated final reply looks exactly like that.
 */
import type { WidgetEvent } from '../sdk';
import { browserToolService, type WidgetToolCall, type WidgetToolName } from '../services/BrowserToolService';
import type { ChatMessage, InstructionType, MessagePart } from '../types';
import {
  addProgressLine,
  CHAT_FAILURE_TEXT,
  findMessageForProgress,
  markProgressLineComplete,
  markProgressLineFailed,
} from '../utils/chat';

type TaskPhase = 'idle' | 'running' | 'stopped';

export interface TaskState {
  phase: TaskPhase;
  mode?: InstructionType;
}

export interface SseState {
  messages: ChatMessage[];
  task: TaskState;
}

export interface SseEffect {
  type: 'executeTool';
  call: WidgetToolCall;
  mode: InstructionType;
}

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
  browserToolName: WidgetToolName,
  explanation: string,
  status: ProgressStatus,
  error?: string,
): ChatMessage[] {
  const found = findMessageForProgress({ messages, isTaskRunning, currentMode });
  if (!found) return messages;

  let updatedMsg = found.message;
  if (status === 'failed') {
    updatedMsg = markProgressLineFailed(updatedMsg, browserToolName, error || '');
  } else if (browserToolName !== 'done') {
    updatedMsg =
      status === 'in_progress'
        ? addProgressLine(
            updatedMsg,
            browserToolName,
            explanation || browserToolService.getFriendlyToolName(browserToolName),
          )
        : markProgressLineComplete(updatedMsg, browserToolName);
  }

  if (isTaskRunning && (currentMode === 'show' || currentMode === 'do')) {
    const waiting =
      status === 'in_progress' && currentMode === 'show' && browserToolService.isWaitForUserTool(browserToolName);
    updatedMsg = { ...updatedMsg, placeholderState: waiting ? 'waiting-for-user' : 'thinking' };
  }

  const next = [...messages];
  next[found.index] = updatedMsg;
  return next;
}

const runningMode = (state: SseState, currentMode: InstructionType): InstructionType =>
  state.task.phase === 'running' ? (state.task.mode ?? currentMode) : currentMode;

export function reduceToolProgress(
  state: SseState,
  browserToolName: WidgetToolName,
  explanation: string,
  status: ProgressStatus,
  currentMode: InstructionType,
  error?: string,
): SseState {
  return {
    ...state,
    messages: applyProgress(
      state.messages,
      state.task.phase === 'running',
      runningMode(state, currentMode),
      browserToolName,
      explanation,
      status,
      error,
    ),
  };
}

const settled = (msg: ChatMessage): ChatMessage => ({ ...msg, isPlaceholder: false });

const ended = (task: TaskState): TaskState => (task.phase === 'stopped' ? task : { phase: 'idle' });

function stampProgressMessage(
  state: SseState,
  currentMode: InstructionType,
  stamp: (msg: ChatMessage) => ChatMessage,
): SseState {
  const found = findMessageForProgress({
    messages: state.messages,
    isTaskRunning: state.task.phase === 'running',
    currentMode: runningMode(state, currentMode),
  });
  const messages = [...state.messages];
  if (found) messages[found.index] = settled(stamp(found.message));
  return { messages, task: ended(state.task) };
}

export function reduceToolDone(state: SseState, currentMode: InstructionType, success: boolean): SseState {
  return stampProgressMessage(state, currentMode, msg => ({
    ...msg,
    taskStatus: success ? 'done' : 'failed',
    parts: msg.parts.filter(part => part.type !== 'progress'),
  }));
}

export function reduceStop(state: SseState, currentMode: InstructionType): SseState {
  const stopped = stampProgressMessage(state, currentMode, msg => ({ ...msg, taskStatus: 'stopped' }));
  return { ...stopped, task: { phase: 'stopped' } };
}

export function reduceDispatch(state: SseState, placeholder: ChatMessage): SseState {
  return { messages: [...state.messages, placeholder], task: { phase: 'idle' } };
}

const TASK_STATUS = { completed: 'done', failed: 'failed', stopped: 'stopped' } as const;

export const isTerminalTaskStatus = (status: string): status is keyof typeof TASK_STATUS => status in TASK_STATUS;

function reduceText(state: SseState, requestId: string, text: string, streaming: boolean): SseState {
  const messages = state.messages.map(msg => {
    if (msg.id !== requestId) return msg;
    const parts = [...msg.parts];
    const last = parts[parts.length - 1];
    const isOpenStream = last?.type === 'text' && last.streaming === true;
    if (last?.type === 'text' && !isOpenStream && last.content === text) return msg;
    const content = streaming && isOpenStream ? last.content + text : text;
    const part: MessagePart = { type: 'text', content, ...(streaming && { streaming: true }) };
    if (isOpenStream) parts[parts.length - 1] = part;
    else parts.push(part);
    return { ...msg, isPlaceholder: false, placeholderState: undefined, parts };
  });
  return { ...state, messages };
}

const appendText = (msg: ChatMessage, text: string): ChatMessage => ({
  ...msg,
  parts: [...msg.parts, { type: 'text' as const, content: text }],
});

const errorBubble = (msg: ChatMessage, text: string): ChatMessage => ({
  ...settled(appendText(msg, text)),
  placeholderState: undefined,
  taskStatus: 'failed',
});

export function reduceError(state: SseState, messageId: string, text: string): SseState {
  const messages = state.messages.map(msg => (msg.id === messageId ? errorBubble(msg, text) : msg));
  return { ...state, messages };
}

export function reduceTransportFailure(state: SseState, text: string): SseState {
  const messages = state.messages.map(msg => (msg.isPlaceholder ? errorBubble(msg, text) : msg));
  return { messages, task: ended(state.task) };
}

export function reduceStaleReply(state: SseState, messageId: string, text: string): SseState {
  const pending = state.messages.find(msg => msg.id === messageId);
  return pending?.isPlaceholder && pending.placeholderState !== 'waiting-for-user'
    ? reduceError(state, messageId, text)
    : state;
}

export function reduceSse(state: SseState, event: WidgetEvent, currentMode: InstructionType): ReduceResult {
  switch (event.type) {
    case 'tool/call': {
      if (state.task.phase === 'stopped') return noChange(state);
      const task: TaskState =
        state.task.phase === 'running' ? state.task : { phase: 'running', mode: event.mode || currentMode };
      const messages = applyProgress(
        state.messages,
        true,
        task.mode ?? currentMode,
        event.browser_tool,
        event.explanation ?? '',
        'in_progress',
      );
      return {
        state: { messages, task },
        effects: [{ type: 'executeTool', call: event, mode: event.mode ?? currentMode }],
      };
    }

    case 'task/status': {
      if (event.status === 'running') return noChange(state);
      const status = event.status;
      const withMessage = (msg: ChatMessage) => (event.message ? appendText(msg, event.message) : msg);
      const stamp =
        status === 'has_question'
          ? (msg: ChatMessage) => ({ ...withMessage(msg), placeholderState: 'waiting-for-user' as const })
          : (msg: ChatMessage) => ({ ...withMessage(msg), taskStatus: TASK_STATUS[status] });
      return { state: stampProgressMessage(state, currentMode, stamp), effects: [] };
    }

    case 'chat/delta':
      return { state: reduceText(state, event.request_id, event.text, true), effects: [] };

    case 'chat/response':
      return { state: reduceText(state, event.request_id, event.text, false), effects: [] };

    case 'chat/error':
      return { state: reduceError(state, event.request_id, CHAT_FAILURE_TEXT), effects: [] };

    default:
      return noChange(state);
  }
}
