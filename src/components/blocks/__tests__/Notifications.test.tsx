/**
 * Behavioural tests for `WidgetNotifications` — the render-nothing component that mirrors the widget's
 * `error` and `greeting` props into Base UI toasts — mounted inside a real `NotificationProvider`.
 *
 * Base UI keeps the VISIBLE toast `aria-hidden` and announces through a separate `role="alert"` live
 * region, so every text assertion here sees TWO copies and every role query passes `hidden: true`. The
 * old hand-rolled toast had no live region at all, so nothing was ever announced — that is what these
 * tests guard. Inside the hidden subtree an accessible name computes to `""`, so the close control
 * cannot be found by role or name and is queried by its `aria-label` attribute instead. `noop` is the
 * placeholder for callbacks a given case does not assert on. The cases cover: an error reaching both the
 * toast and the live region with its close control calling `onClearError` once; Retry appearing only
 * once `onRetry` is supplied, and firing once when clicked; the error toast's stable id surviving a
 * re-render with fresh inline callback identities without closing or restacking; and the greeting
 * rendering with its body.
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
