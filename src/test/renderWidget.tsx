/**
 * The one way a test mounts the whole widget: `renderWidget(overrides, {previewMode})` renders
 * `WidgetRoot` on `getMockWidgetConfig(overrides)` under `WidgetProviders` and returns the Testing
 * Library result; `openWidget` clicks the launcher and `openChatTab` moves to the Chat view, the two
 * steps every panel test opens with. `ChatHarness` mounts just the chat store under a mock config.
 *
 * `previewMode` defaults true, since a mounted widget otherwise mints a chat id and dials the stream; a test
 * of the launcher's pixel anchoring passes false, since preview mode is the branch that skips it.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';

import { WidgetRoot } from '../components/WidgetRoot';
import { ChatProvider } from '../context/ChatContext';
import { UIStateProvider } from '../context/UIStateContext';
import { WidgetProviders } from '../context/WidgetProviders';
import { WidgetConfigContext } from '../hooks/useWidget';
import { getMockWidgetConfig } from './fixtures';

export function renderWidget(
  overrides: Parameters<typeof getMockWidgetConfig>[0] = {},
  { previewMode = true }: { previewMode?: boolean } = {},
) {
  return render(
    <WidgetProviders config={getMockWidgetConfig({ isPreviewMode: previewMode, ...overrides })}>
      <WidgetRoot />
    </WidgetProviders>,
  );
}

export const openWidget = (): void => {
  fireEvent.click(screen.getByRole('button', { name: /open/i }));
};

export const openChatTab = (): void => {
  fireEvent.click(screen.getByRole('tab', { name: 'Chat' }));
};

export const ChatHarness: React.FC<{
  previewMode?: boolean;
  overrides?: Parameters<typeof getMockWidgetConfig>[0];
  children: React.ReactNode;
}> = ({ previewMode = true, overrides = {}, children }) => (
  <WidgetConfigContext value={getMockWidgetConfig({ isPreviewMode: previewMode, ...overrides })}>
    <UIStateProvider>
      <ChatProvider>{children}</ChatProvider>
    </UIStateProvider>
  </WidgetConfigContext>
);
