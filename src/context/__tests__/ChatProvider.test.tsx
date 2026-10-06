/**
 * Tests for `ChatContext`'s reply placeholder lifecycle: the stale-reply watchdog, the processing signal
 * spanning reply wait rather than just the outbound request, deduping a retransmitted `tool/call`,
 * `tool/response` payload shape, independent turns settling into their own messages, and every external
 * interaction failing into human text rather than a raw error, then recovering on retry. Every test
 * calls `cleanup()` in `afterEach` — an earlier test's still-mounted `ChatProvider` otherwise keeps its
 * stream-message subscription live and double-handles a later test's broadcast `handleMessage` call.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'bun:test';
import { Profiler, useEffect } from 'react';

import { useWidget } from '../../hooks/useWidget';
import type { executeTool } from '../../services/browserTools';
import * as chatThread from '../../services/chatThread';
import { PREVIEW_REPLY } from '../../services/chatTransport';
import { claimTabId, remintTabId } from '../../services/StorageService';
import { streamClient } from '../../services/StreamClient';
import { agentMessage, asStreamClientInternals, ofKind, toolCall } from '../../test/fixtures';
import { ChatHarness, renderChatHarness } from '../../test/renderWidget';
import { advanceTimersByTimeAsync, waitFor } from '../../test/vi-compat';
import { CHAT_FAILURE_TEXT, isPending, messageText } from '../../utils/chat';
import * as log from '../../utils/log';
import { useChatContext } from '../ChatContext';

const mockExecuteTool = vi.fn<typeof executeTool>().mockResolvedValue({ success: true, result: { text: 'ok' } });
vi.mock('../../services/browserTools', () => ({ executeTool: mockExecuteTool }));

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
    <div data-testid='transcript'>{messages.map(msg => `${msg.id}:${isPending(msg)}:${messageText(msg.parts)}`)}</div>
  );
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(chatThread, 'getOrCreateChatId').mockResolvedValue('chat-1');
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

    const event = toolCall({ tool_call_id: 'tc-retransmit', explanation: 'Click it' });

    await act(async () => {
      asStreamClientInternals().handleMessage(event);
      asStreamClientInternals().handleMessage(event);
      await Promise.resolve();
    });

    await waitFor(() => expect(mockExecuteTool).toHaveBeenCalledTimes(1));
    expect(mockExecuteTool).toHaveBeenCalledTimes(1);
  });

  it('never runs once the visitor stopped the task', async () => {
    mockExecuteTool.mockClear();
    render(
      <ChatHarness previewMode={false}>
        <ErrorProbe />
      </ChatHarness>,
    );

    await act(async () => {
      screen.getByTestId('stop').click();
      asStreamClientInternals().handleMessage(toolCall({ tool_call_id: 'tc-after-stop', explanation: 'Click it' }));
      await advanceTimersByTimeAsync(0);
    });

    expect(mockExecuteTool).not.toHaveBeenCalled();
  });
});

let providerCommitCount = 0;
const countProviderCommit = () => providerCommitCount++;

const renderCaptured = (previewMode = true) =>
  renderChatHarness({ previewMode }, ui => (
    <Profiler id='provider' onRender={countProviderCommit}>
      {ui}
    </Profiler>
  ));

const DONE_OK = { browser_tool: 'done', args: { message: 'Done', success: true } } as const;

async function dispatchClickToolCall(toolCallId: string): Promise<void> {
  await act(async () => {
    asStreamClientInternals().handleMessage(
      toolCall(
        { tool_call_id: toolCallId, explanation: 'Click it' },
        { browser_tool: 'click_element', args: { index: 0 } },
      ),
    );
    await advanceTimersByTimeAsync(0);
  });
}

async function sentPayloadFor(send: Mock<typeof streamClient.send>, toolCallId: string) {
  await waitFor(() => expect(send).toHaveBeenCalled());
  return send.mock.calls
    .map(([command]) => command)
    .find(command => command.type === 'tool/response' && command.tool_call_id === toolCallId);
}

describe('commit skips the render for a transition that reports no change', () => {
  it('a stale-reply watchdog firing on a message parked waiting-for-user does not re-render', async () => {
    const chat = renderCaptured(false);

    await act(async () => {
      await chat().chatActions.sendTurn('do the thing', 'tell');
    });
    const placeholderId = chat().messages.at(-1)?.id;

    act(() => {
      asStreamClientInternals().handleMessage({
        type: 'task/status',
        request_id: placeholderId,
        status: 'has_question',
      });
    });
    expect(
      ofKind(
        chat().messages.find(m => m.id === placeholderId),
        'agent',
      ).status,
    ).toBe('question');

    const messagesBeforeWatchdog = chat().messages;
    act(() => {
      vi.advanceTimersByTime(120_000);
    });

    expect(chat().messages).toBe(messagesBeforeWatchdog);
    expect(
      ofKind(
        chat().messages.find(m => m.id === placeholderId),
        'agent',
      ).status,
    ).toBe('question');
  });

  it('setMessages handed its own current array back is a no-op, even though it builds a new state object', () => {
    const chat = renderCaptured();
    act(() => {
      chat().chatActions.restoreMessages([agentMessage({ id: 'a', mode: 'tell', parts: [] })]);
    });

    const messagesBefore = chat().messages;
    const rendersBefore = providerCommitCount;
    act(() => {
      chat().chatActions.restoreMessages(messagesBefore);
    });

    expect(providerCommitCount).toBe(rendersBefore);
    expect(chat().messages).toBe(messagesBefore);
  });
});

describe('a turn in preview mode', () => {
  it('echoes the user message and answers locally, without dialing the stream', async () => {
    const chat = renderCaptured(true);
    const ready = vi.spyOn(streamClient, 'ready');

    await act(async () => {
      await chat().chatActions.sendTurn('hello', 'tell');
    });

    expect(ready).not.toHaveBeenCalled();
    expect(chat().messages.map(m => m.kind)).toEqual(['user', 'agent']);
  });
});

describe('a real turn', () => {
  it('posts the mode-prefixed command under its placeholder id once the stream is ready', async () => {
    const chat = renderCaptured(false);
    const order: string[] = [];
    vi.spyOn(chatThread, 'getOrCreateChatId').mockResolvedValue('chat-1');
    vi.spyOn(streamClient, 'ready').mockImplementation(async () => {
      order.push('ready');
    });
    const send = vi.spyOn(streamClient, 'send').mockImplementation(async () => {
      order.push('send');
    });

    await act(async () => {
      await chat().chatActions.sendTurn('hello', 'tell');
    });

    const placeholder = chat().messages.find(isPending);
    expect(order).toEqual(['ready', 'send']);
    expect(send).toHaveBeenCalledWith({ type: 'chat/tell', request_id: placeholder?.id, content: 'hello' });
  });
});

describe('a preview turn', () => {
  it('settles with the canned reply on the preview transport, never touching the stream', async () => {
    const chat = renderCaptured(true);
    const ready = vi.spyOn(streamClient, 'ready');
    const send = vi.spyOn(streamClient, 'send');

    await act(async () => {
      await chat().chatActions.sendTurn('hello', 'tell');
    });

    await waitFor(() => expect(chat().messages.some(isPending)).toBe(false));
    expect(messageText(chat().messages.at(-1)?.parts ?? [])).toBe(PREVIEW_REPLY);
    expect(ready).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('a Show or Do turn without a live screen share', () => {
  it('holds the turn behind a screen-access request, and a denial releases it', async () => {
    const chat = renderCaptured(true);

    await act(async () => {
      await chat().chatActions.sendTurn('show me', 'show');
    });
    expect(chat().messages.map(m => m.kind)).toEqual(['user', 'screenAccess']);

    act(() => chat().chatActions.denyScreenAccess());

    expect(ofKind(chat().messages[1], 'screenAccess').screenShareStatus).toBe('denied');
    expect(chat().messages.map(m => m.kind)).toEqual(['user', 'screenAccess', 'agent']);
  });

  it('asks nothing when the tenant turned screen sharing off', async () => {
    const chat = renderChatHarness({ overrides: { use_screenshare: false } });

    await act(async () => {
      await chat().chatActions.sendTurn('do it', 'do');
    });

    expect(chat().messages.map(m => m.kind)).toEqual(['user', 'agent']);
  });
});

describe('the finish tool ends the task only when it did not fail', () => {
  beforeEach(() => {
    vi.spyOn(streamClient, 'send').mockResolvedValue(undefined);
  });

  it('completes the task on a successful finish', async () => {
    const chat = renderCaptured(false);
    mockExecuteTool.mockReset().mockResolvedValue({ success: true, result: { text: 'done' } });

    await act(async () => {
      asStreamClientInternals().handleMessage(toolCall({ tool_call_id: 'tc-finish-ok', explanation: 'Done' }, DONE_OK));
      await advanceTimersByTimeAsync(0);
    });

    await waitFor(() => expect(mockExecuteTool).toHaveBeenCalled());
    await waitFor(() => expect(chat().taskState.phase).toBe('idle'));
  });

  it('leaves the task running on a failed finish, rather than ending it', async () => {
    const chat = renderCaptured(false);
    mockExecuteTool.mockReset().mockResolvedValue({ success: false, error: 'boom' });

    await act(async () => {
      asStreamClientInternals().handleMessage(
        toolCall({ tool_call_id: 'tc-finish-failed', explanation: 'Done' }, DONE_OK),
      );
      await advanceTimersByTimeAsync(0);
    });

    await waitFor(() => expect(mockExecuteTool).toHaveBeenCalled());
    expect(chat().taskState.phase).toBe('running');
  });
});

describe('tool/response carries a result on success and an error on failure, never both', () => {
  it('sends only the error on a failed tool call', async () => {
    renderCaptured(false);
    mockExecuteTool.mockReset().mockResolvedValue({ success: false, error: 'boom' });
    const send = vi.spyOn(streamClient, 'send').mockResolvedValue(undefined);

    await dispatchClickToolCall('tc-fail');

    expect(await sentPayloadFor(send, 'tc-fail')).toStrictEqual({
      type: 'tool/response',
      tool_call_id: 'tc-fail',
      success: false,
      error: 'boom',
    });
  });

  it('sends only the tool result object on a successful tool call', async () => {
    renderCaptured(false);
    mockExecuteTool.mockReset().mockResolvedValue({ success: true, result: { options: [{ value: 'a', text: 'A' }] } });
    const send = vi.spyOn(streamClient, 'send').mockResolvedValue(undefined);

    await dispatchClickToolCall('tc-ok');

    expect(await sentPayloadFor(send, 'tc-ok')).toStrictEqual({
      type: 'tool/response',
      tool_call_id: 'tc-ok',
      success: true,
      result: { options: [{ value: 'a', text: 'A' }] },
    });
  });
});

describe('a tool/response sent after the page reminted its tab id', () => {
  it('answers on the tab the call arrived on, the only tab the api relays it from', async () => {
    renderCaptured(false);
    const send = vi.spyOn(streamClient, 'send').mockResolvedValue(undefined);
    const tabAtCall = claimTabId();
    mockExecuteTool.mockImplementationOnce(async () => {
      remintTabId();
      return { success: true, result: { text: 'ok' } };
    });

    await dispatchClickToolCall('tc-remint');

    await waitFor(() => expect(send).toHaveBeenCalled());
    const [, route] = send.mock.calls.find(([command]) => command.type === 'tool/response') ?? [];
    expect(route?.tabId).toBe(tabAtCall);
    expect(claimTabId()).not.toBe(tabAtCall);
  });
});

describe('a tool/call an earlier page load of this tab already started', () => {
  beforeEach(() => sessionStorage.clear());

  it('is answered page_reloaded so the agent re-observes, never run again', async () => {
    sessionStorage.setItem('marketrix_started_tool_calls', JSON.stringify(['tc-before-reload']));
    renderCaptured(false);
    const send = vi.spyOn(streamClient, 'send').mockResolvedValue(undefined);
    mockExecuteTool.mockClear();

    await dispatchClickToolCall('tc-before-reload');

    expect(await sentPayloadFor(send, 'tc-before-reload')).toEqual({
      type: 'tool/response',
      tool_call_id: 'tc-before-reload',
      success: true,
      result: { page_reloaded: true },
    });
    expect(mockExecuteTool).not.toHaveBeenCalled();
  });
});

describe('a chat/error event is logged, not surfaced as a transcript message', () => {
  it('logs the server error and leaves the transcript untouched', async () => {
    const logWarn = vi.spyOn(log, 'logWarn').mockImplementation(() => {});
    const chat = renderCaptured(false);
    const messagesBefore = chat().messages;

    act(() => {
      asStreamClientInternals().handleMessage({
        type: 'chat/error',
        request_id: 'req-1',
        error: 'upstream exploded',
      });
    });

    expect(logWarn).toHaveBeenCalledWith('[Widget] Chat error from server:', 'upstream exploded');
    expect(chat().messages).toEqual(messagesBefore);
  });
});

const ErrorProbe = () => {
  const { state, actions } = useWidget();
  const { messages } = useChatContext();
  return (
    <>
      <div data-testid='error-banner'>{state.error ?? ''}</div>
      <div data-testid='awaiting'>{String(state.isAwaitingReply)}</div>
      <div data-testid='transcript'>{messages.map(m => messageText(m.parts)).join('|')}</div>
      <div data-testid='placeholder-id'>{messages.find(isPending)?.id ?? ''}</div>
      <button data-testid='send' onClick={() => void actions.sendTurn('hi', 'tell')} />
      <button data-testid='stop' onClick={actions.stopTask} />
      <button data-testid='dismiss' onClick={() => actions.setError(undefined)} />
    </>
  );
};

const RAW_MARKER = 'PG::ConnectionBad at db_pool.rb:42 — ECONNREFUSED 10.0.4.12:5432';

const visibleText = () =>
  `${screen.getByTestId('error-banner').textContent}|${screen.getByTestId('transcript').textContent}`;

describe('external-interaction failures never reach the customer page raw, and every one recovers', () => {
  it.each([
    {
      name: 'message POST rejects with a raw server body',
      humanText: CHAT_FAILURE_TEXT,
      run: async () => {
        vi.spyOn(streamClient, 'send').mockRejectedValueOnce(new Error(RAW_MARKER));
        await act(async () => screen.getByTestId('send').click());
      },
    },
    {
      name: 'an unmatched chat/error settles the placeholder',
      humanText: CHAT_FAILURE_TEXT,
      run: async () => {
        await act(async () => screen.getByTestId('send').click());
        const requestId = screen.getByTestId('placeholder-id').textContent ?? '';
        act(() =>
          asStreamClientInternals().handleMessage({ type: 'chat/error', request_id: requestId, error: RAW_MARKER }),
        );
      },
    },
    {
      name: 'tool/call execution throws unexpectedly',
      humanText: 'Something went wrong running that step. Please try again.',
      run: async () => {
        mockExecuteTool.mockRejectedValueOnce(new Error(RAW_MARKER));
        await act(async () => {
          asStreamClientInternals().handleMessage(toolCall({ tool_call_id: 'tc-fault' }));
          await advanceTimersByTimeAsync(0);
        });
      },
    },
    {
      name: 'the tool/response POST fails',
      humanText: 'Could not report that step back to the assistant — it may stop responding.',
      run: async () => {
        vi.spyOn(streamClient, 'send').mockRejectedValueOnce(new Error(RAW_MARKER));
        await act(async () => {
          asStreamClientInternals().handleMessage(toolCall({ tool_call_id: 'tc-fault-2' }));
          await advanceTimersByTimeAsync(0);
        });
      },
    },
    {
      name: 'the chat/stop POST fails',
      humanText: 'Could not stop the assistant — it may still be working.',
      run: async () => {
        vi.spyOn(streamClient, 'send').mockRejectedValueOnce(new Error(RAW_MARKER));
        await act(async () => screen.getByTestId('stop').click());
      },
    },
  ])('$name', async ({ humanText, run }) => {
    mockExecuteTool.mockReset().mockResolvedValue({ success: true, result: { text: 'ok' } });
    render(
      <ChatHarness previewMode={false}>
        <ErrorProbe />
      </ChatHarness>,
    );

    await run();

    await waitFor(() => expect(visibleText()).toContain(humanText));
    expect(visibleText()).not.toContain(RAW_MARKER);
    expect(screen.getByTestId('awaiting')).toHaveTextContent('false');

    await act(async () => screen.getByTestId('send').click());
    await waitFor(() => expect(screen.getByTestId('awaiting')).toHaveTextContent('true'));
  });
});

describe('the stream banner is derived from the stream state', () => {
  afterEach(() => {
    asStreamClientInternals().state = { phase: 'idle' };
  });

  it('shows while reconnecting and clears once the stream registers again', () => {
    render(
      <ChatHarness previewMode={false}>
        <ErrorProbe />
      </ChatHarness>,
    );
    expect(screen.getByTestId('error-banner')).toHaveTextContent('');

    act(() => {
      asStreamClientInternals().state = { phase: 'backoff', chatId: 'chat-1', attempt: 1 };
    });
    expect(screen.getByTestId('error-banner')).toHaveTextContent('Reconnecting');

    act(() => {
      asStreamClientInternals().state = { phase: 'registered', chatId: 'chat-1', gen: 2 };
    });
    expect(screen.getByTestId('error-banner')).toHaveTextContent('');
  });

  it('never hides a different error already on screen, and returns once that one is dismissed', async () => {
    vi.spyOn(streamClient, 'send').mockRejectedValue(new Error('boom'));
    render(
      <ChatHarness previewMode={false}>
        <ErrorProbe />
      </ChatHarness>,
    );
    act(() => {
      asStreamClientInternals().state = { phase: 'backoff', chatId: 'chat-1', attempt: 1 };
    });

    await act(async () => {
      screen.getByTestId('stop').click();
    });
    expect(screen.getByTestId('error-banner')).toHaveTextContent(
      'Could not stop the assistant — it may still be working.',
    );

    await act(async () => {
      screen.getByTestId('dismiss').click();
    });
    expect(screen.getByTestId('error-banner')).toHaveTextContent('Reconnecting');
  });

  it('settles a pending reply as failed once the stream gives up', async () => {
    render(
      <ChatHarness previewMode={false}>
        <ErrorProbe />
      </ChatHarness>,
    );
    await act(async () => screen.getByTestId('send').click());
    await waitFor(() => expect(screen.getByTestId('awaiting')).toHaveTextContent('true'));

    act(() => {
      asStreamClientInternals().state = { phase: 'gaveUp', chatId: 'chat-1', reason: 'exhausted' };
    });

    expect(screen.getByTestId('awaiting')).toHaveTextContent('false');
    expect(visibleText()).toContain('Could not reconnect to the assistant. Try again.');
  });
});

describe('two independent turns settle into their own messages', () => {
  it("never mixes one request_id's reply into another's message", async () => {
    const chat = renderCaptured(false);

    act(() => {
      chat().chatActions.restoreMessages([agentMessage({ id: 'req-a', parts: [] })]);
    });
    act(() => {
      asStreamClientInternals().handleMessage({ type: 'chat/response', request_id: 'req-a', text: 'first' });
    });

    act(() => {
      chat().chatActions.restoreMessages([...chat().messages, agentMessage({ id: 'req-b', parts: [] })]);
    });
    act(() => {
      asStreamClientInternals().handleMessage({ type: 'chat/response', request_id: 'req-b', text: 'second' });
    });

    const replies = chat().messages.flatMap(msg => (msg.id === 'req-a' || msg.id === 'req-b' ? [msg] : []));
    expect(replies.map(msg => messageText(msg.parts))).toEqual(['first', 'second']);
  });
});
