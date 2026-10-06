/**
 * Pure state machine behind `ChatContext`: folds incoming stream events and local transitions into
 * `{messages, task}`. No I/O, no React.
 * `reduceDispatch` opens a new turn; the tool, text, error, transport-failure, stale-reply and screen-share
 * reducers each settle or patch the message their event names by `request_id`, and the task.
 * An ended message ignores every further terminal event, since the agent repeats its `done` message in the terminal
 * `task/status` and the api follows a failed status with `chat/error`.
 */
import type { WidgetEvent } from '../sdk';
import type { WidgetToolCall, WidgetToolName } from '../services/browserTools';
import type { AgentMessage, ChatMessage, MessagePart } from '../types';
import {
  CHAT_FAILURE_TEXT,
  createScreenshareMessage,
  createSystemMessage,
  isPending,
  SCREEN_SHARE_STARTED_TEXT,
  SCREEN_SHARE_STOPPED_TEXT,
  taskEnded,
  toolExplanation,
  waitsForUser,
} from '../utils/chat';

export type TaskState =
  { phase: 'running'; mode: WidgetToolCall['mode']; requestId: string | undefined } | { phase: 'idle' | 'stopped' };

export interface ChatState {
  messages: ChatMessage[];
  task: TaskState;
}

export type ToolProgress =
  | { status: 'in_progress'; mode: WidgetToolCall['mode']; explanation?: string | undefined }
  | { status: 'completed' }
  | { status: 'failed'; error: string };

function applyToolProgress(msg: AgentMessage, tool: WidgetToolName, progress: ToolProgress): AgentMessage {
  const index = msg.parts.findIndex(
    part => part.type === 'progress' && part.status === 'in_progress' && part.browserToolName === tool,
  );
  const open = msg.parts[index];
  const parts = [...msg.parts];
  if (open?.type !== 'progress') {
    if (progress.status !== 'in_progress') return msg;
    const content = toolExplanation(tool, progress.explanation);
    parts.push({ type: 'progress', content, status: 'in_progress', browserToolName: tool });
  } else if (progress.status === 'in_progress') {
    parts[index] = { ...open, content: toolExplanation(tool, progress.explanation) };
  } else if (progress.status === 'completed') {
    parts[index] = { ...open, status: 'completed' };
  } else {
    parts[index] = {
      ...open,
      status: 'failed',
      content: progress.error ? `${open.content} (${progress.error})` : open.content,
    };
  }
  return { ...msg, parts };
}

const appendText = (msg: AgentMessage, text: string): AgentMessage => ({
  ...msg,
  parts: [...msg.parts, { type: 'text' as const, content: text }],
});

const mapAgentMessage = (
  state: ChatState,
  matches: (msg: AgentMessage) => boolean,
  update: (msg: AgentMessage) => AgentMessage,
): ChatMessage[] => {
  const messages = state.messages.map(msg => (msg.kind === 'agent' && matches(msg) ? update(msg) : msg));
  return messages.some((msg, i) => msg !== state.messages[i]) ? messages : state.messages;
};

const open = (requestId: string | undefined) => (msg: AgentMessage) => msg.id === requestId && !taskEnded(msg);

const ended = (task: TaskState): TaskState => (task.phase === 'stopped' ? task : { phase: 'idle' });

function settle(
  state: ChatState,
  requestId: string | undefined,
  stamp: (msg: AgentMessage) => AgentMessage,
): ChatState {
  const otherTask = state.task.phase === 'running' && state.task.requestId !== requestId;
  return {
    messages: mapAgentMessage(state, open(requestId), stamp),
    task: otherTask ? state.task : ended(state.task),
  };
}

export function reduceToolProgress(
  state: ChatState,
  requestId: string | undefined,
  browserToolName: WidgetToolName,
  progress: ToolProgress,
): ChatState {
  const messages = mapAgentMessage(state, open(requestId), msg => {
    const updated =
      progress.status === 'failed' || browserToolName !== 'done'
        ? applyToolProgress(msg, browserToolName, progress)
        : msg;
    if (state.task.phase !== 'running' || !isPending(updated)) return updated;
    const waiting = progress.status === 'in_progress' && progress.mode === 'show' && waitsForUser(browserToolName);
    return { ...updated, status: waiting ? 'waiting-for-user' : 'thinking' };
  });
  return messages === state.messages ? state : { ...state, messages };
}

export function reduceToolDone(
  state: ChatState,
  requestId: string | undefined,
  { message, success }: { message: string; success: boolean },
): ChatState {
  return settle(state, requestId, msg => {
    const finished = { ...msg, parts: msg.parts.filter(part => part.type !== 'progress') };
    return {
      ...(message.trim() ? appendText(finished, message.trim()) : finished),
      status: success ? 'done' : 'failed',
    };
  });
}

export function reduceStop(state: ChatState): ChatState {
  const { task } = state;
  const stopping = (msg: AgentMessage) =>
    !taskEnded(msg) && (task.phase === 'running' ? msg.id === task.requestId : isPending(msg));
  return {
    messages: mapAgentMessage(state, stopping, msg => ({ ...msg, status: 'stopped' })),
    task: { phase: 'stopped' },
  };
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
  reduceAppend(state, createSystemMessage(SCREEN_SHARE_STARTED_TEXT), createScreenshareMessage(stream));

export const reduceScreenShareStopped = (state: ChatState): ChatState =>
  reduceAppend(
    { ...state, messages: state.messages.filter(msg => msg.kind !== 'screenshare') },
    createSystemMessage(SCREEN_SHARE_STOPPED_TEXT),
  );

export function reduceDispatch(state: ChatState, placeholder: ChatMessage): ChatState {
  return { messages: [...state.messages, placeholder], task: { phase: 'idle' } };
}

const TASK_STATUS = { completed: 'done', failed: 'failed', stopped: 'stopped', has_question: 'question' } as const;

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
  return { ...state, messages: mapAgentMessage(state, open(messageId), errorBubble(text)) };
}

export function reduceTransportFailure(state: ChatState, text: string): ChatState {
  return { messages: mapAgentMessage(state, isPending, errorBubble(text)), task: ended(state.task) };
}

export function reduceStaleReply(state: ChatState, messageId: string, text: string): ChatState {
  const pending = state.messages.find(msg => msg.id === messageId);
  const stale =
    pending?.kind === 'agent' &&
    (pending.status === 'thinking' || (isPending(pending) && state.task.phase !== 'running'));
  return stale ? reduceError(state, messageId, text) : state;
}

export function reduceEvent(state: ChatState, event: WidgetEvent): ChatState {
  switch (event.type) {
    case 'tool/call': {
      if (state.task.phase === 'stopped') return state;
      const task: TaskState =
        state.task.phase === 'running'
          ? state.task
          : { phase: 'running', mode: event.mode, requestId: event.request_id };
      return reduceToolProgress({ ...state, task }, event.request_id, event.browser_tool, {
        status: 'in_progress',
        mode: event.mode,
        explanation: event.explanation,
      });
    }

    case 'task/status': {
      if (event.status === 'running') return state;
      const { status } = event;
      const message = event.message ?? (status === 'failed' ? CHAT_FAILURE_TEXT : undefined);
      return settle(state, event.request_id, msg => ({
        ...(message ? appendText(msg, message) : msg),
        status: TASK_STATUS[status],
      }));
    }

    case 'chat/delta':
      return reduceText(state, event.request_id, event.text, true);

    case 'chat/response':
      return reduceText(state, event.request_id, event.text, false);

    case 'chat/error':
      return reduceError(state, event.request_id, CHAT_FAILURE_TEXT);

    default:
      return state;
  }
}
