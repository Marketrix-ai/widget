import { describe, expect, it } from 'vitest';

import type { WidgetEvent } from '@/sdk';
import type { ChatMessage } from '@/types';

import {
  reduceSse,
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
  task: { isTaskRunning: true },
});

const idleState = (): SseState => ({
  messages: [agentMessage({ placeholderState: undefined })],
  task: { isTaskRunning: false },
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
    expect(result.state.task).toEqual({ isTaskRunning: false });
    expect(result.state.messages[0].taskStatus).toBe('done');
  });

  it('failed ends the task and marks the active message failed', () => {
    const result = reduceSse(runningState(), { type: 'task/status', status: 'failed' }, 'do');
    expect(result.state.task.isTaskRunning).toBe(false);
    expect(result.state.messages[0].taskStatus).toBe('failed');
  });

  it('stopped ends the task and marks the active message stopped', () => {
    const result = reduceSse(runningState(), { type: 'task/status', status: 'stopped' }, 'do');
    expect(result.state.task.isTaskRunning).toBe(false);
    expect(result.state.messages[0].taskStatus).toBe('stopped');
  });

  it('terminal status overwrites content when the event carries a message', () => {
    const event: WidgetEvent = { type: 'task/status', status: 'completed', message: 'All done!' };
    const result = reduceSse(runningState(), event, 'do');
    expect(result.state.messages[0].content).toBe('All done!');
  });

  it('has_question pauses (not terminal): flips the spinner to waiting-for-user, no taskStatus', () => {
    const before = runningState();
    expect(before.messages[0].placeholderState).toBe('thinking');

    const event: WidgetEvent = { type: 'task/status', status: 'has_question', message: 'Which account?' };
    const result = reduceSse(before, event, 'do');

    const msg = result.state.messages[0];
    expect(msg.placeholderState).toBe('waiting-for-user');
    expect(msg.content).toContain('Which account?');
    // Paused, not finished — no terminal icon.
    expect(msg.taskStatus).toBeUndefined();
    expect(result.state.task).toEqual({ isTaskRunning: false });
  });

  // The composer is disabled while a placeholder stands, and both `has_question` and every terminal
  // status also clear isTaskRunning — so leaving one pending left no control able to release it.
  it.each(['completed', 'failed', 'stopped', 'has_question'] as const)('%s settles the placeholder', status => {
    const result = reduceSse(runningState(), { type: 'task/status', status }, 'do');
    expect(result.state.messages[0].isPlaceholder).toBe(false);
  });
});

describe('reduceTransportFailure', () => {
  it('settles every pending bubble into an error and ends the task', () => {
    const state: SseState = {
      messages: [agentMessage({ id: 'settled', isPlaceholder: false }), agentMessage({ id: 'pending' })],
      task: { isTaskRunning: true },
    };
    const result = reduceTransportFailure(state, 'Could not reconnect to the assistant. Try again.');

    expect(result.messages[0]).toBe(state.messages[0]);
    expect(result.messages[1].isPlaceholder).toBe(false);
    expect(result.messages[1].content).toBe('Could not reconnect to the assistant. Try again.');
    expect(result.task).toEqual({ isTaskRunning: false });
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
    expect(result.state.task.isTaskRunning).toBe(true);
  });

  it('adds an in-progress progress line to the active message', () => {
    const result = reduceSse(runningState(), toolCall(), 'do');
    const progressParts = (result.state.messages[0].parts ?? []).filter(p => p.type === 'progress');
    expect(progressParts).toHaveLength(1);
    expect(progressParts[0].status).toBe('in_progress');
  });

  it('falls back to event.mode then "do" when currentMode is absent on the call', () => {
    const result = reduceSse(runningState(), toolCall({ mode: 'show' }), 'show');
    const effect = result.effects[0];
    expect(effect.type === 'executeTool' && effect.mode).toBe('show');
  });
});

describe('reduceSse — chat/response', () => {
  it('resolves the matching placeholder and turns off loading', () => {
    const state: SseState = {
      messages: [agentMessage({ id: 'req-1', content: '', parts: [] })],
      task: { isTaskRunning: false },
    };
    const event: WidgetEvent = { type: 'chat/response', request_id: 'req-1', text: 'Here you go' };
    const result = reduceSse(state, event, 'tell');

    const msg = result.state.messages[0];
    expect(msg.content).toBe('Here you go');
    expect(msg.isPlaceholder).toBe(false);
    expect(msg.placeholderState).toBeUndefined();
    expect(msg.parts?.at(-1)).toEqual({ type: 'text', content: 'Here you go' });
    expect(result.effects).toContainEqual({ type: 'setLoading', value: false });
  });
});

describe('reduceSse — chat/delta', () => {
  it('accumulates fragments into one streaming part and clears the placeholder', () => {
    const state: SseState = {
      messages: [agentMessage({ id: 'req-1', content: '', parts: [] })],
      task: { isTaskRunning: false },
    };
    const first = reduceSse(state, { type: 'chat/delta', request_id: 'req-1', text: 'Hel' }, 'tell');
    const second = reduceSse(first.state, { type: 'chat/delta', request_id: 'req-1', text: 'lo' }, 'tell');

    const msg = second.state.messages[0];
    expect(msg.content).toBe('Hello');
    expect(msg.isPlaceholder).toBe(false);
    expect(msg.parts).toEqual([{ type: 'text', content: 'Hello', streaming: true }]);
    // Still streaming — loading stays on until the final chat/response.
    expect(second.effects).toEqual([]);
  });

  it('final chat/response replaces the streamed part (no duplication)', () => {
    const state: SseState = {
      messages: [agentMessage({ id: 'req-1', content: '', parts: [] })],
      task: { isTaskRunning: false },
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
    expect(final.effects).toContainEqual({ type: 'setLoading', value: false });
  });
});

describe('reduceSse — chat/error', () => {
  it('writes an error message into the matching placeholder and turns off loading', () => {
    const state: SseState = {
      messages: [agentMessage({ id: 'req-2' })],
      task: { isTaskRunning: false },
    };
    const event: WidgetEvent = { type: 'chat/error', request_id: 'req-2', error: 'boom' };
    const result = reduceSse(state, event, 'tell');
    expect(result.state.messages[0].content).toBe('Error: boom');
    expect(result.state.messages[0].isPlaceholder).toBe(false);
    expect(result.effects).toEqual([{ type: 'setLoading', value: false }]);
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

  it('reduceToolDone ends the task and marks the message done', () => {
    const result = reduceToolDone(runningState(), 'do');
    expect(result.task).toEqual({ isTaskRunning: false });
    expect(result.messages[0].taskStatus).toBe('done');
  });

  it('reduceStop marks the active message stopped and ends the task', () => {
    const result = reduceStop(runningState(), 'do');
    expect(result.messages[0].taskStatus).toBe('stopped');
    expect(result.task).toEqual({ isTaskRunning: false });
  });
});
