/**
 * Tests for `ScreenAccessDialog`'s accessibility wiring and focus lifecycle on open/close, and that it
 * portals into the container it is given rather than the host page.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'bun:test';
import { useRef, useState } from 'react';

import { PortalContainerContext, WidgetProviders } from '../../../context/WidgetProviders';
import { getMockWidgetConfig } from '../../../test/fixtures';
import { SCREEN_ACCESS_DETAIL, SCREEN_ACCESS_PROMPT } from '../../../utils/chat';
import { ScreenAccessDialog } from '../ScreenAccessDialog';

describe('ScreenAccessDialog', () => {
  it('labels and focuses the modal, then closes and restores focus on Escape', async () => {
    function Example() {
      const [open, setOpen] = useState(false);
      const triggerRef = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={triggerRef} onClick={() => setOpen(true)}>
            Share screen
          </button>
          {open && (
            <ScreenAccessDialog
              onClose={() => setOpen(false)}
              onConfirm={() => setOpen(false)}
              finalFocusRef={triggerRef}
            />
          )}
        </>
      );
    }

    render(<Example />);
    const trigger = screen.getByRole('button', { name: 'Share screen' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: SCREEN_ACCESS_PROMPT });
    expect(dialog).toHaveAccessibleDescription(SCREEN_ACCESS_DETAIL);
    await waitFor(() => expect(screen.getByRole('button', { name: 'No' })).toHaveFocus());

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('portals into the container it is given, never the host page', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    const shadowRoot = container.attachShadow({ mode: 'closed' });
    const mountEl = shadowRoot.appendChild(document.createElement('div'));
    const widgetRoot = shadowRoot.appendChild(document.createElement('div'));

    render(
      <WidgetProviders config={getMockWidgetConfig()}>
        <PortalContainerContext value={widgetRoot}>
          <ScreenAccessDialog onClose={() => undefined} onConfirm={() => undefined} finalFocusRef={{ current: null }} />
        </PortalContainerContext>
      </WidgetProviders>,
      { container: mountEl },
    );

    expect(await within(widgetRoot).findByRole('dialog', { name: SCREEN_ACCESS_PROMPT })).toBeTruthy();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    container.remove();
  });
});
