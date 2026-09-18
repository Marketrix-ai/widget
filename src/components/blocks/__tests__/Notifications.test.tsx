/**
 * Tests for `WidgetNotifications`, which mirrors error and greeting props into Base UI toasts: an
 * error is announced and dismissible, Retry appears only when offered, the toast survives a re-render,
 * and a greeting renders with its body.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { NotificationProvider, WidgetNotifications } from '../Notifications';

const noop = () => {};

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

    fireEvent.click(document.querySelector('[aria-label="Dismiss"]') as HTMLElement);
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

  it('keeps the error toast up across a re-render that passes new callback references', async () => {
    const { rerender } = render(
      <NotificationProvider>
        <WidgetNotifications error='Disconnected' onClearError={() => {}} onGreetingDismiss={noop} />
      </NotificationProvider>,
    );

    await screen.findAllByText('Disconnected');

    rerender(
      <NotificationProvider>
        <WidgetNotifications error='Disconnected' onClearError={() => {}} onGreetingDismiss={noop} />
      </NotificationProvider>,
    );

    expect(await screen.findAllByText('Disconnected')).not.toHaveLength(0);
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
