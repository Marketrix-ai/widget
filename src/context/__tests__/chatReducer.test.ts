/**
 * Tests for `chatReducer`'s pure state machine folding SSE events and local actions into chat messages
 * and task state — status transitions, tool-call progress lines, streaming replies, stale-reply and
 * transport-failure recovery, and stop handling.
 */
import { describe, expect, it } from 'bun:test';

import type { WidgetEvent } from '../../sdk';
import type { WidgetToolCall } from '../../services/browserTools';
import { agentMessage, ofKind, toolCall } from '../../test/fixtures';
import type { AgentMessage } from '../../types';
import { CHAT_FAILURE_TEXT, isPending, messageText } from '../../utils/chat';
import {
  type ChatState,
  reduceDispatch,
  reduceEvent,
  reduceStaleReply,
  reduceStop,
  reduceToolDone,
  reduceToolProgress,
  reduceTransportFailure,
} from '../chatReducer';

const agentAt = (state: ChatState, index = 0) => ofKind(state.messages[index], 'agent');
const textAt = (state: ChatState, index = 0) => messageText(agentAt(state, index).parts);

const expectNoOp = (result: ChatState, state: ChatState) => {
  expect(result).toBe(state);
};

const runningState = (
  overrides: Partial<AgentMessage> = {},
  mode: WidgetToolCall['mode'] = overrides.mode === 'show' ? 'show' : 'do',
): ChatState => ({
  messages: [agentMessage(overrides)],
  task: { phase: 'running', mode },
});

const idleState = (): ChatState => ({ ...runningState({ status: undefined }), task: { phase: 'idle' } });

const pendingReply = (id = 'req-1'): ChatState => ({
  messages: [agentMessage({ id, parts: [] })],
  task: { phase: 'idle' },
});

describe('reduceEvent — task/status', () => {
  it('running is a no-op — the first tool/call is what activates the task', () => {
    const state = idleState();
    const result = reduceEvent(state, { type: 'task/status', status: 'running' }, 'do');
    expectNoOp(result, state);
  });

  it.each([
    ['completed', 'done'],
    ['failed', 'failed'],
    ['stopped', 'stopped'],
  ] as const)('%s ends the task and marks the active message %s', (status, expected) => {
    const result = reduceEvent(runningState(), { type: 'task/status', status }, 'do');
    expect(result.task.phase).toBe('idle');
    expect(agentAt(result).status).toBe(expected);
  });

  it('terminal status renders its closing message as an appended text part', () => {
    const event: WidgetEvent = { type: 'task/status', status: 'completed', message: 'All done!' };
    const result = reduceEvent(
      runningState({
        parts: [
          { type: 'progress', content: 'Clicking element', status: 'completed', browserToolName: 'click_element' },
        ],
      }),
      event,
      'do',
    );

    expect(textAt(result)).toBe('All done!');
    expect(agentAt(result).parts).toEqual([
      { type: 'progress', content: 'Clicking element', status: 'completed', browserToolName: 'click_element' },
      { type: 'text', content: 'All done!' },
    ]);
  });

  it('has_question pauses (not terminal): the message asks the visitor and the task idles', () => {
    const before = runningState();
    expect(agentAt(before).status).toBe('thinking');

    const event: WidgetEvent = { type: 'task/status', status: 'has_question', message: 'Which account?' };
    const result = reduceEvent(before, event, 'do');

    const msg = agentAt(result);
    expect(msg.status).toBe('question');
    expect(messageText(msg.parts)).toContain('Which account?');
    expect(msg.parts[msg.parts.length - 1]).toEqual({ type: 'text', content: 'Which account?' });
    expect(result.task).toEqual({ phase: 'idle' });
  });

  it.each(['completed', 'failed', 'stopped', 'has_question'] as const)('%s settles the placeholder', status => {
    const result = reduceEvent(runningState(), { type: 'task/status', status }, 'do');
    expect(isPending(agentAt(result))).toBe(false);
  });
});

describe('reduceTransportFailure', () => {
  it('settles every pending bubble into an error and ends the task', () => {
    const state: ChatState = {
      messages: [agentMessage({ id: 'settled', status: undefined }), agentMessage({ id: 'pending' })],
      task: { phase: 'running', mode: 'do' },
    };
    const result = reduceTransportFailure(state, 'Could not reconnect to the assistant. Try again.');

    expect(result.messages[0]).toBe(state.messages[0]);
    expect(isPending(agentAt(result, 1))).toBe(false);
    expect(textAt(result, 1)).toBe('Working on it\nCould not reconnect to the assistant. Try again.');
    expect(result.task).toEqual({ phase: 'idle' });
  });
});

describe('reduceStaleReply', () => {
  it('settles a placeholder that showed zero signs of life', () => {
    const state: ChatState = { messages: [agentMessage({ parts: [] })], task: { phase: 'idle' } };
    const result = reduceStaleReply(state, 'agent-1', 'This is taking longer than expected. Please try again.');

    expect(isPending(agentAt(result))).toBe(false);
    expect(textAt(result)).toBe('This is taking longer than expected. Please try again.');
  });

  it.each([{ phase: 'running', mode: 'do' } as const, { phase: 'idle' } as const])(
    'settles a placeholder gone silent for the deadline whether its task is still $phase or a reload left it behind',
    task => {
      const state: ChatState = { messages: [agentMessage()], task };
      const result = reduceStaleReply(state, 'agent-1', 'timeout text');

      expect(isPending(agentAt(result))).toBe(false);
      expect(textAt(result)).toBe('Working on it\ntimeout text');
    },
  );

  it('never overwrites a running task paused on the visitor, even with no text yet', () => {
    const state: ChatState = {
      messages: [agentMessage({ status: 'waiting-for-user', parts: [] })],
      task: { phase: 'running', mode: 'do' },
    };
    expect(reduceStaleReply(state, 'agent-1', 'timeout text')).toBe(state);
  });

  it('never overwrites a message that already settled', () => {
    const state: ChatState = {
      messages: [agentMessage({ status: undefined, parts: [{ type: 'text', content: 'All done' }] })],
      task: { phase: 'idle' },
    };
    expect(reduceStaleReply(state, 'agent-1', 'timeout text')).toBe(state);
  });

  it('is a no-op for a message id it does not recognize', () => {
    const state: ChatState = { messages: [agentMessage({ parts: [] })], task: { phase: 'idle' } };
    expect(reduceStaleReply(state, 'missing', 'timeout text')).toBe(state);
  });

  it('stamps status failed so a late completed status cannot re-target the watchdog bubble', () => {
    const state: ChatState = { messages: [agentMessage({ parts: [] })], task: { phase: 'idle' } };
    const stale = reduceStaleReply(state, 'agent-1', 'This is taking longer than expected. Please try again.');
    expect(agentAt(stale).status).toBe('failed');

    const late = reduceEvent(stale, { type: 'task/status', status: 'completed' }, 'do');
    expect(agentAt(late).status).toBe('failed');
    expect(textAt(late)).toBe('This is taking longer than expected. Please try again.');
  });
});

describe('reduceEvent — tool/call', () => {
  it('auto-activates the task when a tool arrives before task/status running', () => {
    const result = reduceEvent(idleState(), toolCall(), 'do');
    expect(result.task.phase).toBe('running');
  });

  it('adds an in-progress progress line to the active message', () => {
    const result = reduceEvent(runningState(), toolCall(), 'do');
    const progressParts = agentAt(result).parts.filter(p => p.type === 'progress');
    expect(progressParts).toHaveLength(1);
    expect(progressParts[0]?.status).toBe('in_progress');
  });

  it('announces a DOM read as reading the page — nothing but screen sharing views the visitor screen', () => {
    const result = reduceEvent(
      runningState(),
      toolCall({ explanation: '' }, { browser_tool: 'get_html', args: {} }),
      'do',
    );
    const line = agentAt(result).parts.find(part => part.type === 'progress');
    expect(line?.content).toBe('Reading the page');
    expect(line?.content).not.toMatch(/screen/i);
  });
});

describe('reduceEvent — chat/response', () => {
  it('resolves the matching placeholder', () => {
    const state: ChatState = pendingReply();
    const event: WidgetEvent = { type: 'chat/response', request_id: 'req-1', text: 'Here you go' };
    const result = reduceEvent(state, event, 'tell');

    const msg = agentAt(result);
    expect(messageText(msg.parts)).toBe('Here you go');
    expect(isPending(msg)).toBe(false);
    expect(msg.status).toBeUndefined();
    expect(msg.parts?.[msg.parts.length - 1]).toEqual({ type: 'text', content: 'Here you go' });
  });
});

describe('reduceEvent — chat/delta', () => {
  it('accumulates fragments into one streaming part and clears the placeholder', () => {
    const state: ChatState = pendingReply();
    const first = reduceEvent(state, { type: 'chat/delta', request_id: 'req-1', text: 'Hel' }, 'tell');
    const second = reduceEvent(first, { type: 'chat/delta', request_id: 'req-1', text: 'lo' }, 'tell');

    const msg = agentAt(second);
    expect(messageText(msg.parts)).toBe('Hello');
    expect(isPending(msg)).toBe(false);
    expect(msg.parts).toEqual([{ type: 'text', content: 'Hello', streaming: true }]);
  });

  it('final chat/response replaces the streamed part (no duplication)', () => {
    const state: ChatState = pendingReply();
    const streamed = reduceEvent(state, { type: 'chat/delta', request_id: 'req-1', text: 'Hello wor' }, 'tell');
    const final = reduceEvent(streamed, { type: 'chat/response', request_id: 'req-1', text: 'Hello world' }, 'tell');

    const msg = agentAt(final);
    expect(messageText(msg.parts)).toBe('Hello world');
    expect(msg.parts).toEqual([{ type: 'text', content: 'Hello world' }]);
  });

  it('a retransmitted final response is dropped, not appended again', () => {
    const state: ChatState = pendingReply();
    const once = reduceEvent(state, { type: 'chat/response', request_id: 'req-1', text: 'Hello world' }, 'tell');
    const repeated = reduceEvent(once, { type: 'chat/response', request_id: 'req-1', text: 'Hello world' }, 'tell');

    expect(repeated.messages[0]).toEqual(once.messages[0]);
    expect(agentAt(repeated).parts).toEqual([{ type: 'text', content: 'Hello world' }]);
  });
});

describe('reduceEvent — chat/error', () => {
  it('settles the matching placeholder with the human sentence, never the raw server error', () => {
    const state: ChatState = {
      messages: [agentMessage({ id: 'req-2' })],
      task: { phase: 'idle' },
    };
    const event: WidgetEvent = { type: 'chat/error', request_id: 'req-2', error: 'PG::ConnectionBad at line 42' };
    const result = reduceEvent(state, event, 'tell');
    expect(textAt(result)).toBe(`Working on it\n${CHAT_FAILURE_TEXT}`);
    expect(textAt(result)).not.toContain('PG::ConnectionBad');
    expect(isPending(agentAt(result))).toBe(false);
  });
});

describe('reduceEvent — ignored events', () => {
  it.each([{ type: 'registered', chat_id: 'c1' }, { type: 'heartbeat' }] as const satisfies WidgetEvent[])(
    '$type is a no-op (same state, no effects)',
    event => {
      const state = runningState();
      const result = reduceEvent(state, event, 'do');
      expectNoOp(result, state);
    },
  );
});

describe('reduceToolProgress / reduceToolDone / reduceStop', () => {
  const clicking = (explanation: string) => ({ status: 'in_progress' as const, mode: 'do' as const, explanation });

  it('patches the open line in place, even at part index 0, then completes it', () => {
    const opened = reduceToolProgress(runningState({ parts: [] }), 'click_element', clicking('clicking'), 'do');
    const patched = reduceToolProgress(opened, 'click_element', clicking('still clicking'), 'do');
    expect(patched.messages[0]?.parts).toEqual([
      { type: 'progress', content: 'still clicking', status: 'in_progress', browserToolName: 'click_element' },
    ]);
    const done = reduceToolProgress(patched, 'click_element', { status: 'completed' }, 'do');
    expect(done.messages[0]?.parts[0]).toMatchObject({ status: 'completed' });
  });

  it.each([
    ['appends the error in parentheses after the existing content', 'timed out', 'clicking the button (timed out)'],
    ['keeps the original content unchanged when there is no error text', '', 'clicking the button'],
  ] as const)('a failed line %s', (_case, error, expectedContent) => {
    const opened = reduceToolProgress(
      runningState({ parts: [] }),
      'click_element',
      clicking('clicking the button'),
      'do',
    );
    const failed = reduceToolProgress(opened, 'click_element', { status: 'failed', error }, 'do');
    expect(failed.messages[0]?.parts[0]?.content).toBe(expectedContent);
  });

  it('completed marks the in-progress line complete', () => {
    const inProgress = reduceEvent(runningState(), toolCall({ tool_call_id: 'c', explanation: 'x' }), 'do');
    const done = reduceToolProgress(inProgress, 'click_element', { status: 'completed' }, 'do');
    const part = agentAt(done).parts.find(p => p.type === 'progress');
    expect(part?.status).toBe('completed');
  });

  it('failed marks the line failed and surfaces the error text', () => {
    const inProgress = reduceEvent(runningState(), toolCall({ tool_call_id: 'c', explanation: 'Clicking' }), 'do');
    const failed = reduceToolProgress(inProgress, 'click_element', { status: 'failed', error: 'no element' }, 'do');
    const part = agentAt(failed).parts.find(p => p.type === 'progress');
    expect(part?.status).toBe('failed');
    expect(part?.content).toContain('no element');
  });

  it('closes the line of the tool that finished, not the newest open one', () => {
    const twoOpen = reduceEvent(
      reduceEvent(runningState({}, 'show'), toolCall({ tool_call_id: 'c1', explanation: 'click_element' }), 'show'),
      toolCall({ tool_call_id: 'c2', mode: 'show', explanation: 'get_html' }, { browser_tool: 'get_html', args: {} }),
      'show',
    );

    const done = reduceToolProgress(twoOpen, 'click_element', { status: 'completed' }, 'show');

    const lines = agentAt(done).parts.filter(p => p.type === 'progress');
    expect(lines.map(line => [line.browserToolName, line.status])).toEqual([
      ['click_element', 'completed'],
      ['get_html', 'in_progress'],
    ]);
  });

  it('does not touch status when the task is not actually running, even in Show/Do mode', () => {
    const result = reduceToolProgress(
      idleState(),
      'click_element',
      { status: 'in_progress', mode: 'show', explanation: 'x' },
      'show',
    );
    expect(agentAt(result).status).toBeUndefined();
  });

  it.each([
    ['do', 'thinking'],
    ['show', 'waiting-for-user'],
  ] as const)('in %s mode a mid-progress tool sets status to %s', (mode, status) => {
    const result = reduceToolProgress(
      runningState({ mode }),
      'click_element',
      { status: 'in_progress', mode, explanation: 'x' },
      mode,
    );
    expect(agentAt(result).status).toBe(status);
  });

  it.each([
    ['do', 'show', 'waiting-for-user'],
    ['show', 'do', 'thinking'],
  ] as const)('a %s task running a %s call shows %s, by the call and not the task', (taskMode, callMode, status) => {
    const state: ChatState = {
      messages: [agentMessage({ mode: taskMode, status: 'thinking' })],
      task: { phase: 'running', mode: taskMode },
    };
    const result = reduceToolProgress(
      state,
      'click_element',
      { status: 'in_progress', mode: callMode, explanation: 'x' },
      'tell',
    );
    expect(agentAt(result).status).toBe(status);
  });

  it('reduceToolDone ends the task and marks the message done', () => {
    const result = reduceToolDone(runningState(), 'do', { message: '', success: true });
    expect(result.task).toEqual({ phase: 'idle' });
    expect(agentAt(result).status).toBe('done');
  });

  it('reduceToolDone marks the message failed when the agent reports it did not succeed', () => {
    expect(agentAt(reduceToolDone(runningState(), 'do', { message: '', success: false })).status).toBe('failed');
  });

  it('a duplicate completion does not fall back past the stamp onto an older settled reply', () => {
    const oldReply = agentMessage({
      id: 'agent-0',
      status: undefined,
      parts: [{ type: 'text', content: 'Old answer' }],
    });
    const state: ChatState = { messages: [oldReply, agentMessage()], task: { phase: 'running', mode: 'do' } };

    const afterFirst = reduceToolDone(state, 'do', { message: '', success: true });
    expect(agentAt(afterFirst, 1).status).toBe('done');

    const afterDuplicate = reduceToolDone(afterFirst, 'do', { message: '', success: true });

    expect(afterDuplicate.messages[0]).toEqual(oldReply);
  });

  it('reduceStop marks the active message stopped and ends the task', () => {
    const result = reduceStop(runningState(), 'do');
    expect(agentAt(result).status).toBe('stopped');
    expect(result.task).toEqual({ phase: 'stopped' });
  });

  it('finish carries no progress line and clears whatever trajectory came before it', () => {
    const withTrajectory = runningState({
      parts: [
        { type: 'text', content: 'Working on it' },
        { type: 'progress', content: 'Reading the page', status: 'completed', browserToolName: 'get_html' },
      ],
    });

    const called = reduceEvent(
      withTrajectory,
      toolCall(
        { tool_call_id: 'c', explanation: 'Wrapping up' },
        { browser_tool: 'done', args: { message: 'Wrapping up', success: true } },
      ),
      'tell',
    );
    const succeeded = reduceToolProgress(called, 'done', { status: 'completed' }, 'tell');
    const done = reduceToolDone(succeeded, 'tell', { message: 'Wrapping up', success: true });

    const parts = agentAt(done).parts;
    expect(parts.some(p => p.type === 'progress')).toBe(false);
    expect(JSON.stringify(parts)).not.toContain('Unknown tool');
  });
});

describe('a Show/Do task ends with its closing message', () => {
  const doneCall = (success: boolean, message: string) =>
    toolCall(
      { tool_call_id: 'call-done', explanation: 'Wrapping up' },
      { browser_tool: 'done', args: { message, success } },
    );

  const runDone = (success: boolean, message: string): ChatState => {
    const called = reduceEvent(runningState({ parts: [] }, 'show'), doneCall(success, message), 'show');
    const completed = reduceToolProgress(called, 'done', { status: 'completed' }, 'show');
    return reduceToolDone(completed, 'show', { message, success });
  };

  it('shows the finish message once when task/status completed repeats it', () => {
    const done = runDone(true, 'Your plan is upgraded.');
    const settled = reduceEvent(
      done,
      { type: 'task/status', status: 'completed', message: 'Your plan is upgraded.' },
      'show',
    );

    const msg = agentAt(settled);
    expect(msg.status).toBe('done');
    expect(messageText(msg.parts)).toBe('Your plan is upgraded.');
    expect(settled.task).toEqual({ phase: 'idle' });
  });

  it('fills an empty finish with the closing message task/status carries', () => {
    const settled = reduceEvent(
      runDone(true, ''),
      { type: 'task/status', status: 'completed', message: 'Task completed' },
      'show',
    );
    expect(textAt(settled)).toBe('Task completed');
  });

  it('a failed run shows the agent message once, not the generic failure after it', () => {
    const failed = reduceEvent(
      { messages: [agentMessage({ id: 'req-1', parts: [] })], task: { phase: 'running', mode: 'do' } },
      { type: 'task/status', status: 'failed', message: 'The checkout page would not load.' },
      'do',
    );
    const errored = reduceEvent(failed, { type: 'chat/error', request_id: 'req-1', error: 'Agent failed' }, 'do');

    const msg = agentAt(errored);
    expect(msg.status).toBe('failed');
    expect(messageText(msg.parts)).toBe('The checkout page would not load.');
  });

  it('a failed run with no agent message still tells the visitor it failed', () => {
    const failed = reduceEvent(
      { messages: [agentMessage({ id: 'req-1', parts: [] })], task: { phase: 'running', mode: 'do' } },
      { type: 'task/status', status: 'failed' },
      'do',
    );
    const errored = reduceEvent(failed, { type: 'chat/error', request_id: 'req-1', error: 'Agent failed' }, 'do');
    expect(textAt(errored)).toBe(CHAT_FAILURE_TEXT);
  });
});

describe('Stop is the visitor withdrawing their page from the agent', () => {
  const lateCall = toolCall({ tool_call_id: 'call-late' });

  it('a tool call that raced the stop is not executed on the visitor page', () => {
    const stopped = reduceStop(runningState(), 'do');

    const result = reduceEvent(stopped, lateCall, 'do');

    expect(result).toBe(stopped);
  });

  it('the run reporting itself finished does not take the refusal off', () => {
    const stopped = reduceStop(runningState(), 'do');

    const settledByAgent = reduceEvent(stopped, { type: 'task/status', status: 'completed' }, 'do');

    expect(settledByAgent.task.phase).toBe('stopped');
    expect(reduceEvent(settledByAgent, lateCall, 'do')).toBe(settledByAgent);
  });

  it('the next request the visitor sends takes the refusal off', () => {
    const stopped = reduceStop(runningState(), 'do');
    const redispatched = reduceDispatch(stopped, agentMessage({ id: 'agent-2' }));

    const result = reduceEvent(redispatched, lateCall, 'do');

    expect(result.task.phase).toBe('running');
  });
});

describe('a message reports the text it shows', () => {
  it('carries every text part, not only the last one written', () => {
    const state: ChatState = {
      messages: [agentMessage({ parts: [{ type: 'text', content: 'first' }] })],
      task: { phase: 'running', mode: 'do' },
    };

    const event: WidgetEvent = { type: 'chat/response', request_id: 'agent-1', text: 'second' };
    const result = reduceEvent(state, event, 'tell');

    const [message] = result.messages;
    expect(message?.parts.filter(part => part.type === 'text').map(part => part.content)).toEqual(['first', 'second']);
  });

  it('leaves a progress line out of the text, because a progress line is not the answer', () => {
    expect(
      messageText([
        { type: 'progress', content: 'Reading the page', status: 'completed', browserToolName: 'get_html' },
        { type: 'text', content: 'Here you go' },
      ]),
    ).toBe('Here you go');
  });
});
