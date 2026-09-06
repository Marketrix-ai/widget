import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatMessage } from '../../types';
import { ChatProvider, useChatContext } from '../ChatContext';
import { UIStateProvider } from '../UIStateContext';

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
