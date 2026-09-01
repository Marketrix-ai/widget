import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

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
    // Appended to the shadow root, not to mountEl: createRoot() clears its own container's children.
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
