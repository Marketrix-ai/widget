/**
 * Tests for `chatReducer`'s pure state machine folding SSE events and local actions into chat messages
 * and task state — status transitions, tool-call progress lines, streaming replies, stale-reply and
 * transport-failure recovery, and stop handling.
 */
import { describe, expect, it } from 'bun:test';

import type { WidgetEvent } from '../../sdk';
import { agentMessage } from '../../test/fixtures';
import { type ChatMessage, messageText } from '../../types';
import { CHAT_FAILURE_TEXT } from '../../utils/chat';
import {
  reduceDispatch,
  type ReduceResult,
  reduceSse,
  reduceStaleReply,
  reduceStop,
  reduceToolDone,
  reduceToolProgress,
  reduceTransportFailure,
  type SseState,
} from '../chatReducer';

const expectNoOp = (result: ReduceResult, state: SseState) => {
  expect(result.state).toBe(state);
  expect(result.effects).toEqual([]);
};

const runningState = (overrides: Partial<ChatMessage> = {}): SseState => ({
  messages: [agentMessage(overrides)],
  task: { phase: 'running' },
});

const idleState = (): SseState => ({ ...runningState({ placeholderState: undefined }), task: { phase: 'idle' } });

const pendingReply = (id = 'req-1'): SseState => ({
  messages: [agentMessage({ id, parts: [] })],
  task: { phase: 'idle' },
});

type ClickToolCallEvent = Extract<WidgetEvent, { type: 'tool/call'; browser_tool: 'click_element' }>;

const toolCall = (overrides: Partial<ClickToolCallEvent> = {}): ClickToolCallEvent => ({
  type: 'tool/call',
  tool_call_id: 'call-1',
  browser_tool: 'click_element',
  args: { index: 1 },
  explanation: 'Clicking the submit button',
  ...overrides,
});

describe('reduceSse — task/status', () => {
  it('running is a no-op — the first tool/call is what activates the task', () => {
    const state = idleState();
    const result = reduceSse(state, { type: 'task/status', status: 'running' }, 'do');
    expectNoOp(result, state);
  });

  it.each([
    ['completed', 'done'],
    ['failed', 'failed'],
    ['stopped', 'stopped'],
  ] as const)('%s ends the task and marks the active message %s', (status, taskStatus) => {
    const result = reduceSse(runningState(), { type: 'task/status', status }, 'do');
    expect(result.state.task.phase).toBe('idle');
    expect(result.state.messages[0]!.taskStatus).toBe(taskStatus);
  });

  it('terminal status renders its closing message as an appended text part', () => {
    const event: WidgetEvent = { type: 'task/status', status: 'completed', message: 'All done!' };
    const result = reduceSse(runningState({ parts: [{ type: 'progress', content: 'Clicking element' }] }), event, 'do');

    expect(messageText(result.state.messages[0]!.parts)).toBe('All done!');
    expect(result.state.messages[0]!.parts).toEqual([
      { type: 'progress', content: 'Clicking element' },
      { type: 'text', content: 'All done!' },
    ]);
  });

  it('has_question pauses (not terminal): flips the spinner to waiting-for-user, no taskStatus', () => {
    const before = runningState();
    expect(before.messages[0]!.placeholderState).toBe('thinking');

    const event: WidgetEvent = { type: 'task/status', status: 'has_question', message: 'Which account?' };
    const result = reduceSse(before, event, 'do');

    const msg = result.state.messages[0]!;
    expect(msg.placeholderState).toBe('waiting-for-user');
    expect(messageText(msg.parts)).toContain('Which account?');
    expect(msg.parts[msg.parts.length - 1]).toEqual({ type: 'text', content: 'Which account?' });
    expect(msg.taskStatus).toBeUndefined();
    expect(result.state.task).toEqual({ phase: 'idle' });
  });

  it.each(['completed', 'failed', 'stopped', 'has_question'] as const)('%s settles the placeholder', status => {
    const result = reduceSse(runningState(), { type: 'task/status', status }, 'do');
    expect(result.state.messages[0]!.isPlaceholder).toBe(false);
  });
});

describe('reduceTransportFailure', () => {
  it('settles every pending bubble into an error and ends the task', () => {
    const state: SseState = {
      messages: [agentMessage({ id: 'settled', isPlaceholder: false }), agentMessage({ id: 'pending' })],
      task: { phase: 'running' },
    };
    const result = reduceTransportFailure(state, 'Could not reconnect to the assistant. Try again.');

    expect(result.messages[0]).toBe(state.messages[0]);
    expect(result.messages[1]!.isPlaceholder).toBe(false);
    expect(messageText(result.messages[1]!.parts)).toBe(
      'Working on it\nCould not reconnect to the assistant. Try again.',
    );
    expect(result.task).toEqual({ phase: 'idle' });
  });
});

describe('reduceStaleReply', () => {
  it('settles a placeholder that showed zero signs of life', () => {
    const state: SseState = { messages: [agentMessage({ parts: [] })], task: { phase: 'idle' } };
    const result = reduceStaleReply(state, 'agent-1', 'This is taking longer than expected. Please try again.');

    expect(result.messages[0]!.isPlaceholder).toBe(false);
    expect(messageText(result.messages[0]!.parts)).toBe('This is taking longer than expected. Please try again.');
  });

  it.each(['running', 'idle'] as const)(
    'settles a placeholder gone silent for the deadline whether its task is still %s or a reload left it behind',
    phase => {
      const state: SseState = { messages: [agentMessage()], task: { phase } };
      const result = reduceStaleReply(state, 'agent-1', 'timeout text');

      expect(result.messages[0]!.isPlaceholder).toBe(false);
      expect(messageText(result.messages[0]!.parts)).toBe('Working on it\ntimeout text');
    },
  );

  it('never overwrites a running task paused on the visitor, even with no text yet', () => {
    const state: SseState = {
      messages: [agentMessage({ placeholderState: 'waiting-for-user', parts: [] })],
      task: { phase: 'running' },
    };
    expect(reduceStaleReply(state, 'agent-1', 'timeout text')).toBe(state);
  });

  it('never overwrites a message that already settled', () => {
    const state: SseState = {
      messages: [agentMessage({ isPlaceholder: false, parts: [{ type: 'text', content: 'All done' }] })],
      task: { phase: 'idle' },
    };
    expect(reduceStaleReply(state, 'agent-1', 'timeout text')).toBe(state);
  });

  it('is a no-op for a message id it does not recognize', () => {
    const state: SseState = { messages: [agentMessage({ parts: [] })], task: { phase: 'idle' } };
    expect(reduceStaleReply(state, 'missing', 'timeout text')).toBe(state);
  });

  it('stamps taskStatus failed so a late completed status cannot re-target the watchdog bubble', () => {
    const state: SseState = { messages: [agentMessage({ parts: [] })], task: { phase: 'idle' } };
    const stale = reduceStaleReply(state, 'agent-1', 'This is taking longer than expected. Please try again.');
    expect(stale.messages[0]!.taskStatus).toBe('failed');

    const late = reduceSse(stale, { type: 'task/status', status: 'completed' }, 'do');
    expect(late.state.messages[0]!.taskStatus).toBe('failed');
    expect(messageText(late.state.messages[0]!.parts)).toBe('This is taking longer than expected. Please try again.');
  });
});

describe('reduceSse — tool/call', () => {
  it('emits an executeTool effect carrying the call details', () => {
    const result = reduceSse(runningState(), toolCall(), 'do');
    expect(result.effects).toEqual([{ type: 'executeTool', call: toolCall(), mode: 'do' }]);
  });

  it('auto-activates the task when a tool arrives before task/status running', () => {
    const result = reduceSse(idleState(), toolCall(), 'do');
    expect(result.state.task.phase).toBe('running');
  });

  it('adds an in-progress progress line to the active message', () => {
    const result = reduceSse(runningState(), toolCall(), 'do');
    const progressParts = (result.state.messages[0]!.parts ?? []).filter(p => p.type === 'progress');
    expect(progressParts).toHaveLength(1);
    expect(progressParts[0]!.status).toBe('in_progress');
  });

  it('announces a DOM read as reading the page — nothing but screen sharing views the visitor screen', () => {
    const result = reduceSse(
      runningState(),
      { type: 'tool/call', tool_call_id: 'call-1', browser_tool: 'get_html', args: {}, explanation: '' },
      'do',
    );
    const line = (result.state.messages[0]!.parts ?? []).find(part => part.type === 'progress');
    expect(line?.content).toBe('Reading the page');
    expect(line?.content).not.toMatch(/screen/i);
  });

  it('falls back to event.mode then "do" when currentMode is absent on the call', () => {
    const result = reduceSse(runningState(), toolCall({ mode: 'show' }), 'show');
    expect(result.effects[0]!.mode).toBe('show');
  });
});

describe('reduceSse — chat/response', () => {
  it('resolves the matching placeholder', () => {
    const state: SseState = pendingReply();
    const event: WidgetEvent = { type: 'chat/response', request_id: 'req-1', text: 'Here you go' };
    const result = reduceSse(state, event, 'tell');

    const msg = result.state.messages[0]!;
    expect(messageText(msg.parts)).toBe('Here you go');
    expect(msg.isPlaceholder).toBe(false);
    expect(msg.placeholderState).toBeUndefined();
    expect(msg.parts?.[msg.parts.length - 1]).toEqual({ type: 'text', content: 'Here you go' });
    expect(result.effects).toEqual([]);
  });
});

describe('reduceSse — chat/delta', () => {
  it('accumulates fragments into one streaming part and clears the placeholder', () => {
    const state: SseState = pendingReply();
    const first = reduceSse(state, { type: 'chat/delta', request_id: 'req-1', text: 'Hel' }, 'tell');
    const second = reduceSse(first.state, { type: 'chat/delta', request_id: 'req-1', text: 'lo' }, 'tell');

    const msg = second.state.messages[0]!;
    expect(messageText(msg.parts)).toBe('Hello');
    expect(msg.isPlaceholder).toBe(false);
    expect(msg.parts).toEqual([{ type: 'text', content: 'Hello', streaming: true }]);
    expect(second.effects).toEqual([]);
  });

  it('final chat/response replaces the streamed part (no duplication)', () => {
    const state: SseState = pendingReply();
    const streamed = reduceSse(state, { type: 'chat/delta', request_id: 'req-1', text: 'Hello wor' }, 'tell');
    const final = reduceSse(
      streamed.state,
      { type: 'chat/response', request_id: 'req-1', text: 'Hello world' },
      'tell',
    );

    const msg = final.state.messages[0]!;
    expect(messageText(msg.parts)).toBe('Hello world');
    expect(msg.parts).toEqual([{ type: 'text', content: 'Hello world' }]);
    expect(final.effects).toEqual([]);
  });

  it('a retransmitted final response is dropped, not appended again', () => {
    const state: SseState = pendingReply();
    const once = reduceSse(state, { type: 'chat/response', request_id: 'req-1', text: 'Hello world' }, 'tell');
    const repeated = reduceSse(once.state, { type: 'chat/response', request_id: 'req-1', text: 'Hello world' }, 'tell');

    expect(repeated.state.messages[0]).toEqual(once.state.messages[0]);
    expect(repeated.state.messages[0]!.parts).toEqual([{ type: 'text', content: 'Hello world' }]);
  });
});

describe('reduceSse — chat/error', () => {
  it('settles the matching placeholder with the human sentence, never the raw server error', () => {
    const state: SseState = {
      messages: [agentMessage({ id: 'req-2' })],
      task: { phase: 'idle' },
    };
    const event: WidgetEvent = { type: 'chat/error', request_id: 'req-2', error: 'PG::ConnectionBad at line 42' };
    const result = reduceSse(state, event, 'tell');
    expect(messageText(result.state.messages[0]!.parts)).toBe(`Working on it\n${CHAT_FAILURE_TEXT}`);
    expect(messageText(result.state.messages[0]!.parts)).not.toContain('PG::ConnectionBad');
    expect(result.state.messages[0]!.isPlaceholder).toBe(false);
    expect(result.effects).toEqual([]);
  });
});

describe('reduceSse — ignored events', () => {
  it.each([{ type: 'registered', chat_id: 'c1' }, { type: 'heartbeat' }] as const satisfies WidgetEvent[])(
    '$type is a no-op (same state, no effects)',
    event => {
      const state = runningState();
      const result = reduceSse(state, event, 'do');
      expectNoOp(result, state);
    },
  );
});

describe('reduceToolProgress / reduceToolDone / reduceStop', () => {
  it('completed marks the in-progress line complete', () => {
    const inProgress = reduceSse(runningState(), toolCall({ tool_call_id: 'c', explanation: 'x' }), 'do').state;
    const done = reduceToolProgress(inProgress, 'click_element', 'x', 'completed', 'do');
    const part = (done.messages[0]!.parts ?? []).find(p => p.type === 'progress');
    expect(part?.status).toBe('completed');
  });

  it('failed marks the line failed and surfaces the error text', () => {
    const inProgress = reduceSse(runningState(), toolCall({ tool_call_id: 'c', explanation: 'Clicking' }), 'do').state;
    const failed = reduceToolProgress(inProgress, 'click_element', 'Clicking', 'failed', 'do', 'no element');
    const part = (failed.messages[0]!.parts ?? []).find(p => p.type === 'progress');
    expect(part?.status).toBe('failed');
    expect(part?.content).toContain('no element');
  });

  it('closes the line of the tool that finished, not the newest open one', () => {
    const twoOpen = reduceSse(
      reduceSse(runningState(), toolCall({ tool_call_id: 'c1', explanation: 'click_element' }), 'show').state,
      { type: 'tool/call', tool_call_id: 'c2', browser_tool: 'get_html', args: {}, explanation: 'get_html' },
      'show',
    ).state;

    const done = reduceToolProgress(twoOpen, 'click_element', 'click_element', 'completed', 'show');

    const lines = (done.messages[0]!.parts ?? []).filter(p => p.type === 'progress');
    expect(lines.map(line => [line.browserToolName, line.status])).toEqual([
      ['click_element', 'completed'],
      ['get_html', 'in_progress'],
    ]);
  });

  it('does not touch placeholderState when the task is not actually running, even in Show/Do mode', () => {
    const result = reduceToolProgress(idleState(), 'click_element', 'x', 'in_progress', 'show');
    expect(result.messages[0]!.placeholderState).toBeUndefined();
  });

  it.each([
    ['do', 'thinking'],
    ['show', 'waiting-for-user'],
  ] as const)('in %s mode a mid-progress tool sets placeholderState to %s', (mode, placeholderState) => {
    const result = reduceToolProgress(runningState({ mode }), 'click_element', 'x', 'in_progress', mode);
    expect(result.messages[0]!.placeholderState).toBe(placeholderState);
  });

  it('judges progress by the mode the task actually started in, not whatever the composer shows now', () => {
    const state: SseState = {
      messages: [agentMessage({ mode: 'show', isPlaceholder: true })],
      task: { phase: 'running', mode: 'show' },
    };
    const result = reduceToolProgress(state, 'click_element', 'x', 'in_progress', 'do');
    expect(result.messages[0]!.placeholderState).toBe('waiting-for-user');
  });

  it('reduceToolDone ends the task and marks the message done', () => {
    const result = reduceToolDone(runningState(), 'do', true);
    expect(result.task).toEqual({ phase: 'idle' });
    expect(result.messages[0]!.taskStatus).toBe('done');
  });

  it('reduceToolDone marks the message failed when the agent reports it did not succeed', () => {
    expect(reduceToolDone(runningState(), 'do', false).messages[0]!.taskStatus).toBe('failed');
  });

  it('a duplicate completion does not fall back past the stamp onto an older settled reply', () => {
    const oldReply = agentMessage({
      id: 'agent-0',
      isPlaceholder: false,
      parts: [{ type: 'text', content: 'Old answer' }],
    });
    const state: SseState = { messages: [oldReply, agentMessage()], task: { phase: 'running' } };

    const afterFirst = reduceToolDone(state, 'do', true);
    expect(afterFirst.messages[1]!.taskStatus).toBe('done');

    const afterDuplicate = reduceToolDone(afterFirst, 'do', true);

    expect(afterDuplicate.messages[0]).toEqual(oldReply);
  });

  it('reduceStop marks the active message stopped and ends the task', () => {
    const result = reduceStop(runningState(), 'do');
    expect(result.messages[0]!.taskStatus).toBe('stopped');
    expect(result.task).toEqual({ phase: 'stopped' });
  });

  it('finish carries no progress line and clears whatever trajectory came before it', () => {
    const withTrajectory = runningState({
      parts: [
        { type: 'text', content: 'Working on it' },
        { type: 'progress', content: 'Reading the page', status: 'completed', browserToolName: 'get_html' },
      ],
    });

    const called = reduceSse(
      withTrajectory,
      {
        type: 'tool/call',
        tool_call_id: 'c',
        browser_tool: 'done',
        args: { message: 'Wrapping up', success: true },
        explanation: 'Wrapping up',
      },
      'tell',
    ).state;
    const succeeded = reduceToolProgress(called, 'done', 'Wrapping up', 'completed', 'tell');
    const done = reduceToolDone(succeeded, 'tell', true);

    const parts = done.messages[0]!.parts;
    expect(parts.some(p => p.type === 'progress')).toBe(false);
    expect(JSON.stringify(parts)).not.toContain('Unknown tool');
  });
});

describe('Stop is the visitor withdrawing their page from the agent', () => {
  const lateCall = toolCall({ tool_call_id: 'call-late' });

  it('a tool call that raced the stop is not executed on the visitor page', () => {
    const stopped = reduceStop(runningState(), 'do');

    const result = reduceSse(stopped, lateCall, 'do');

    expect(result.effects).toEqual([]);
    expect(result.state).toBe(stopped);
  });

  it('the run reporting itself finished does not take the refusal off', () => {
    const stopped = reduceStop(runningState(), 'do');

    const settledByAgent = reduceSse(stopped, { type: 'task/status', status: 'completed' }, 'do').state;

    expect(reduceSse(settledByAgent, lateCall, 'do').effects).toEqual([]);
  });

  it('the next request the visitor sends takes the refusal off', () => {
    const stopped = reduceStop(runningState(), 'do');
    const redispatched = reduceDispatch(stopped, agentMessage({ id: 'agent-2' }));

    const result = reduceSse(redispatched, lateCall, 'do');

    expect(result.effects).toHaveLength(1);
    expect(result.state.task.phase).toBe('running');
  });
});

describe('a message reports the text it shows', () => {
  it('carries every text part, not only the last one written', () => {
    const state: SseState = {
      messages: [agentMessage({ parts: [{ type: 'text', content: 'first' }] })],
      task: { phase: 'running' },
    };

    const event: WidgetEvent = { type: 'chat/response', request_id: 'agent-1', text: 'second' };
    const result = reduceSse(state, event, 'tell');

    const [message] = result.state.messages;
    expect(message?.parts.filter(part => part.type === 'text').map(part => part.content)).toEqual(['first', 'second']);
  });

  it('leaves a progress line out of the text, because a progress line is not the answer', () => {
    expect(
      messageText([
        { type: 'progress', content: 'Reading the page' },
        { type: 'text', content: 'Here you go' },
      ]),
    ).toBe('Here you go');
  });
});
