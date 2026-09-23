/**
 * Tests for `ChatContext`'s reply placeholder lifecycle: the stale-reply watchdog, the processing signal
 * spanning reply wait rather than just the outbound request, deduping a retransmitted `tool/call`,
 * `tool/response` payload shape, and independent turns settling into their own messages. Every test
 * calls `cleanup()` in `afterEach` — an earlier test's still-mounted `ChatProvider` otherwise keeps its
 * stream-message subscription live and double-handles a later test's broadcast `handleMessage` call.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'bun:test';
import { Profiler, useEffect } from 'react';

import { useWidget } from '../../hooks/useWidget';
import type { WidgetEvent } from '../../sdk';
import * as chatSession from '../../services/chatSession';
import { streamClient } from '../../services/StreamClient';
import { agentMessage, asStreamClientInternals, browserToolServiceMock, ofKind } from '../../test/fixtures';
import { ChatHarness } from '../../test/renderWidget';
import { advanceTimersByTimeAsync, waitFor } from '../../test/vi-compat';
import { messageText } from '../../types';
import * as log from '../../utils/log';
import { useChatContext } from '../ChatContext';

const mockExecuteTool = vi.fn().mockResolvedValue({ success: true, data: {} });
vi.mock('../../services/BrowserToolService', () => browserToolServiceMock(mockExecuteTool));

const restoredPlaceholder = agentMessage({
  id: 'temp-restored',
  mode: 'tell',
  parts: [],
});

const Transcript = () => {
  const { messages, chatActions } = useChatContext();

  useEffect(() => {
    chatActions.restoreMessages([restoredPlaceholder]);
  }, [chatActions]);

  return (
    <div data-testid='transcript'>
      {messages.map(msg => `${msg.id}:${msg.kind === 'agent' && msg.isPlaceholder}:${messageText(msg.parts)}`)}
    </div>
  );
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(chatSession, 'getOrCreateChatId').mockResolvedValue('chat-1');
  vi.spyOn(streamClient, 'ready').mockResolvedValue();
  vi.spyOn(streamClient, 'send').mockResolvedValue();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('a placeholder that never receives an event', () => {
  it('gives up on its own even when no dispatch in this page created it', () => {
    render(
      <ChatHarness>
        <Transcript />
      </ChatHarness>,
    );

    expect(screen.getByTestId('transcript')).toHaveTextContent('temp-restored:true:');

    act(() => {
      vi.advanceTimersByTime(120_000);
    });

    expect(screen.getByTestId('transcript')).toHaveTextContent(
      'temp-restored:false:This is taking longer than expected. Please try again.',
    );
  });
});

const ChurningTranscript = () => {
  const { chatActions } = useChatContext();

  return (
    <>
      <Transcript />
      <button data-testid='churn' onClick={() => chatActions.addSystemMessage('Mode changed')} />
    </>
  );
};

describe('the stale-reply deadline belongs to the placeholder', () => {
  it('is not pushed back by an unrelated message the visitor adds while waiting', () => {
    render(
      <ChatHarness>
        <ChurningTranscript />
      </ChatHarness>,
    );

    act(() => {
      vi.advanceTimersByTime(100_000);
    });
    act(() => {
      screen.getByTestId('churn').click();
    });
    act(() => {
      vi.advanceTimersByTime(25_000);
    });

    expect(screen.getByTestId('transcript')).toHaveTextContent(
      'temp-restored:false:This is taking longer than expected. Please try again.',
    );
  });
});

const ProcessingProbe = () => {
  const { state, actions } = useWidget();

  return (
    <button data-testid='probe' onClick={() => void actions.sendTurn('hi', 'tell')}>
      {String(state.isAwaitingReply || state.isTaskRunning)}
    </button>
  );
};

describe('the processing signal both glows read', () => {
  it('outlives the outbound post — the visitor waits on the reply, not on the request', async () => {
    render(
      <ChatHarness previewMode={false}>
        <ProcessingProbe />
      </ChatHarness>,
    );

    expect(screen.getByTestId('probe')).toHaveTextContent('false');

    await act(async () => {
      screen.getByTestId('probe').click();
    });

    expect(screen.getByTestId('probe')).toHaveTextContent('true');
  });
});

describe('a retransmitted tool/call', () => {
  it('is deduped by tool_call_id — the browser tool runs once, not twice', async () => {
    vi.spyOn(streamClient, 'send').mockResolvedValue(undefined);
    mockExecuteTool.mockClear();

    render(
      <ChatHarness previewMode={false}>
        <div />
      </ChatHarness>,
    );

    const event: WidgetEvent = {
      type: 'tool/call',
      tool_call_id: 'tc-retransmit',
      browser_tool: 'click_element',
      args: { index: 1 },
      mode: 'do',
      explanation: 'Click it',
    };

    await act(async () => {
      asStreamClientInternals().handleMessage(event);
      asStreamClientInternals().handleMessage(event);
      await Promise.resolve();
    });

    await waitFor(() => expect(mockExecuteTool).toHaveBeenCalledTimes(1));
    expect(mockExecuteTool).toHaveBeenCalledTimes(1);
  });
});

let captured: ReturnType<typeof useChatContext> | undefined;
const Capture = () => {
  captured = useChatContext();
  return null;
};

let providerCommitCount = 0;
const countProviderCommit = () => providerCommitCount++;

const renderCaptured = (previewMode = true) => {
  render(
    <Profiler id='provider' onRender={countProviderCommit}>
      <ChatHarness previewMode={previewMode}>
        <Capture />
      </ChatHarness>
    </Profiler>,
  );
};

async function dispatchClickToolCall(toolCallId: string): Promise<void> {
  await act(async () => {
    asStreamClientInternals().handleMessage({
      type: 'tool/call',
      tool_call_id: toolCallId,
      browser_tool: 'click_element',
      args: { index: 0 },
      mode: 'do',
      explanation: 'Click it',
    });
    await advanceTimersByTimeAsync(0);
  });
}

async function sentPayloadFor<T extends unknown[]>(
  send: Mock<(...args: T) => Promise<void>>,
  toolCallId: string,
): Promise<Record<string, unknown>> {
  await waitFor(() => expect(send).toHaveBeenCalled());
  return send.mock.calls
    .map(c => c[0])
    .find(p => (p as { tool_call_id?: string }).tool_call_id === toolCallId) as Record<string, unknown>;
}

describe('commit skips the render for a transition that reports no change', () => {
  it('a stale-reply watchdog firing on a message parked waiting-for-user does not re-render', async () => {
    renderCaptured(false);

    await act(async () => {
      await captured!.chatActions.sendTurn('do the thing', 'tell');
    });
    const placeholderId = captured!.messages[captured!.messages.length - 1]?.id as string;

    act(() => {
      asStreamClientInternals().handleMessage({ type: 'task/status', status: 'has_question' });
    });
    expect(
      ofKind(
        captured!.messages.find(m => m.id === placeholderId),
        'agent',
      ).placeholderState,
    ).toBe('waiting-for-user');

    const messagesBeforeWatchdog = captured!.messages;
    act(() => {
      vi.advanceTimersByTime(120_000);
    });

    expect(captured!.messages).toBe(messagesBeforeWatchdog);
    expect(
      ofKind(
        captured!.messages.find(m => m.id === placeholderId),
        'agent',
      ).placeholderState,
    ).toBe('waiting-for-user');
  });

  it('setMessages handed its own current array back is a no-op, even though it builds a new state object', () => {
    renderCaptured();
    act(() => {
      captured!.chatActions.restoreMessages([agentMessage({ id: 'a', mode: 'tell', parts: [] })]);
    });

    const messagesBefore = captured!.messages;
    const rendersBefore = providerCommitCount;
    act(() => {
      captured!.chatActions.restoreMessages(messagesBefore);
    });

    expect(providerCommitCount).toBe(rendersBefore);
    expect(captured!.messages).toBe(messagesBefore);
  });
});

describe('a turn in preview mode', () => {
  it('echoes the user message and answers locally, without dialing the stream', async () => {
    renderCaptured(true);
    const ready = vi.spyOn(streamClient, 'ready');

    await act(async () => {
      await captured!.chatActions.sendTurn('hello', 'tell');
    });

    expect(ready).not.toHaveBeenCalled();
    expect(captured!.messages.map(m => m.kind)).toEqual(['user', 'agent']);
  });
});

describe('a real turn', () => {
  it('posts the mode-prefixed command under its placeholder id once the stream is ready', async () => {
    renderCaptured(false);
    const order: string[] = [];
    vi.spyOn(chatSession, 'getOrCreateChatId').mockResolvedValue('chat-1');
    vi.spyOn(streamClient, 'ready').mockImplementation(async () => {
      order.push('ready');
    });
    const send = vi.spyOn(streamClient, 'send').mockImplementation(async () => {
      order.push('send');
    });

    await act(async () => {
      await captured!.chatActions.sendTurn('hello', 'tell');
    });

    const placeholder = captured!.messages.find(m => m.kind === 'agent' && m.isPlaceholder);
    expect(order).toEqual(['ready', 'send']);
    expect(send).toHaveBeenCalledWith({ type: 'chat/tell', request_id: placeholder!.id, content: 'hello' });
  });
});

describe('a Show or Do turn without a live screen share', () => {
  it('holds the turn behind a screen-access request, and a denial releases it', async () => {
    renderCaptured(true);

    await act(async () => {
      await captured!.chatActions.sendTurn('show me', 'show');
    });
    expect(captured!.messages.map(m => m.kind)).toEqual(['user', 'screenAccess']);

    act(() => captured!.chatActions.denyScreenAccess());

    expect(ofKind(captured!.messages[1], 'screenAccess').screenShareStatus).toBe('denied');
    expect(captured!.messages.map(m => m.kind)).toEqual(['user', 'screenAccess', 'agent']);
  });

  it('asks nothing when the tenant turned screen sharing off', async () => {
    render(
      <ChatHarness overrides={{ use_screenshare: false }}>
        <Capture />
      </ChatHarness>,
    );

    await act(async () => {
      await captured!.chatActions.sendTurn('do it', 'do');
    });

    expect(captured!.messages.map(m => m.kind)).toEqual(['user', 'agent']);
  });
});

describe('the finish tool ends the task only when it did not fail', () => {
  beforeEach(() => {
    vi.spyOn(streamClient, 'send').mockResolvedValue(undefined);
  });

  it('completes the task on a successful finish', async () => {
    renderCaptured(false);
    mockExecuteTool.mockReset().mockResolvedValue({ success: true, data: { text: 'done' } });

    await act(async () => {
      asStreamClientInternals().handleMessage({
        type: 'tool/call',
        tool_call_id: 'tc-finish-ok',
        browser_tool: 'done',
        args: { message: 'Done', success: true },
        mode: 'do',
        explanation: 'Done',
      });
      await advanceTimersByTimeAsync(0);
    });

    await waitFor(() => expect(mockExecuteTool).toHaveBeenCalled());
    await waitFor(() => expect(captured!.taskState.phase).toBe('idle'));
  });

  it('leaves the task running on a failed finish, rather than ending it', async () => {
    renderCaptured(false);
    mockExecuteTool.mockReset().mockResolvedValue({ success: false, error: 'boom' });

    await act(async () => {
      asStreamClientInternals().handleMessage({
        type: 'tool/call',
        tool_call_id: 'tc-finish-failed',
        browser_tool: 'done',
        args: { message: 'Done', success: true },
        mode: 'do',
        explanation: 'Done',
      });
      await advanceTimersByTimeAsync(0);
    });

    await waitFor(() => expect(mockExecuteTool).toHaveBeenCalled());
    expect(captured!.taskState.phase).toBe('running');
  });
});

describe('tool/response carries data only when the tool call itself succeeded', () => {
  it('omits data on a failed tool call, instead of stringifying an undefined result', async () => {
    renderCaptured(false);
    mockExecuteTool.mockReset().mockResolvedValue({ success: false, error: 'boom' });
    const send = vi.spyOn(streamClient, 'send').mockResolvedValue(undefined);

    await dispatchClickToolCall('tc-fail');

    const payload = await sentPayloadFor(send, 'tc-fail');
    expect(payload).not.toHaveProperty('data');
    expect(payload['success']).toBe(false);
  });

  it('includes stringified data on a successful tool call', async () => {
    renderCaptured(false);
    mockExecuteTool.mockReset().mockResolvedValue({ success: true, data: { ok: true } });
    const send = vi.spyOn(streamClient, 'send').mockResolvedValue(undefined);

    await dispatchClickToolCall('tc-ok');

    const payload = await sentPayloadFor(send, 'tc-ok');
    expect(payload['data']).toBe(JSON.stringify({ ok: true }));
  });
});

describe('the processed tool-call id set is trimmed only once it EXCEEDS its cap', () => {
  it('still dedupes the earliest id at exactly 1000 distinct ids, not before', async () => {
    renderCaptured(false);
    vi.spyOn(streamClient, 'send').mockResolvedValue(undefined);
    mockExecuteTool.mockClear();

    const makeCall = (id: string): WidgetEvent => ({
      type: 'tool/call',
      tool_call_id: id,
      browser_tool: 'click_element',
      args: { index: 1 },
      mode: 'do',
      explanation: 'Click it',
    });

    await act(async () => {
      for (let i = 0; i < 1000; i++) asStreamClientInternals().handleMessage(makeCall(`trim-${i}`));
      await advanceTimersByTimeAsync(0);
    });
    await waitFor(() => expect(mockExecuteTool).toHaveBeenCalledTimes(1000));

    await act(async () => {
      asStreamClientInternals().handleMessage(makeCall('trim-0'));
      await advanceTimersByTimeAsync(0);
    });
    expect(mockExecuteTool).toHaveBeenCalledTimes(1000);
  });
});

describe('a terminal task/status clears the processed tool-call id set', () => {
  it('lets a retransmitted tool_call_id from BEFORE the terminal status run again', async () => {
    renderCaptured(false);
    vi.spyOn(streamClient, 'send').mockResolvedValue(undefined);
    mockExecuteTool.mockClear();

    const event: WidgetEvent = {
      type: 'tool/call',
      tool_call_id: 'tc-recur',
      browser_tool: 'click_element',
      args: { index: 1 },
      mode: 'do',
      explanation: 'Click it',
    };

    await act(async () => {
      asStreamClientInternals().handleMessage(event);
      await advanceTimersByTimeAsync(0);
    });
    await waitFor(() => expect(mockExecuteTool).toHaveBeenCalledTimes(1));

    act(() => {
      asStreamClientInternals().handleMessage({ type: 'task/status', status: 'completed' });
    });

    await act(async () => {
      asStreamClientInternals().handleMessage(event);
      await advanceTimersByTimeAsync(0);
    });
    await waitFor(() => expect(mockExecuteTool).toHaveBeenCalledTimes(2));
  });
});

describe('a chat/error event is logged, not surfaced as a transcript message', () => {
  it('logs the server error and leaves the transcript untouched', async () => {
    const logWarn = vi.spyOn(log, 'logWarn').mockImplementation(() => {});
    renderCaptured(false);
    const messagesBefore = captured!.messages;

    act(() => {
      asStreamClientInternals().handleMessage({
        type: 'chat/error',
        request_id: 'req-1',
        error: 'upstream exploded',
      });
    });

    expect(logWarn).toHaveBeenCalledWith('[Widget] Chat error from server:', 'upstream exploded');
    expect(captured!.messages).toEqual(messagesBefore);
  });
});

const ErrorProbe = () => {
  const { state, actions } = useWidget();
  return (
    <>
      <div data-testid='error-banner'>{state.error ?? ''}</div>
      <button data-testid='stop' onClick={() => void actions.stopTask()} />
    </>
  );
};

describe('a transient stream failure banner clears once the stream recovers', () => {
  it('shows the failure, then the next registered event clears exactly that banner', async () => {
    render(
      <ChatHarness previewMode={false}>
        <ErrorProbe />
      </ChatHarness>,
    );

    expect(screen.getByTestId('error-banner')).toHaveTextContent('');

    act(() => {
      asStreamClientInternals().notifyError(new Error('Stream connection failed'));
    });
    expect(screen.getByTestId('error-banner')).toHaveTextContent('Stream connection failed');

    act(() => {
      asStreamClientInternals().handleMessage({ type: 'registered', chat_id: 'stream-recovers' });
    });
    expect(screen.getByTestId('error-banner')).toHaveTextContent('');
  });

  it('never clears a different error already on screen when the stream happens to recover', async () => {
    vi.spyOn(streamClient, 'send').mockRejectedValue(new Error('boom'));

    render(
      <ChatHarness previewMode={false}>
        <ErrorProbe />
      </ChatHarness>,
    );

    act(() => {
      asStreamClientInternals().notifyError(new Error('Stream connection failed'));
    });
    expect(screen.getByTestId('error-banner')).toHaveTextContent('Stream connection failed');

    await act(async () => {
      screen.getByTestId('stop').click();
    });
    expect(screen.getByTestId('error-banner')).toHaveTextContent(
      'Could not stop the assistant — it may still be working.',
    );

    act(() => {
      asStreamClientInternals().handleMessage({ type: 'registered', chat_id: 'stream-recovers-2' });
    });
    expect(screen.getByTestId('error-banner')).toHaveTextContent(
      'Could not stop the assistant — it may still be working.',
    );
  });
});

describe('two independent turns settle into their own messages', () => {
  it("never mixes one request_id's reply into another's message", async () => {
    renderCaptured(false);

    act(() => {
      captured!.chatActions.restoreMessages([agentMessage({ id: 'req-a', parts: [] })]);
    });
    act(() => {
      asStreamClientInternals().handleMessage({ type: 'chat/response', request_id: 'req-a', text: 'first' });
    });

    act(() => {
      captured!.chatActions.restoreMessages([...captured!.messages, agentMessage({ id: 'req-b', parts: [] })]);
    });
    act(() => {
      asStreamClientInternals().handleMessage({ type: 'chat/response', request_id: 'req-b', text: 'second' });
    });

    const first = captured!.messages.find(msg => msg.id === 'req-a');
    const second = captured!.messages.find(msg => msg.id === 'req-b');
    expect(messageText(first!.parts)).toBe('first');
    expect(messageText(second!.parts)).toBe('second');
  });
});
