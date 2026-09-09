/**
 * Pure state machine behind `ChatContext`: folds SSE `WidgetEvent`s and local transitions into
 * `{messages, task}` and returns the tool executions the caller must run. No I/O, no React.
 *
 * Types: `TaskPhase`/`TaskState` (the run's phase plus the mode it was dispatched in), `SseState`,
 * `SseEffect` (the one effect — execute a browser tool), `ReduceResult`.
 *
 * Contents:
 * - `noChange` — the identity result, for an event that carries no state.
 * - `applyProgress` — writes one tool's progress line into the message `findMessageForProgress` picks,
 *   then sets that bubble's spinner. `FINISH_TOOL` carries no progress line of its own — it only ends
 *   the run — so nothing is added or completed for it, though a *failed* finish is still stamped
 *   failed. In `show` mode a DOM-mutating tool (`isWaitForUserTool`) parks the spinner on
 *   "waiting-for-user" until the visitor acts; every other running show/do step reads "thinking".
 * - `runningMode` — an active run judges progress by the mode it started in, not by whatever the
 *   composer shows now.
 * - `ProgressStatus` / `reduceToolProgress` — in_progress / completed / failed for a single tool, from the
 *   executor.
 * - `settled` — clears `isPlaceholder`. The composer is disabled while any message is still a
 *   placeholder, so a bubble nothing will write to again has to stop being one — `has_question` most
 *   of all, where the agent asks for an answer the visitor could not then type.
 * - `ended` — a task the visitor stopped stays `stopped`, so late `tool/call`s are ignored until
 *   `reduceDispatch` opens the next turn; every other ending lands on `idle`.
 * - `stampProgressMessage` — the four terminal/pause transitions all stamp the progress message and
 *   clear the task; only the stamp differs.
 * - `reduceToolDone` — the `done` tool ran: stamps `done` and drops the progress parts. finish is the
 *   transient-trajectory boundary — the trail was scaffolding for "still working", not part of the
 *   answer, so it leaves the bubble the moment the run actually finishes.
 * - `reduceStop` — visitor stop; `reduceDispatch` — appends the next placeholder and drops the task back to
 *   `idle`, which is what lets the following turn's `tool/call` activate it again.
 * - `TASK_STATUS` / `isTerminalTaskStatus` — wire status → presentational `taskStatus`. The terminal
 *   set is read off the map that stamps it (`has_question` is a pause, and `running` stamps nothing),
 *   so a fourth terminal status added to `TASK_STATUS` reaches every caller at once.
 * - `reduceText` — `chat/delta` fragments accumulate into the open streaming part; the final
 *   `chat/response` replaces it.
 * - `appendText` / `errorBubble` — append a plain text part; settle a message as a failed bubble.
 * - `reduceError` — settles one pending message into that error bubble: the one shape for both a failed
 *   POST and a `chat/error`.
 * - `reduceTransportFailure` — the transport gave up, so no id-bearing event is coming for anything
 *   still pending; every placeholder becomes an error bubble.
 * - `reduceStaleReply` — the stream can stay healthy (no `StreamGaveUpError`) while a single dispatch's
 *   reply never arrives: a dropped correlation, a silent backend failure before it ever acknowledges
 *   the request, or a reload into the gap where the api has no tab to push to. `reduceTransportFailure`
 *   cannot see that, since nothing told the transport it failed, so without this the bubble sits on
 *   "thinking" and the composer stays disabled forever. A `waiting-for-user` pause is not stale.
 * - `reduceSse` — the event switch. `tool/call` also activates the task, because it can arrive before
 *   `task/status running`; `running` itself activates nothing (the first `tool/call` is what starts the
 *   run, and a tell-mode reply never has a task); `registered`/`heartbeat` carry no state.
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

export type TaskPhase = 'idle' | 'running' | 'stopped';

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
