import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { NotificationProvider, WidgetNotifications } from '../Notifications';

const noop = () => {};

// Base UI keeps the visible toast `aria-hidden` and announces through a separate `role="alert"` live
// region — the old hand-rolled toast had no live region at all, so nothing was ever announced. Inside
// that hidden subtree an accessible name computes to "", so the close control is found by attribute.
const dismissButton = () => document.querySelector<HTMLElement>('[aria-label="Dismiss"]');

describe('WidgetNotifications', () => {
  it('announces an error and dismisses it', async () => {
    const onClearError = vi.fn();

    render(
      <NotificationProvider>
        <WidgetNotifications error='Something failed' onClearError={onClearError} onGreetingDismiss={noop} />
      </NotificationProvider>,
    );

    expect(await screen.findAllByText('Something failed')).toHaveLength(2);
    expect(screen.getByRole('alert', { hidden: true })).toHaveTextContent('Something failed');

    fireEvent.click(dismissButton() as HTMLElement);
    await waitFor(() => expect(onClearError).toHaveBeenCalledTimes(1));
  });

  it('offers Retry only when a retry is possible', async () => {
    const onRetry = vi.fn();

    const { rerender } = render(
      <NotificationProvider>
        <WidgetNotifications error='Disconnected' onClearError={noop} onGreetingDismiss={noop} />
      </NotificationProvider>,
    );

    await screen.findAllByText('Disconnected');
    expect(screen.queryByRole('button', { name: /retry/i, hidden: true })).toBeNull();

    rerender(
      <NotificationProvider>
        <WidgetNotifications error='Disconnected' onClearError={noop} onRetry={onRetry} onGreetingDismiss={noop} />
      </NotificationProvider>,
    );

    const retry = await screen.findByRole('button', { name: /retry/i, hidden: true });
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the greeting with its body', async () => {
    render(
      <NotificationProvider>
        <WidgetNotifications
          onClearError={noop}
          greeting='Hello there'
          greetingBody='How can I help?'
          onGreetingDismiss={noop}
        />
      </NotificationProvider>,
    );

    expect((await screen.findAllByText('Hello there')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('How can I help?').length).toBeGreaterThan(0);
  });
});
