import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { chatService } from '../services/ChatService';
import { chatSessionManager } from '../services/ChatSessionManager';
import { StreamClient } from '../services/StreamClient';
import { useUIStateContext } from './UIStateContext';
import { WidgetProviders } from './WidgetProviders';

const ErrorProbe = () => {
  const { uiState } = useUIStateContext();
  return <div>{uiState.error}</div>;
};

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
    const restore = vi.spyOn(chatService, 'restore');
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

    expect(restore).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
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
