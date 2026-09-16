/**
 * ChatProvider tests around the reply placeholder: it gives up on its own even when no dispatch in this
 * page created it (a reload mid-reply), its stale-reply deadline is not pushed back by an unrelated
 * message the visitor adds while waiting, the processing signal both glows read outlives the
 * outbound POST — the visitor waits on the reply, not on the request — and a retransmitted `tool/call`
 * (same `tool_call_id`) runs the browser tool once, never twice.
 */
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';
import { useEffect } from 'react';

import { useWidget } from '../../hooks/useWidget';
import type { WidgetEvent } from '../../sdk';
import { type CredentialedConfig, storageService } from '../../services/StorageService';
import { streamClient } from '../../services/StreamClient';
import { agentMessage, getMockWidgetConfig } from '../../test/fixtures';
import { waitFor } from '../../test/vi-compat';
import { ChatProvider, useChatContext } from '../ChatContext';
import { UIStateProvider } from '../UIStateContext';

vi.mock('../../services/ChatService', () => ({ chatPost: vi.fn().mockResolvedValue(undefined) }));

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
  content: '',
  mode: 'tell',
  parts: [],
});

const Transcript = () => {
  const { messages, chatActions } = useChatContext();

  useEffect(() => {
    chatActions.setMessages([restoredPlaceholder]);
  }, [chatActions]);

  return <div data-testid='transcript'>{messages.map(msg => `${msg.id}:${msg.isPlaceholder}:${msg.content}`)}</div>;
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
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

  useEffect(() => {
    chatActions.setMessages([restoredPlaceholder]);
  }, [chatActions]);

  return (
    <>
      <div data-testid='transcript'>{messages.map(msg => `${msg.id}:${msg.isPlaceholder}:${msg.content}`)}</div>
      <button
        data-testid='churn'
        onClick={() =>
          chatActions.addMessage({
            id: `system-${messages.length}`,
            content: 'Mode changed',
            sender: 'user',
            timestamp: new Date(),
            isSystemMessage: true,
            parts: [],
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
