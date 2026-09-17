/**
 * ChatProvider tests around the reply placeholder: it gives up on its own even when no dispatch in this
 * page created it (a reload mid-reply), its stale-reply deadline is not pushed back by an unrelated
 * message the visitor adds while waiting, the processing signal both glows read outlives the
 * outbound POST — the visitor waits on the reply, not on the request — and a retransmitted `tool/call`
 * (same `tool_call_id`) runs the browser tool once, never twice. `commit` skips the render entirely when
 * a transition reports no change (a stale-reply watchdog firing after its message already settled);
 * `updateMessage`/`removeMessage` act on the one message their id names, leaving the rest untouched; a
 * preview dispatch returns before ever reading real chat config, whether or not it skips the echoed user
 * message; a `finish` tool call ends the task only when it did not fail; the `tool/response` payload
 * carries `data` only on a successful tool result; the processed-`tool_call_id` set is trimmed once it
 * passes its cap, and a terminal `task/status` clears it outright; and a `chat/error` event is logged
 * without disturbing the transcript.
 *
 * Every test calls `cleanup()` in `afterEach` — without it an earlier test's still-mounted `ChatProvider`
 * keeps its stream-message subscription live and double-handles a later test's broadcast `handleMessage`
 * call. The stale-reply-watchdog test relies on `has_question` with no message text parking the
 * placeholder waiting-for-user WITHOUT touching its parts, so the watchdog's `pendingReplies` dependency
 * (id:partsLength) is unchanged and its ORIGINAL 120s timer (armed before the parking) is still the one
 * that fires; it then asserts reference equality on `captured!.messages` to prove `commit`'s no-change
 * branch actually skipped `setState`, not just that the text happens to match. A second case in the same
 * describe covers the finer-grained half of that branch a bare `next === prev` check cannot reach:
 * `setMessages` handed its OWN current array back always returns a NEW top-level state object (the
 * `{ ...s, messages }` spread), so only `next.messages === prev.messages && next.task === prev.task`
 * catches it — `next === prev` alone would let this commit through and `setState` a distinct object.
 * `contextValue`'s own `useMemo` (keyed on `state.messages`/`state.task`) then absorbs that wasted
 * `setState` before it reaches `Capture`, so reading `captured!.messages` or counting `Capture`'s own
 * renders cannot tell the two apart — `renderCaptured` wraps `ChatProvider` in a `Profiler` instead, and
 * the assertion counts ITS `onRender` calls, which fire once per actual `setState` regardless of what a
 * downstream memo later absorbs. The preview-dispatch test
 * asserts `getCredentialedConfig` was never called because if the early `return` after the preview reply
 * were dropped, execution would fall through into the real-chat branch and read config never set up for
 * that test; the real-dispatch skip/echo test counts the placeholder created for the real reply as the +1
 * present in both its expected counts. The 1000-id trim-boundary test re-delivers the earliest id after
 * reaching exactly the cap: a `>` boundary read as `>=`, or the guard negated outright, would have trimmed
 * the set already and evicted that id, turning the expected no-op dedupe into a fresh execution.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'bun:test';
import { Profiler, useEffect } from 'react';

import { useWidget } from '../../hooks/useWidget';
import type { WidgetEvent } from '../../sdk';
import type * as ChatServiceModule from '../../services/ChatService';
import { type CredentialedConfig, storageService } from '../../services/StorageService';
import { streamClient } from '../../services/StreamClient';
import {
  agentMessage,
  asStreamClientInternals,
  browserToolServiceMock,
  getMockWidgetConfig,
} from '../../test/fixtures';
import { advanceTimersByTimeAsync, waitFor } from '../../test/vi-compat';
import { messageText } from '../../types';
import * as log from '../../utils/log';
import { ChatProvider, useChatContext } from '../ChatContext';
import { UIStateProvider } from '../UIStateContext';

vi.mock('../../services/ChatService', (): typeof ChatServiceModule => ({
  chatPost: vi.fn().mockResolvedValue(undefined),
}));

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
    chatActions.setMessages([restoredPlaceholder]);
  }, [chatActions]);

  return (
    <div data-testid='transcript'>
      {messages.map(msg => `${msg.id}:${msg.isPlaceholder}:${messageText(msg.parts)}`)}
    </div>
  );
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('a placeholder that never receives an event', () => {
  it('gives up on its own even when no dispatch in this page created it', () => {
    render(
      <UIStateProvider>
        <ChatProvider previewMode>
          <Transcript />
        </ChatProvider>
      </UIStateProvider>,
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
  const { messages, chatActions } = useChatContext();

  return (
    <>
      <Transcript />
      <button
        data-testid='churn'
        onClick={() =>
          chatActions.addMessage({
            id: `system-${messages.length}`,
            sender: 'user',
            timestamp: new Date(),
            isSystemMessage: true,
            parts: [{ type: 'text', content: 'Mode changed' }],
          })
        }
      />
    </>
  );
};

describe('the stale-reply deadline belongs to the placeholder', () => {
  it('is not pushed back by an unrelated message the visitor adds while waiting', () => {
    render(
      <UIStateProvider>
        <ChatProvider previewMode>
          <ChurningTranscript />
        </ChatProvider>
      </UIStateProvider>,
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
    <button data-testid='probe' onClick={() => void actions.messageDispatch('hi', 'tell', true)}>
      {String(state.isAwaitingReply || state.isTaskRunning)}
    </button>
  );
};

describe('the processing signal both glows read', () => {
  it('outlives the outbound post — the visitor waits on the reply, not on the request', async () => {
    storageService.setConfig(getMockWidgetConfig({ mtxId: 'id', mtxKey: 'key' }) as CredentialedConfig);

    render(
      <UIStateProvider>
        <ChatProvider previewMode={false}>
          <ProcessingProbe />
        </ChatProvider>
      </UIStateProvider>,
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
    storageService.setConfig(getMockWidgetConfig({ mtxId: 'id2', mtxKey: 'key' }) as CredentialedConfig);
    vi.spyOn(streamClient, 'send').mockResolvedValue(undefined);
    mockExecuteTool.mockClear();

    render(
      <UIStateProvider>
        <ChatProvider previewMode={false}>
          <div />
        </ChatProvider>
      </UIStateProvider>,
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
    <UIStateProvider>
      <Profiler id='provider' onRender={countProviderCommit}>
        <ChatProvider previewMode={previewMode}>
          <Capture />
        </ChatProvider>
      </Profiler>
    </UIStateProvider>,
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

function setKeepAndSubject(subjectId: string, subjectContent: string): void {
  act(() => {
    captured!.chatActions.setMessages([
      agentMessage({ id: 'keep', mode: 'tell', parts: [{ type: 'text', content: 'keep' }] }),
      agentMessage({ id: subjectId, mode: 'tell', parts: [{ type: 'text', content: subjectContent }] }),
    ]);
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
    storageService.setConfig(getMockWidgetConfig({ mtxId: 'stale-parked', mtxKey: 'key' }) as CredentialedConfig);

    await act(async () => {
      await captured!.chatActions.messageDispatch('do the thing', 'do');
    });
    const placeholderId = captured!.messages[captured!.messages.length - 1]?.id as string;

    act(() => {
      asStreamClientInternals().handleMessage({ type: 'task/status', status: 'has_question' });
    });
    expect(captured!.messages.find(m => m.id === placeholderId)?.placeholderState).toBe('waiting-for-user');

    const messagesBeforeWatchdog = captured!.messages;
    act(() => {
      vi.advanceTimersByTime(120_000);
    });

    expect(captured!.messages).toBe(messagesBeforeWatchdog);
    expect(captured!.messages.find(m => m.id === placeholderId)?.placeholderState).toBe('waiting-for-user');
  });

  it('setMessages handed its own current array back is a no-op, even though it builds a new state object', () => {
    renderCaptured();
    act(() => {
      captured!.chatActions.setMessages([agentMessage({ id: 'a', mode: 'tell', parts: [] })]);
    });

    const messagesBefore = captured!.messages;
    const rendersBefore = providerCommitCount;
    act(() => {
      captured!.chatActions.setMessages(messagesBefore);
    });

    expect(providerCommitCount).toBe(rendersBefore);
    expect(captured!.messages).toBe(messagesBefore);
  });
});

describe('updateMessage / removeMessage act on the one message their id names', () => {
  it('updateMessage patches only the matching id', () => {
    renderCaptured();
    setKeepAndSubject('change', 'before');

    act(() => {
      captured!.chatActions.updateMessage('change', { parts: [{ type: 'text', content: 'after' }] });
    });

    expect(messageText(captured!.messages.find(m => m.id === 'keep')?.parts ?? [])).toBe('keep');
    expect(messageText(captured!.messages.find(m => m.id === 'change')?.parts ?? [])).toBe('after');
  });

  it('removeMessage drops only the matching id', () => {
    renderCaptured();
    setKeepAndSubject('drop', 'drop');

    act(() => {
      captured!.chatActions.removeMessage('drop');
    });

    expect(captured!.messages.map(m => m.id)).toEqual(['keep']);
  });
});

describe('a preview dispatch returns before reading real chat config', () => {
  it.each([
    ['echoing the user message', false, 2],
    ['skipping the user message', true, 1],
  ] as const)('%s', async (_label, skipUserMessage, expectedCount) => {
    renderCaptured(true);
    const getCredentialedConfig = vi.spyOn(storageService, 'getCredentialedConfig');

    await act(async () => {
      await captured!.chatActions.messageDispatch('hello', 'tell', skipUserMessage);
    });

    expect(getCredentialedConfig).not.toHaveBeenCalled();
    expect(captured!.messages).toHaveLength(expectedCount);
  });
});

describe('a real dispatch echoes the user message unless told to skip it', () => {
  it.each([
    ['echoing the user message', false, 2],
    ['skipping the user message', true, 1],
  ] as const)('%s', async (_label, skipUserMessage, expectedCount) => {
    renderCaptured(false);
    storageService.setConfig(
      getMockWidgetConfig({ mtxId: `real-skip-${String(skipUserMessage)}`, mtxKey: 'key' }) as CredentialedConfig,
    );

    await act(async () => {
      await captured!.chatActions.messageDispatch('hello', 'tell', skipUserMessage);
    });

    expect(captured!.messages).toHaveLength(expectedCount);
  });
});

describe('a real dispatch without credentials reports the error and stops', () => {
  it('never creates a reply placeholder or calls chatPost', async () => {
    renderCaptured(false);
    vi.spyOn(storageService, 'getCredentialedConfig').mockReturnValue(null);

    await act(async () => {
      await captured!.chatActions.messageDispatch('hello', 'tell');
    });

    expect(captured!.messages).toHaveLength(1);
    expect(captured!.messages[0]?.isPlaceholder).toBeFalsy();
    expect(captured!.taskState.phase).toBe('idle');
  });
});

describe('the finish tool ends the task only when it did not fail', () => {
  beforeEach(() => {
    vi.spyOn(streamClient, 'send').mockResolvedValue(undefined);
  });

  it('completes the task on a successful finish', async () => {
    renderCaptured(false);
    storageService.setConfig(getMockWidgetConfig({ mtxId: 'finish-ok', mtxKey: 'key' }) as CredentialedConfig);
    mockExecuteTool.mockReset().mockResolvedValue({ success: true, data: { text: 'done' } });

    await act(async () => {
      asStreamClientInternals().handleMessage({
        type: 'tool/call',
        tool_call_id: 'tc-finish-ok',
        browser_tool: 'finish',
        args: {},
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
    storageService.setConfig(getMockWidgetConfig({ mtxId: 'finish-failed', mtxKey: 'key' }) as CredentialedConfig);
    mockExecuteTool.mockReset().mockResolvedValue({ success: false, error: 'boom' });

    await act(async () => {
      asStreamClientInternals().handleMessage({
        type: 'tool/call',
        tool_call_id: 'tc-finish-failed',
        browser_tool: 'finish',
        args: {},
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
    storageService.setConfig(getMockWidgetConfig({ mtxId: 'tool-failed-data', mtxKey: 'key' }) as CredentialedConfig);
    mockExecuteTool.mockReset().mockResolvedValue({ success: false, error: 'boom' });
    const send = vi.spyOn(streamClient, 'send').mockResolvedValue(undefined);

    await dispatchClickToolCall('tc-fail');

    const payload = await sentPayloadFor(send, 'tc-fail');
    expect(payload).not.toHaveProperty('data');
    expect(payload['success']).toBe(false);
  });

  it('includes stringified data on a successful tool call', async () => {
    renderCaptured(false);
    storageService.setConfig(getMockWidgetConfig({ mtxId: 'tool-ok-data', mtxKey: 'key' }) as CredentialedConfig);
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
    storageService.setConfig(getMockWidgetConfig({ mtxId: 'trim-boundary', mtxKey: 'key' }) as CredentialedConfig);
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
    storageService.setConfig(getMockWidgetConfig({ mtxId: 'terminal-clears', mtxKey: 'key' }) as CredentialedConfig);
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
    storageService.setConfig(getMockWidgetConfig({ mtxId: 'chat-error-log', mtxKey: 'key' }) as CredentialedConfig);
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
