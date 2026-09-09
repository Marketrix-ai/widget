/**
 * The one way a test mounts the whole widget: `renderWidget(overrides, {previewMode})` renders
 * `WidgetRoot` on `getMockWidgetConfig(overrides)` under `WidgetProviders` and returns the Testing
 * Library result; `openWidget` clicks the launcher and `openChatTab` moves to the Chat view, the two
 * steps every panel test opens with.
 *
 * `previewMode` defaults true, since a mounted widget otherwise mints a chat id and dials the stream.
 * `WidgetFabAnchor` passes false deliberately: the launcher's pixel anchoring is what it asserts, and
 * preview mode is the branch that skips it.
 */
import { fireEvent, render, screen } from '@testing-library/react';

import { WidgetRoot } from '../components/WidgetRoot';
import { WidgetProviders } from '../context/WidgetProviders';
import { getMockWidgetConfig } from './fixtures';

export function renderWidget(
  overrides: Parameters<typeof getMockWidgetConfig>[0] = {},
  { previewMode = true }: { previewMode?: boolean } = {},
) {
  return render(
    <WidgetProviders previewMode={previewMode}>
      <WidgetRoot config={getMockWidgetConfig(overrides)} />
    </WidgetProviders>,
  );
}

export const openWidget = (): void => {
  fireEvent.click(screen.getByRole('button', { name: /open/i }));
};

export const openChatTab = (): void => {
  fireEvent.click(screen.getByRole('tab', { name: 'Chat' }));
};
