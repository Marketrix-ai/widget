/**
 * Pure state machine behind `ChatContext`: folds incoming stream events and local transitions into
 * `{messages, task}` and returns the tool runs the caller must perform. No I/O, no React.
 * `reduceDispatch` opens a new turn; the tool, text, error, transport-failure, stale-reply and screen-share
 * reducers each settle or patch the running message and task.
 * The agent repeats its `done` message in the terminal `task/status`, and the api follows a failed status with
 * `chat/error`, so a turn that already settled takes neither again.
 */
import type { WidgetEvent } from '../sdk';
import type { WidgetToolCall, WidgetToolName } from '../services/browserTools';
import {
  type AgentMessage,
  type ChatMessage,
  type InstructionType,
  type MessagePart,
  messageText,
  type ProgressPart,
} from '../types';
import {
  addProgressLine,
  CHAT_FAILURE_TEXT,
  createScreenshareMessage,
  createSystemMessage,
  findMessageForProgress,
  isPending,
  markProgressLineComplete,
  markProgressLineFailed,
  taskEnded,
  toolExplanation,
  waitsForUser,
} from '../utils/chat';

export type TaskState = { phase: 'running'; mode: InstructionType } | { phase: 'idle' | 'stopped' };

export interface ChatState {
  messages: ChatMessage[];
  task: TaskState;
}

export interface ToolRun {
  call: WidgetToolCall;
  mode: InstructionType;
}

interface ReduceResult {
  state: ChatState;
  toolRuns: ToolRun[];
}

const withoutToolRuns = (state: ChatState): ReduceResult => ({ state, toolRuns: [] });

export interface ToolProgress {
  status: ProgressPart['status'];
  explanation?: string | undefined;
  error?: string | undefined;
}

const runningMode = (state: ChatState, currentMode: InstructionType): InstructionType =>
  state.task.phase === 'running' ? state.task.mode : currentMode;

export function reduceToolProgress(
  state: ChatState,
  browserToolName: WidgetToolName,
  progress: ToolProgress,
  currentMode: InstructionType,
): ChatState {
  const isTaskRunning = state.task.phase === 'running';
  const mode = runningMode(state, currentMode);
  const found = findMessageForProgress({ messages: state.messages, isTaskRunning, currentMode: mode });
  if (!found) return state;

  let updatedMsg = found.message;
  if (progress.status === 'failed') {
    updatedMsg = markProgressLineFailed(updatedMsg, browserToolName, progress.error ?? '');
  } else if (browserToolName !== 'done') {
    updatedMsg =
      progress.status === 'in_progress'
        ? addProgressLine(updatedMsg, browserToolName, toolExplanation(browserToolName, progress.explanation))
        : markProgressLineComplete(updatedMsg, browserToolName);
  }

  if (isTaskRunning && (mode === 'show' || mode === 'do') && isPending(updatedMsg)) {
    const waiting = progress.status === 'in_progress' && mode === 'show' && waitsForUser(browserToolName);
    updatedMsg = { ...updatedMsg, status: waiting ? 'waiting-for-user' : 'thinking' };
  }

  const messages = [...state.messages];
  messages[found.index] = updatedMsg;
  return { ...state, messages };
}

const appendText = (msg: AgentMessage, text: string): AgentMessage => ({
  ...msg,
  parts: [...msg.parts, { type: 'text' as const, content: text }],
});

const ended = (task: TaskState): TaskState => (task.phase === 'stopped' ? task : { phase: 'idle' });

function stampProgressMessage(
  state: ChatState,
  currentMode: InstructionType,
  stamp: (msg: AgentMessage) => AgentMessage,
): ChatState {
  const found = findMessageForProgress({
    messages: state.messages,
    isTaskRunning: state.task.phase === 'running',
    currentMode: runningMode(state, currentMode),
  });
  const messages = [...state.messages];
  if (found) messages[found.index] = stamp(found.message);
  return { messages, task: ended(state.task) };
}

export function reduceToolDone(
  state: ChatState,
  currentMode: InstructionType,
  { message, success }: { message: string; success: boolean },
): ChatState {
  return stampProgressMessage(state, currentMode, msg => {
    const finished = { ...msg, parts: msg.parts.filter(part => part.type !== 'progress') };
    return {
      ...(message.trim() ? appendText(finished, message.trim()) : finished),
      status: success ? 'done' : 'failed',
    };
  });
}

export function reduceStop(state: ChatState, currentMode: InstructionType): ChatState {
  const stopped = stampProgressMessage(state, currentMode, msg => ({ ...msg, status: 'stopped' }));
  return { ...stopped, task: { phase: 'stopped' } };
}

export const reduceAppend = (state: ChatState, ...messages: ChatMessage[]): ChatState => ({
  ...state,
  messages: [...state.messages, ...messages],
});

type ScreenAccessMessage = Extract<ChatMessage, { kind: 'screenAccess' }>;

export const openScreenAccessRequest = (messages: ChatMessage[]): ScreenAccessMessage | undefined =>
  messages.findLast((msg): msg is ScreenAccessMessage => msg.kind === 'screenAccess' && !msg.screenShareStatus);

export function reduceScreenAccessResolved(state: ChatState, screenShareStatus: 'allowed' | 'denied'): ChatState {
  const request = openScreenAccessRequest(state.messages);
  if (!request) return state;
  return { ...state, messages: state.messages.map(msg => (msg === request ? { ...request, screenShareStatus } : msg)) };
}

export const reduceScreenShareStarted = (state: ChatState, stream: MediaStream): ChatState =>
  reduceAppend(state, createSystemMessage('Screen sharing started'), createScreenshareMessage(stream));

export const reduceScreenShareStopped = (state: ChatState): ChatState =>
  reduceAppend(
    { ...state, messages: state.messages.filter(msg => msg.kind !== 'screenshare') },
    createSystemMessage('Screen sharing stopped'),
  );

export function reduceDispatch(state: ChatState, placeholder: ChatMessage): ChatState {
  return { messages: [...state.messages, placeholder], task: { phase: 'idle' } };
}

const TASK_STATUS = { completed: 'done', failed: 'failed', stopped: 'stopped', has_question: 'question' } as const;

const mapAgentMessage = (
  state: ChatState,
  matches: (msg: AgentMessage) => boolean,
  update: (msg: AgentMessage) => AgentMessage,
): ChatMessage[] => state.messages.map(msg => (msg.kind === 'agent' && matches(msg) ? update(msg) : msg));

function reduceText(state: ChatState, requestId: string, text: string, streaming: boolean): ChatState {
  const messages = mapAgentMessage(
    state,
    msg => msg.id === requestId,
    msg => {
      const parts = [...msg.parts];
      const last = parts[parts.length - 1];
      const isOpenStream = last?.type === 'text' && last.streaming === true;
      if (last?.type === 'text' && !isOpenStream && last.content === text) return msg;
      const content = streaming && isOpenStream ? last.content + text : text;
      const part: MessagePart = { type: 'text', content, ...(streaming && { streaming: true }) };
      if (isOpenStream) parts[parts.length - 1] = part;
      else parts.push(part);
      return { ...msg, status: undefined, parts };
    },
  );
  return { ...state, messages };
}

const errorBubble =
  (text: string) =>
  (msg: AgentMessage): AgentMessage => ({ ...appendText(msg, text), status: 'failed' });

export function reduceError(state: ChatState, messageId: string, text: string): ChatState {
  const alreadyExplained = (msg: AgentMessage) => msg.status === 'failed' && !!messageText(msg.parts);
  return {
    ...state,
    messages: mapAgentMessage(state, msg => msg.id === messageId && !alreadyExplained(msg), errorBubble(text)),
  };
}

export function reduceTransportFailure(state: ChatState, text: string): ChatState {
  return { messages: mapAgentMessage(state, isPending, errorBubble(text)), task: ended(state.task) };
}

export function reduceStaleReply(state: ChatState, messageId: string, text: string): ChatState {
  const pending = state.messages.find(msg => msg.id === messageId);
  return pending?.kind === 'agent' && pending.status === 'thinking' ? reduceError(state, messageId, text) : state;
}

export function reduceEvent(state: ChatState, event: WidgetEvent, currentMode: InstructionType): ReduceResult {
  switch (event.type) {
    case 'tool/call': {
      if (state.task.phase === 'stopped') return withoutToolRuns(state);
      const task =
        state.task.phase === 'running' ? state.task : { phase: 'running' as const, mode: event.mode ?? currentMode };
      const progressed = reduceToolProgress(
        { ...state, task },
        event.browser_tool,
        { status: 'in_progress', explanation: event.explanation },
        currentMode,
      );
      return { state: progressed, toolRuns: [{ call: event, mode: task.mode }] };
    }

    case 'task/status': {
      if (event.status === 'running') return withoutToolRuns(state);
      const last = state.messages.findLast((msg): msg is AgentMessage => msg.kind === 'agent');
      if (last && taskEnded(last)) {
        const closing = event.message;
        if (!closing || messageText(last.parts)) return withoutToolRuns(state);
        return withoutToolRuns({
          ...state,
          messages: state.messages.map(msg => (msg === last ? appendText(last, closing) : msg)),
        });
      }
      const { status, message } = event;
      return withoutToolRuns(
        stampProgressMessage(state, currentMode, msg => ({
          ...(message ? appendText(msg, message) : msg),
          status: TASK_STATUS[status],
        })),
      );
    }

    case 'chat/delta':
      return withoutToolRuns(reduceText(state, event.request_id, event.text, true));

    case 'chat/response':
      return withoutToolRuns(reduceText(state, event.request_id, event.text, false));

    case 'chat/error':
      return withoutToolRuns(reduceError(state, event.request_id, CHAT_FAILURE_TEXT));

    default:
      return withoutToolRuns(state);
  }
}
