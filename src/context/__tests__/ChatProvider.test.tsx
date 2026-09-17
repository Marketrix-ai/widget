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
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';
import { useEffect } from 'react';

import { useWidget } from '../../hooks/useWidget';
import type { WidgetEvent } from '../../sdk';
import type * as ChatServiceModule from '../../services/ChatService';
import { type CredentialedConfig, storageService } from '../../services/StorageService';
import { streamClient } from '../../services/StreamClient';
import { agentMessage, getMockWidgetConfig } from '../../test/fixtures';
import { advanceTimersByTimeAsync, waitFor } from '../../test/vi-compat';
import { messageText } from '../../types';
import * as log from '../../utils/log';
import { ChatProvider, useChatContext } from '../ChatContext';
import { UIStateProvider } from '../UIStateContext';

vi.mock('../../services/ChatService', (): typeof ChatServiceModule => ({
  chatPost: vi.fn().mockResolvedValue(undefined),
}));

const mockExecuteTool = vi.fn().mockResolvedValue({ success: true, data: {} });
vi.mock('../../services/BrowserToolService', () => ({
  browserToolService: {
    executeTool: mockExecuteTool,
    getFriendlyToolName: (name: string) => name,
    isWaitForUserTool: () => false,
  },
  FINISH_TOOL: 'finish',
}));

interface StreamClientTestHandle {
  handleMessage: (event: WidgetEvent) => void;
}
const asStreamClientInternals = (): StreamClientTestHandle => streamClient as unknown as StreamClientTestHandle;

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
  // Without this, an EARLIER test's still-mounted ChatProvider keeps its stream-message subscription
  // live and double-handles every later test's broadcast `handleMessage` call.
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

const renderCaptured = (previewMode = true) => {
  render(
    <UIStateProvider>
      <ChatProvider previewMode={previewMode}>
        <Capture />
      </ChatProvider>
    </UIStateProvider>,
  );
};

describe('commit skips the render for a transition that reports no change', () => {
  it('a stale-reply watchdog firing on a message parked waiting-for-user does not re-render', async () => {
    renderCaptured(false);
    storageService.setConfig(getMockWidgetConfig({ mtxId: 'stale-parked', mtxKey: 'key' }) as CredentialedConfig);

    await act(async () => {
      await captured!.chatActions.messageDispatch('do the thing', 'do');
    });
    const placeholderId = captured!.messages[captured!.messages.length - 1]?.id as string;

    // `has_question` with no message text parks the placeholder waiting-for-user WITHOUT touching its
    // parts, so the watchdog's `pendingReplies` dependency (id:partsLength) is unchanged and its ORIGINAL
    // 120s timer — armed before the parking — is still the one that fires.
    act(() => {
      asStreamClientInternals().handleMessage({ type: 'task/status', status: 'has_question' });
    });
    expect(captured!.messages.find(m => m.id === placeholderId)?.placeholderState).toBe('waiting-for-user');

    const messagesBeforeWatchdog = captured!.messages;
    act(() => {
      vi.advanceTimersByTime(120_000);
    });

    // Reference equality proves `commit`'s no-change branch actually skipped `setState`, not just that
    // the text happens to match.
    expect(captured!.messages).toBe(messagesBeforeWatchdog);
    expect(captured!.messages.find(m => m.id === placeholderId)?.placeholderState).toBe('waiting-for-user');
  });
});

describe('updateMessage / removeMessage act on the one message their id names', () => {
  it('updateMessage patches only the matching id', () => {
    renderCaptured();
    act(() => {
      captured!.chatActions.setMessages([
        agentMessage({ id: 'keep', mode: 'tell', parts: [{ type: 'text', content: 'keep' }] }),
        agentMessage({ id: 'change', mode: 'tell', parts: [{ type: 'text', content: 'before' }] }),
      ]);
    });

    act(() => {
      captured!.chatActions.updateMessage('change', { parts: [{ type: 'text', content: 'after' }] });
    });

    expect(messageText(captured!.messages.find(m => m.id === 'keep')?.parts ?? [])).toBe('keep');
    expect(messageText(captured!.messages.find(m => m.id === 'change')?.parts ?? [])).toBe('after');
  });

  it('removeMessage drops only the matching id', () => {
    renderCaptured();
    act(() => {
      captured!.chatActions.setMessages([
        agentMessage({ id: 'keep', mode: 'tell', parts: [{ type: 'text', content: 'keep' }] }),
        agentMessage({ id: 'drop', mode: 'tell', parts: [{ type: 'text', content: 'drop' }] }),
      ]);
    });

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

    // If the early `return` after the preview reply were dropped, execution would fall through into the
    // real-chat branch below it and read config that was never set up for this test.
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

    // The placeholder created for the real reply is the +1 present in both counts.
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

    await act(async () => {
      asStreamClientInternals().handleMessage({
        type: 'tool/call',
        tool_call_id: 'tc-fail',
        browser_tool: 'click_element',
        args: { index: 0 },
        mode: 'do',
        explanation: 'Click it',
      });
      await advanceTimersByTimeAsync(0);
    });

    await waitFor(() => expect(send).toHaveBeenCalled());
    const payload = send.mock.calls
      .map(c => c[0])
      .find(p => (p as { tool_call_id?: string }).tool_call_id === 'tc-fail') as Record<string, unknown>;
    expect(payload).not.toHaveProperty('data');
    expect(payload['success']).toBe(false);
  });

  it('includes stringified data on a successful tool call', async () => {
    renderCaptured(false);
    storageService.setConfig(getMockWidgetConfig({ mtxId: 'tool-ok-data', mtxKey: 'key' }) as CredentialedConfig);
    mockExecuteTool.mockReset().mockResolvedValue({ success: true, data: { ok: true } });
    const send = vi.spyOn(streamClient, 'send').mockResolvedValue(undefined);

    await act(async () => {
      asStreamClientInternals().handleMessage({
        type: 'tool/call',
        tool_call_id: 'tc-ok',
        browser_tool: 'click_element',
        args: { index: 0 },
        mode: 'do',
        explanation: 'Click it',
      });
      await advanceTimersByTimeAsync(0);
    });

    await waitFor(() => expect(send).toHaveBeenCalled());
    const payload = send.mock.calls
      .map(c => c[0])
      .find(p => (p as { tool_call_id?: string }).tool_call_id === 'tc-ok') as Record<string, unknown>;
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

    // A `>` boundary read as `>=`, or the guard negated outright, would have trimmed the set already and
    // evicted this earliest id — this must still be a no-op dedupe, not a fresh execution.
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
