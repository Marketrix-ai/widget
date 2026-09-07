import { describe, expect, it } from 'vitest';

import type { WidgetEvent } from '@/sdk';
import { type ChatMessage, messageText } from '@/types';

import {
  reduceDispatch,
  reduceSse,
  reduceStaleReply,
  reduceStop,
  reduceToolDone,
  reduceToolProgress,
  reduceTransportFailure,
  type SseState,
} from '../sseReducer';

const agentMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'agent-1',
  content: 'Working on it',
  sender: 'agent',
  timestamp: new Date(),
  mode: 'do',
  isPlaceholder: true,
  placeholderState: 'thinking',
  parts: [{ type: 'text', content: 'Working on it' }],
  ...overrides,
});

const runningState = (overrides: Partial<ChatMessage> = {}): SseState => ({
  messages: [agentMessage(overrides)],
  task: { phase: 'running' },
});

const idleState = (): SseState => ({
  messages: [agentMessage({ placeholderState: undefined })],
  task: { phase: 'idle' },
});

describe('reduceSse — task/status', () => {
  it('running is a no-op — the first tool/call is what activates the task', () => {
    const state = idleState();
    const result = reduceSse(state, { type: 'task/status', status: 'running' }, 'do');
    expect(result.state).toBe(state);
    expect(result.effects).toEqual([]);
  });

  it('completed ends the task and marks the active message done', () => {
    const result = reduceSse(runningState(), { type: 'task/status', status: 'completed' }, 'do');
    expect(result.state.task).toEqual({ phase: 'idle' });
    expect(result.state.messages[0].taskStatus).toBe('done');
  });

  it('failed ends the task and marks the active message failed', () => {
    const result = reduceSse(runningState(), { type: 'task/status', status: 'failed' }, 'do');
    expect(result.state.task.phase).toBe('idle');
    expect(result.state.messages[0].taskStatus).toBe('failed');
  });

  it('stopped ends the task and marks the active message stopped', () => {
    const result = reduceSse(runningState(), { type: 'task/status', status: 'stopped' }, 'do');
    expect(result.state.task.phase).toBe('idle');
    expect(result.state.messages[0].taskStatus).toBe('stopped');
  });

  it('terminal status renders its closing message as a text part, not content alone', () => {
    const event: WidgetEvent = { type: 'task/status', status: 'completed', message: 'All done!' };
    const result = reduceSse(runningState({ parts: [{ type: 'progress', content: 'Clicking element' }] }), event, 'do');

    expect(result.state.messages[0].content).toBe('All done!');
    expect(result.state.messages[0].parts).toEqual([
      { type: 'progress', content: 'Clicking element' },
      { type: 'text', content: 'All done!' },
    ]);
  });

  it('has_question pauses (not terminal): flips the spinner to waiting-for-user, no taskStatus', () => {
    const before = runningState();
    expect(before.messages[0].placeholderState).toBe('thinking');

    const event: WidgetEvent = { type: 'task/status', status: 'has_question', message: 'Which account?' };
    const result = reduceSse(before, event, 'do');

    const msg = result.state.messages[0];
    expect(msg.placeholderState).toBe('waiting-for-user');
    expect(msg.content).toContain('Which account?');
    expect(msg.parts.at(-1)).toEqual({ type: 'text', content: 'Which account?' });
    // Paused, not finished — no terminal icon.
    expect(msg.taskStatus).toBeUndefined();
    expect(result.state.task).toEqual({ phase: 'idle' });
  });

  // The composer is disabled while a placeholder stands, and both `has_question` and every terminal
  // status also end the task — so leaving one pending left no control able to release it.
  it.each(['completed', 'failed', 'stopped', 'has_question'] as const)('%s settles the placeholder', status => {
    const result = reduceSse(runningState(), { type: 'task/status', status }, 'do');
    expect(result.state.messages[0].isPlaceholder).toBe(false);
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
    expect(result.messages[1].isPlaceholder).toBe(false);
    expect(result.messages[1].content).toBe('Working on it\nCould not reconnect to the assistant. Try again.');
    expect(result.task).toEqual({ phase: 'idle' });
  });
});

describe('reduceStaleReply', () => {
  it('settles a placeholder that showed zero signs of life', () => {
    const state: SseState = { messages: [agentMessage({ parts: [] })], task: { phase: 'idle' } };
    const result = reduceStaleReply(state, 'agent-1', 'This is taking longer than expected. Please try again.');

    expect(result.messages[0].isPlaceholder).toBe(false);
    expect(result.messages[0].content).toBe('This is taking longer than expected. Please try again.');
  });

  it('settles a placeholder that has gone silent for the deadline even while its task is still running', () => {
    const state: SseState = { messages: [agentMessage()], task: { phase: 'running' } };
    const result = reduceStaleReply(state, 'agent-1', 'timeout text');

    expect(result.messages[0].isPlaceholder).toBe(false);
    expect(result.messages[0].content).toBe('Working on it\ntimeout text');
  });

  it('never overwrites a running task paused on the visitor, even with no text yet', () => {
    const state: SseState = {
      messages: [agentMessage({ placeholderState: 'waiting-for-user', parts: [] })],
      task: { phase: 'running' },
    };
    expect(reduceStaleReply(state, 'agent-1', 'timeout text')).toBe(state);
  });

  it('releases a placeholder left behind by a reload, progress lines and all, once no task is running', () => {
    const state: SseState = { messages: [agentMessage()], task: { phase: 'idle' } };
    const result = reduceStaleReply(state, 'agent-1', 'timeout text');

    expect(result.messages[0].isPlaceholder).toBe(false);
    expect(result.messages[0].content).toBe('Working on it\ntimeout text');
  });

  it('never overwrites a message that already settled', () => {
    const state: SseState = {
      messages: [agentMessage({ isPlaceholder: false, content: 'All done' })],
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
    expect(stale.messages[0].taskStatus).toBe('failed');

    const late = reduceSse(stale, { type: 'task/status', status: 'completed' }, 'do');
    expect(late.state.messages[0].taskStatus).toBe('failed');
    expect(late.state.messages[0].content).toBe('This is taking longer than expected. Please try again.');
  });
});

describe('reduceSse — tool/call', () => {
  const toolCall = (overrides: Partial<Extract<WidgetEvent, { type: 'tool/call' }>> = {}): WidgetEvent => ({
    type: 'tool/call',
    tool_call_id: 'call-1',
    browser_tool: 'click_element',
    args: { index: 1 },
    explanation: 'Clicking the submit button',
    ...overrides,
  });

  it('emits an executeTool effect carrying the call details', () => {
    const result = reduceSse(runningState(), toolCall(), 'do');
    expect(result.effects).toEqual([
      {
        type: 'executeTool',
        toolCallId: 'call-1',
        tool: 'click_element',
        args: { index: 1 },
        mode: 'do',
        explanation: 'Clicking the submit button',
      },
    ]);
  });

  it('auto-activates the task when a tool arrives before task/status running', () => {
    const result = reduceSse(idleState(), toolCall(), 'do');
    expect(result.state.task.phase).toBe('running');
  });

  it('adds an in-progress progress line to the active message', () => {
    const result = reduceSse(runningState(), toolCall(), 'do');
    const progressParts = (result.state.messages[0].parts ?? []).filter(p => p.type === 'progress');
    expect(progressParts).toHaveLength(1);
    expect(progressParts[0].status).toBe('in_progress');
  });

  it('announces a DOM read as reading the page — nothing but screen sharing views the visitor screen', () => {
    const result = reduceSse(runningState(), toolCall({ browser_tool: 'get_html', explanation: '' }), 'do');
    const line = (result.state.messages[0].parts ?? []).find(part => part.type === 'progress');
    expect(line?.content).toBe('Reading the page');
    expect(line?.content).not.toMatch(/screen/i);
  });

  it('falls back to event.mode then "do" when currentMode is absent on the call', () => {
    const result = reduceSse(runningState(), toolCall({ mode: 'show' }), 'show');
    expect(result.effects[0].mode).toBe('show');
  });
});

describe('reduceSse — chat/response', () => {
  it('resolves the matching placeholder', () => {
    const state: SseState = {
      messages: [agentMessage({ id: 'req-1', content: '', parts: [] })],
      task: { phase: 'idle' },
    };
    const event: WidgetEvent = { type: 'chat/response', request_id: 'req-1', text: 'Here you go' };
    const result = reduceSse(state, event, 'tell');

    const msg = result.state.messages[0];
    expect(msg.content).toBe('Here you go');
    expect(msg.isPlaceholder).toBe(false);
    expect(msg.placeholderState).toBeUndefined();
    expect(msg.parts?.at(-1)).toEqual({ type: 'text', content: 'Here you go' });
    expect(result.effects).toEqual([]);
  });
});

describe('reduceSse — chat/delta', () => {
  it('accumulates fragments into one streaming part and clears the placeholder', () => {
    const state: SseState = {
      messages: [agentMessage({ id: 'req-1', content: '', parts: [] })],
      task: { phase: 'idle' },
    };
    const first = reduceSse(state, { type: 'chat/delta', request_id: 'req-1', text: 'Hel' }, 'tell');
    const second = reduceSse(first.state, { type: 'chat/delta', request_id: 'req-1', text: 'lo' }, 'tell');

    const msg = second.state.messages[0];
    expect(msg.content).toBe('Hello');
    expect(msg.isPlaceholder).toBe(false);
    expect(msg.parts).toEqual([{ type: 'text', content: 'Hello', streaming: true }]);
    expect(second.effects).toEqual([]);
  });

  it('final chat/response replaces the streamed part (no duplication)', () => {
    const state: SseState = {
      messages: [agentMessage({ id: 'req-1', content: '', parts: [] })],
      task: { phase: 'idle' },
    };
    const streamed = reduceSse(state, { type: 'chat/delta', request_id: 'req-1', text: 'Hello wor' }, 'tell');
    const final = reduceSse(
      streamed.state,
      { type: 'chat/response', request_id: 'req-1', text: 'Hello world' },
      'tell',
    );

    const msg = final.state.messages[0];
    expect(msg.content).toBe('Hello world');
    expect(msg.parts).toEqual([{ type: 'text', content: 'Hello world' }]);
    expect(final.effects).toEqual([]);
  });
});

describe('reduceSse — chat/error', () => {
  it('writes an error message into the matching placeholder', () => {
    const state: SseState = {
      messages: [agentMessage({ id: 'req-2' })],
      task: { phase: 'idle' },
    };
    const event: WidgetEvent = { type: 'chat/error', request_id: 'req-2', error: 'boom' };
    const result = reduceSse(state, event, 'tell');
    expect(result.state.messages[0].content).toBe('Working on it\nError: boom');
    expect(result.state.messages[0].isPlaceholder).toBe(false);
    expect(result.effects).toEqual([]);
  });
});

describe('reduceSse — ignored events', () => {
  it.each(['registered', 'heartbeat'] as const)('%s is a no-op (same state, no effects)', type => {
    const state = runningState();
    const event = { type, chat_id: 'c1' } as unknown as WidgetEvent;
    const result = reduceSse(state, event, 'do');
    expect(result.state).toBe(state);
    expect(result.effects).toEqual([]);
  });
});

describe('reduceToolProgress / reduceToolDone / reduceStop', () => {
  it('completed marks the in-progress line complete', () => {
    const inProgress = reduceSse(
      runningState(),
      {
        type: 'tool/call',
        tool_call_id: 'c',
        browser_tool: 'click_element',
        args: {},
        explanation: 'x',
      },
      'do',
    ).state;
    const done = reduceToolProgress(inProgress, 'click_element', 'x', 'completed', 'do');
    const part = (done.messages[0].parts ?? []).find(p => p.type === 'progress');
    expect(part?.status).toBe('completed');
  });

  it('failed marks the line failed and surfaces the error text', () => {
    const inProgress = reduceSse(
      runningState(),
      {
        type: 'tool/call',
        tool_call_id: 'c',
        browser_tool: 'click_element',
        args: {},
        explanation: 'Clicking',
      },
      'do',
    ).state;
    const failed = reduceToolProgress(inProgress, 'click_element', 'Clicking', 'failed', 'do', 'no element');
    const part = (failed.messages[0].parts ?? []).find(p => p.type === 'progress');
    expect(part?.status).toBe('failed');
    expect(part?.content).toContain('no element');
  });

  it('closes the line of the tool that finished, not the newest open one', () => {
    const call = (browser_tool: string, tool_call_id: string): WidgetEvent => ({
      type: 'tool/call',
      tool_call_id,
      browser_tool,
      args: {},
      explanation: browser_tool,
    });
    const twoOpen = reduceSse(
      reduceSse(runningState(), call('click_element', 'c1'), 'show').state,
      call('get_html', 'c2'),
      'show',
    ).state;

    const done = reduceToolProgress(twoOpen, 'click_element', 'click_element', 'completed', 'show');

    const lines = (done.messages[0].parts ?? []).filter(p => p.type === 'progress');
    expect(lines.map(line => [line.browserToolName, line.status])).toEqual([
      ['click_element', 'completed'],
      ['get_html', 'in_progress'],
    ]);
  });

  it('reduceToolDone ends the task and marks the message done', () => {
    const result = reduceToolDone(runningState(), 'do');
    expect(result.task).toEqual({ phase: 'idle' });
    expect(result.messages[0].taskStatus).toBe('done');
  });

  it('a duplicate completion does not fall back past the stamp onto an older settled reply', () => {
    const oldReply = agentMessage({ id: 'agent-0', isPlaceholder: false, content: 'Old answer' });
    const state: SseState = { messages: [oldReply, agentMessage()], task: { phase: 'running' } };

    const afterFirst = reduceToolDone(state, 'do');
    expect(afterFirst.messages[1].taskStatus).toBe('done');

    const afterDuplicate = reduceToolDone(afterFirst, 'do');

    expect(afterDuplicate.messages[0]).toEqual(oldReply);
  });

  it('reduceStop marks the active message stopped and ends the task', () => {
    const result = reduceStop(runningState(), 'do');
    expect(result.messages[0].taskStatus).toBe('stopped');
    expect(result.task).toEqual({ phase: 'stopped' });
  });
});

describe('Stop is the visitor withdrawing their page from the agent', () => {
  const toolCall: WidgetEvent = {
    type: 'tool/call',
    tool_call_id: 'call-late',
    browser_tool: 'click_element',
    args: { index: 1 },
    explanation: 'Clicking the submit button',
  };

  it('a tool call that raced the stop is not executed on the visitor page', () => {
    const stopped = reduceStop(runningState(), 'do');

    const result = reduceSse(stopped, toolCall, 'do');

    expect(result.effects).toEqual([]);
    expect(result.state).toBe(stopped);
  });

  it('the run reporting itself finished does not take the refusal off', () => {
    const stopped = reduceStop(runningState(), 'do');

    const settledByAgent = reduceSse(stopped, { type: 'task/status', status: 'completed' }, 'do').state;

    expect(reduceSse(settledByAgent, toolCall, 'do').effects).toEqual([]);
  });

  it('the next request the visitor sends takes the refusal off', () => {
    const stopped = reduceStop(runningState(), 'do');
    const redispatched = reduceDispatch(stopped, agentMessage({ id: 'agent-2' }));

    const result = reduceSse(redispatched, toolCall, 'do');

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
    expect(message?.content).toBe(messageText(message?.parts ?? []));
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
