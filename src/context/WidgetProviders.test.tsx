import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useWidget } from '../hooks/useWidget';
import { chatSessionManager } from '../services/ChatSessionManager';
import * as StorageService from '../services/StorageService';
import { type ChatSnapshot, storageService } from '../services/StorageService';
import { StreamClient } from '../services/StreamClient';
import { useUIStateContext } from './UIStateContext';
import { WidgetProviders } from './WidgetProviders';

const ErrorProbe = () => {
  const { uiState } = useUIStateContext();
  return <div>{uiState.error}</div>;
};

const TaskProbe = () => <div data-testid='task'>{String(useWidget().state.isTaskRunning)}</div>;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WidgetProviders initialization', () => {
  it('does no initialization work when an async StrictMode effect has been cleaned up', async () => {
    let resolveChatId!: (chatId: string) => void;
    vi.spyOn(chatSessionManager, 'getOrCreateChatId').mockReturnValue(
      new Promise(resolve => {
        resolveChatId = resolve;
      }),
    );
    const connect = vi.spyOn(StreamClient.getInstance(), 'connect');

    const view = render(
      <React.StrictMode>
        <WidgetProviders>
          <div />
        </WidgetProviders>
      </React.StrictMode>,
    );
    view.unmount();
    resolveChatId('chat-id');
    await Promise.resolve();

    expect(connect).not.toHaveBeenCalled();
  });

  it('keeps the stored transcript when the widget is mounted a second time in the same page', async () => {
    storageService.updateContext({
      chat_id: 'chat-1',
      messages: [
        {
          id: 'agent-1',
          content: 'hello',
          sender: 'agent',
          timestamp: new Date('2026-01-01T00:00:00.000Z').toISOString(),
          parts: [{ type: 'text', content: 'hello' }],
        },
      ],
    });
    vi.spyOn(chatSessionManager, 'getOrCreateChatId').mockResolvedValue('chat-1');
    const connect = vi.spyOn(StreamClient.getInstance(), 'connect').mockResolvedValue();

    const first = render(
      <WidgetProviders>
        <div />
      </WidgetProviders>,
    );
    await waitFor(() => expect(connect).toHaveBeenCalled());
    first.unmount();

    render(
      <WidgetProviders>
        <div />
      </WidgetProviders>,
    );

    expect(storageService.getContext().messages.map(msg => msg.id)).toEqual(['agent-1']);
  });

  it('starts with no task running, whatever a previous page left on disk', async () => {
    vi.spyOn(chatSessionManager, 'getOrCreateChatId').mockResolvedValue('chat-1');
    const connect = vi.spyOn(StreamClient.getInstance(), 'connect').mockResolvedValue();
    vi.spyOn(StorageService, 'readChatSnapshot').mockReturnValue({
      messages: [],
      currentMode: 'tell',
      isOpen: false,
      isTaskRunning: true,
    } as ChatSnapshot);

    render(
      <WidgetProviders>
        <TaskProbe />
      </WidgetProviders>,
    );
    await waitFor(() => expect(connect).toHaveBeenCalled());

    expect(screen.getByTestId('task')).toHaveTextContent('false');
  });

  it('routes chat initialization failures to the widget error state', async () => {
    const failure = new Error('chat unavailable');
    vi.spyOn(chatSessionManager, 'getOrCreateChatId').mockRejectedValue(failure);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <WidgetProviders>
        <ErrorProbe />
      </WidgetProviders>,
    );

    expect(await screen.findByText('Widget failed to initialise — please refresh the page.')).toBeInTheDocument();
    await waitFor(() => expect(consoleError).toHaveBeenCalledWith('Widget initialization failed:', failure));
  });
});
