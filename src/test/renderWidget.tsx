/**
 * The one way a test mounts the whole widget: `renderWidget(overrides, {previewMode})` renders
 * `WidgetRoot` on `getMockWidgetConfig(overrides)` under `WidgetProviders` and returns the Testing
 * Library result; `openWidget` clicks the launcher and `openChatTab` moves to the Chat view, the two
 * steps every panel test opens with; `dragFabAndResize` pointer-drags the launcher, then the resize grip.
 * `ChatHarness` mounts just the chat store under a mock config, and `renderChatHarness` mounts it and
 * returns a getter for the live chat context.
 *
 * `previewMode` defaults true, since a mounted widget otherwise mints a chat id and dials the stream; a test
 * of the launcher's pixel anchoring passes false, since preview mode is the branch that skips it.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';

import { WidgetRoot } from '../components/WidgetRoot';
import { ChatProvider, useChatContext } from '../context/ChatContext';
import { UIStateProvider } from '../context/UIStateContext';
import { WidgetProviders } from '../context/WidgetProviders';
import { WidgetConfigContext } from '../hooks/useWidget';
import { $, getMockWidgetConfig } from './fixtures';

type ChatContextValue = ReturnType<typeof useChatContext>;

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

const pointerGesture = (target: HTMLElement, release: boolean): void => {
  Object.assign(target, {
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    hasPointerCapture: () => true,
  });
  fireEvent.pointerDown(target, { pointerId: 1, clientX: 0, clientY: 0 });
  fireEvent.pointerMove(target, { pointerId: 1, clientX: 40, clientY: 40 });
  if (release) fireEvent.pointerUp(target, { pointerId: 1, clientX: 40, clientY: 40 });
};

export function dragFabAndResize(container: HTMLElement, { releaseGrip }: { releaseGrip: boolean }): void {
  pointerGesture($('.mtx-fab-trigger', container), true);
  pointerGesture($('[role="separator"]', container), releaseGrip);
}

interface ChatHarnessProps {
  previewMode?: boolean;
  overrides?: Parameters<typeof getMockWidgetConfig>[0];
}

export const ChatHarness: React.FC<ChatHarnessProps & { children: React.ReactNode }> = ({
  previewMode = true,
  overrides = {},
  children,
}) => (
  <WidgetConfigContext value={getMockWidgetConfig({ isPreviewMode: previewMode, ...overrides })}>
    <UIStateProvider>
      <ChatProvider>{children}</ChatProvider>
    </UIStateProvider>
  </WidgetConfigContext>
);

export function renderChatHarness(
  props: ChatHarnessProps = {},
  wrap: (ui: React.ReactElement) => React.ReactElement = ui => ui,
): () => ChatContextValue {
  let current: ChatContextValue | undefined;
  const Capture = () => {
    current = useChatContext();
    return null;
  };
  render(
    wrap(
      <ChatHarness {...props}>
        <Capture />
      </ChatHarness>,
    ),
  );
  return () => {
    if (!current) throw new Error('renderChatHarness: the chat store never mounted');
    return current;
  };
}
