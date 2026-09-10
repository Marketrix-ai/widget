/**
 * Behavioural tests for `WidgetDialog`, the widget's one modal, covering the two things a Base UI dialog
 * can get wrong here: its accessibility wiring and focus lifecycle, and where its portal lands.
 *
 * `Example` is a trigger button beside the dialog, holding `open` in state, so the close path has a real
 * prior focus owner to restore to and Escape closes through `onClose` rather than a prop flip. The first
 * test labels and focuses the modal, then closes and restores focus on Escape: `Dialog.Title` and
 * `Dialog.Description` become the dialog's accessible name and description, initial focus lands on
 * Cancel, and Escape both unmounts the dialog and returns focus to the trigger. It renders without
 * `WidgetProviders`, so `usePortalContainer` falls back to `document.body` — the light-DOM path, where
 * Base UI's own focus restore works and no `finalFocusRef` is needed. The second test portals into the
 * container it is given, never the host page: inside a real closed shadow tree the dialog is found under
 * the element published through `PortalContainerContext`, and `document.body` holds no dialog at all. A
 * portal escaping to the host page would leak widget UI into the customer's DOM and land outside the
 * element carrying the tenant tokens, rendering in `index.css`'s hardcoded fallback palette instead of
 * the tenant's theme.
 *
 * That portal target is appended to the shadow ROOT, not reused from `mountEl`: `mountEl` is the
 * container `createRoot()` renders into, and React clears its own container's children.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'bun:test';
import { useState } from 'react';

import { PortalContainerContext, WidgetProviders } from '../../../context/WidgetProviders';
import { createWidgetContainer } from '../../../utils/bootstrap';
import { WidgetDialog } from '../WidgetDialog';

describe('WidgetDialog', () => {
  it('labels and focuses the modal, then closes and restores focus on Escape', async () => {
    function Example() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Share screen</button>
          <WidgetDialog
            open={open}
            onClose={() => setOpen(false)}
            title='Allow screen access?'
            description='This lets Marketrix guide you.'
          />
        </>
      );
    }

    render(<Example />);
    const trigger = screen.getByRole('button', { name: 'Share screen' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Allow screen access?' });
    expect(dialog).toHaveAccessibleDescription('This lets Marketrix guide you.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus());

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('portals into the container it is given, never the host page', async () => {
    const { container, shadowRoot, mountEl } = createWidgetContainer();
    const widgetRoot = shadowRoot.appendChild(document.createElement('div'));

    render(
      <WidgetProviders previewMode>
        <PortalContainerContext value={widgetRoot}>
          <WidgetDialog open onClose={() => undefined} title='Shadow dialog' />
        </PortalContainerContext>
      </WidgetProviders>,
      { container: mountEl },
    );

    expect(await within(widgetRoot).findByRole('dialog', { name: 'Shadow dialog' })).toBeTruthy();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    container.remove();
  });
});
