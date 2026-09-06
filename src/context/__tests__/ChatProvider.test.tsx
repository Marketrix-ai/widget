import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useWidget } from '../../hooks/useWidget';
import { storageService } from '../../services/StorageService';
import type { ChatMessage } from '../../types';
import { ChatProvider, useChatContext } from '../ChatContext';
import { UIStateProvider } from '../UIStateContext';

vi.mock('../../services/ApiService', () => ({ messageDispatch: vi.fn().mockResolvedValue(undefined) }));

const restoredPlaceholder: ChatMessage = {
  id: 'temp-restored',
  content: '',
  sender: 'agent',
  timestamp: new Date('2026-01-01T00:00:00.000Z'),
  mode: 'tell',
  isPlaceholder: true,
  placeholderState: 'thinking',
  parts: [],
};

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
