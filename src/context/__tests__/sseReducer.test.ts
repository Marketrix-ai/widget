// Unit tests for the pure SSE reducer — pin the state transitions the ChatContext effect drives.
import { describe, expect, it } from 'vitest';

import type { WidgetEvent } from '@/sdk';
import type { ChatMessage } from '@/types';
import { hasThinkingMarker } from '@/utils/chat';

import { reduceSse, reduceStop, reduceToolDone, reduceToolProgress, type SseState } from '../sseReducer';

// Fixtures
// ---------------------------------------------------------------------------

const agentMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'agent-1',
  content: 'Working on it\n\n__THINKING__',
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
  task: { activeSimulationId: 'task-1', isSimulationRunning: true },
});

const idleState = (): SseState => ({
  messages: [agentMessage({ placeholderState: undefined })],
  task: { activeSimulationId: null, isSimulationRunning: false },
});

// task/status
// ---------------------------------------------------------------------------

describe('reduceSse — task/status', () => {
  it('running is a pure no-op — activation is gated on pendingTaskRef in the wiring', () => {
    const state = idleState();
    const event: WidgetEvent = { type: 'task/status', status: 'running', task_id: 'task-9' };
    const result = reduceSse(state, event, 'do');
    expect(result.state).toBe(state);
    expect(result.effects).toEqual([]);
  });

  it('running without task_id is also a no-op', () => {
    const state = idleState();
    const result = reduceSse(state, { type: 'task/status', status: 'running' }, 'do');
    expect(result.state).toBe(state);
    expect(result.effects).toEqual([]);
  });

  it('completed ends the task and marks the active message done', () => {
    const result = reduceSse(runningState(), { type: 'task/status', status: 'completed' }, 'do');
    expect(result.state.task).toEqual({ isSimulationRunning: false, activeSimulationId: null });
    expect(result.state.messages[0].simulationStatus).toBe('done');
  });

  it('failed ends the task and marks the active message failed', () => {
    const result = reduceSse(runningState(), { type: 'task/status', status: 'failed' }, 'do');
    expect(result.state.task.isSimulationRunning).toBe(false);
    expect(result.state.messages[0].simulationStatus).toBe('failed');
  });

  it('stopped ends the task and marks the active message stopped', () => {
    const result = reduceSse(runningState(), { type: 'task/status', status: 'stopped' }, 'do');
    expect(result.state.task.isSimulationRunning).toBe(false);
    expect(result.state.messages[0].simulationStatus).toBe('stopped');
  });

  it('terminal status overwrites content when the event carries a message', () => {
    const event: WidgetEvent = { type: 'task/status', status: 'completed', message: 'All done!' };
    const result = reduceSse(runningState(), event, 'do');
    expect(result.state.messages[0].content).toBe('All done!');
  });

  it('has_question pauses (not terminal): clears spinner, flips to waiting-for-user, no simulationStatus', () => {
    const before = runningState();
    expect(hasThinkingMarker(before.messages[0].content)).toBe(true);

    const event: WidgetEvent = { type: 'task/status', status: 'has_question', message: 'Which account?' };
    const result = reduceSse(before, event, 'do');

    const msg = result.state.messages[0];
    expect(hasThinkingMarker(msg.content)).toBe(false);
    expect(msg.placeholderState).toBe('waiting-for-user');
    expect(msg.content).toContain('Which account?');
    // Paused, not finished — no terminal icon.
    expect(msg.simulationStatus).toBeUndefined();
    expect(result.state.task).toEqual({ isSimulationRunning: false, activeSimulationId: null });
  });
});

// tool/call
// ---------------------------------------------------------------------------

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
    expect(result.state.task.isSimulationRunning).toBe(true);
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

// chat/response & chat/error
// ---------------------------------------------------------------------------

describe('reduceSse — chat/response', () => {
  it('resolves the matching placeholder and turns off loading', () => {
    const state: SseState = {
      messages: [agentMessage({ id: 'req-1', content: '\n\n__THINKING__', parts: [] })],
      task: { activeSimulationId: null, isSimulationRunning: false },
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
      messages: [agentMessage({ id: 'req-1', content: '\n\n__THINKING__', parts: [] })],
      task: { activeSimulationId: null, isSimulationRunning: false },
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
      messages: [agentMessage({ id: 'req-1', content: '\n\n__THINKING__', parts: [] })],
      task: { activeSimulationId: null, isSimulationRunning: false },
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
      task: { activeSimulationId: null, isSimulationRunning: false },
    };
    const event: WidgetEvent = { type: 'chat/error', request_id: 'req-2', error: 'boom' };
    const result = reduceSse(state, event, 'tell');
    expect(result.state.messages[0].content).toBe('Error: boom');
    expect(result.state.messages[0].isPlaceholder).toBe(false);
    expect(result.effects).toEqual([{ type: 'setLoading', value: false }]);
  });
});

// Unknown / non-stateful events
// ---------------------------------------------------------------------------

describe('reduceSse — ignored events', () => {
  it.each(['registered', 'heartbeat'] as const)('%s is a no-op (same state, no effects)', type => {
    const state = runningState();
    const event = { type, chat_id: 'c1' } as unknown as WidgetEvent;
    const result = reduceSse(state, event, 'do');
    expect(result.state).toBe(state);
    expect(result.effects).toEqual([]);
  });
});

// Tool lifecycle helpers
// ---------------------------------------------------------------------------

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

  it('reduceToolDone ends the task, marks done, and strips the lingering done progress line', () => {
    const withDoneLine: SseState = {
      messages: [
        agentMessage({
          parts: [
            { type: 'text', content: 'Working on it' },
            { type: 'progress', content: 'Finishing', status: 'in_progress', browserToolName: 'done' },
          ],
        }),
      ],
      task: { activeSimulationId: 'task-1', isSimulationRunning: true },
    };
    const result = reduceToolDone(withDoneLine, 'do');
    expect(result.task).toEqual({ isSimulationRunning: false, activeSimulationId: null });
    expect(result.messages[0].simulationStatus).toBe('done');
    expect((result.messages[0].parts ?? []).some(p => p.type === 'progress' && p.browserToolName === 'done')).toBe(
      false,
    );
  });

  it('reduceStop marks the active message stopped and ends the task', () => {
    const result = reduceStop(runningState(), 'do');
    expect(result.messages[0].simulationStatus).toBe('stopped');
    expect(result.task).toEqual({ isSimulationRunning: false, activeSimulationId: null });
  });
});
