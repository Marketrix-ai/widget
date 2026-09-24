/**
 * `WidgetProviders` initialization tests: no work after a StrictMode effect cleanup, the stored
 * transcript survives a second mount in the same page, no task is running on mount whatever a previous
 * page left on disk, and a failure minting the chat id or dialing the stream routes to the widget error state.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'bun:test';
import React from 'react';

import { useWidget } from '../../hooks/useWidget';
import * as chatSession from '../../services/chatSession';
import * as StorageService from '../../services/StorageService';
import { streamClient } from '../../services/StreamClient';
import { agentMessage, flushMicrotasks, getMockWidgetConfig } from '../../test/fixtures';
import { useUIStateContext } from '../UIStateContext';
import { WidgetProviders } from '../WidgetProviders';

const LIVE = getMockWidgetConfig({ isPreviewMode: false });

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
    vi.spyOn(chatSession, 'getOrCreateChatId').mockReturnValue(
      new Promise(resolve => {
        resolveChatId = resolve;
      }),
    );
    const connect = vi.spyOn(streamClient, 'connect');

    const view = render(
      <React.StrictMode>
        <WidgetProviders config={LIVE}>
          <div />
        </WidgetProviders>
      </React.StrictMode>,
    );
    view.unmount();
    resolveChatId('chat-id');
    await flushMicrotasks();

    expect(connect).not.toHaveBeenCalled();
  });

  it('keeps the stored transcript when the widget is mounted a second time in the same page', async () => {
    StorageService.setChatId('chat-1');
    StorageService.writeChatSnapshot({
      currentMode: 'tell',
      isOpen: false,
      messages: [
        agentMessage({
          mode: undefined,
          status: undefined,
          parts: [{ type: 'text', content: 'hello' }],
        }),
      ],
    });
    vi.spyOn(chatSession, 'getOrCreateChatId').mockResolvedValue('chat-1');
    const connect = vi.spyOn(streamClient, 'connect').mockResolvedValue();

    const first = render(
      <WidgetProviders config={LIVE}>
        <div />
      </WidgetProviders>,
    );
    await waitFor(() => expect(connect).toHaveBeenCalled());
    first.unmount();

    render(
      <WidgetProviders config={LIVE}>
        <div />
      </WidgetProviders>,
    );

    expect(StorageService.readChatSnapshot().messages.map(msg => msg.id)).toEqual(['agent-1']);
  });

  it('starts with no task running, whatever a previous page left on disk', async () => {
    vi.spyOn(chatSession, 'getOrCreateChatId').mockResolvedValue('chat-1');
    const connect = vi.spyOn(streamClient, 'connect').mockResolvedValue();
    vi.spyOn(StorageService, 'readChatSnapshot').mockReturnValue({
      messages: [],
      currentMode: 'tell',
      isOpen: false,
      isTaskRunning: true,
    } as ReturnType<typeof StorageService.readChatSnapshot>);

    render(
      <WidgetProviders config={LIVE}>
        <TaskProbe />
      </WidgetProviders>,
    );
    await waitFor(() => expect(connect).toHaveBeenCalled());

    expect(screen.getByTestId('task')).toHaveTextContent('false');
  });

  it.each([
    ['minting the chat id', () => vi.spyOn(chatSession, 'getOrCreateChatId').mockRejectedValue(new Error('down'))],
    [
      'dialing the stream without credentials',
      () => {
        vi.spyOn(chatSession, 'getOrCreateChatId').mockResolvedValue('chat-1');
        vi.spyOn(streamClient, 'connect').mockRejectedValue(new Error('down'));
      },
    ],
  ])('routes a failure %s to the widget error state', async (_, fail) => {
    const failure = new Error('down');
    fail();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <WidgetProviders config={LIVE}>
        <ErrorProbe />
      </WidgetProviders>,
    );

    expect(await screen.findByText('Widget failed to initialize — please refresh the page.')).toBeInTheDocument();
    await waitFor(() => expect(consoleError).toHaveBeenCalledWith('Widget initialization failed:', failure));
  });
});
