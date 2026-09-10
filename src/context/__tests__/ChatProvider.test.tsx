/**
 * ChatProvider tests around the reply placeholder: it gives up on its own even when no dispatch in this
 * page created it (a reload mid-reply), its stale-reply deadline is not pushed back by an unrelated
 * message the visitor adds while waiting, and the processing signal both glows read outlives the
 * outbound POST — the visitor waits on the reply, not on the request.
 */
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';
import { useEffect } from 'react';

import { useWidget } from '../../hooks/useWidget';
import { storageService } from '../../services/StorageService';
import { agentMessage } from '../../test/fixtures';
import { ChatProvider, useChatContext } from '../ChatContext';
import { UIStateProvider } from '../UIStateContext';

vi.mock('../../services/ChatService', () => ({ chatPost: vi.fn().mockResolvedValue(undefined) }));

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
  vi.useFakeTimers({ shouldAdvanceTime: true });
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
    storageService.setConfig({ mtxId: 'id', mtxKey: 'key' });

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
