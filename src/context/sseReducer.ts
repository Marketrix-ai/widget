/**
 * Pure state machine behind `ChatContext`: folds SSE `WidgetEvent`s and local transitions into `{messages,
 * task}` (`SseState`; `TaskPhase`/`TaskState` carry the mode the run was dispatched in) and returns the tool
 * runs the caller must perform (`SseEffect`, `ReduceResult`). No I/O, no React.
 *
 * `reduceToolProgress` writes a tool's progress line and sets the bubble's spinner, judging by the mode the
 * run STARTED in, not what the composer shows now; `FINISH_TOOL` gets no line, only ending the run, though a
 * failed finish is still stamped failed, and a `show`-mode DOM-mutating tool parks on "waiting-for-user".
 * `reduceToolDone` stamps done and drops the progress parts, scaffolding for "still working" not answer.
 * `reduceStop` stamps stopped and a stopped task STAYS stopped, so late `tool/call`s are ignored until
 * `reduceDispatch` appends the next placeholder and returns to `idle`, reopening the task for the next turn.
 *
 * Terminal transitions clear `isPlaceholder` — the composer is disabled while any message is one, and
 * `has_question` would otherwise ask for an answer the visitor could not type. `isTerminalTaskStatus` reads
 * the very map that stamps the status, so a fourth reaches every caller at once. `reduceError` settles one
 * pending message as a failed bubble, `reduceTransportFailure` does it to every placeholder since after a
 * give-up no id-bearing event is coming, and `reduceStaleReply` covers a HEALTHY stream whose one reply
 * never arrives and nothing else can see (a `waiting-for-user` pause is not stale). `reduceSse` switches:
 * `chat/delta` accumulates, `chat/response` replaces, `tool/call` ACTIVATES the task before `task/status`.
 */
import type { WidgetEvent } from '../sdk';
import { browserToolService, FINISH_TOOL } from '../services/BrowserToolService';
import { type ChatMessage, type InstructionType, type MessagePart, messageText } from '../types';
import {
  addProgressLine,
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
  toolCallId: string;
  tool: string;
  args: Record<string, unknown>;
  mode: InstructionType;
  explanation: string;
}

interface ReduceResult {
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
  const found = findMessageForProgress({ messages, isTaskRunning, currentMode });
  if (!found) return messages;

  let updatedMsg = found.message;
  if (status === 'failed') {
    updatedMsg = markProgressLineFailed(updatedMsg, browserToolName, error || '');
  } else if (browserToolName !== FINISH_TOOL) {
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

export function reduceToolDone(state: SseState, currentMode: InstructionType): SseState {
  return stampProgressMessage(state, currentMode, msg => ({
    ...msg,
    taskStatus: 'done',
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
    const content = streaming && isOpenStream ? last.content + text : text;
    const part: MessagePart = { type: 'text', content, ...(streaming && { streaming: true }) };
    if (isOpenStream) parts[parts.length - 1] = part;
    else parts.push(part);
    return { ...msg, content: messageText(parts), isPlaceholder: false, placeholderState: undefined, parts };
  });
  return { ...state, messages };
}

const appendText = (msg: ChatMessage, text: string): ChatMessage => {
  const parts = [...msg.parts, { type: 'text' as const, content: text }];
  return { ...msg, content: messageText(parts), parts };
};

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
      const explanation = event.explanation || '';
      const messages = applyProgress(
        state.messages,
        true,
        task.mode ?? currentMode,
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
            mode: event.mode || currentMode,
            explanation,
          },
        ],
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
      return { state: reduceError(state, event.request_id, `Error: ${event.error}`), effects: [] };

    default:
      return noChange(state);
  }
}
