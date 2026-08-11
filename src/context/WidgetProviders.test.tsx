import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { chatSessionManager } from '../services/ChatSessionManager';
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
