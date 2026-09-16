/**
 * Regression test for the resting launcher's CSS anchoring: it renders the whole widget through
 * `WidgetProviders` + `WidgetRoot` on a mock config and asserts that `.mtx-fab-anchor` carries exactly
 * the `bottom` and `right` inline offsets — never all four edges.
 *
 * A fixed box with top AND bottom set takes its height from those offsets, and `useDragSnap` feeds the
 * measured height back into top — derived from `window.innerHeight`, which is not what the browser
 * resolves top against. The two disagreed by 70px on app.marketrix.co and the launcher climbed out of
 * the viewport a step per measurement.
 *
 * `previewMode: false` makes `WidgetProviders`' `InitBridge` mint a chat id and dial `streamClient`, same
 * as `WidgetProviders.test.tsx` — mocked here the same way, and awaited before the assertion, so the
 * connect promise doesn't resolve after this test has already unmounted and land an
 * act()-outside-a-test warning (or a real network attempt) on whichever test runs next.
 */
import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'bun:test';

import { chatSessionManager } from '../../../services/ChatSessionManager';
import { streamClient } from '../../../services/StreamClient';
import { renderWidget } from '../../../test/renderWidget';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the resting launcher anchor', () => {
  it('pins two edges, never four', async () => {
    vi.spyOn(chatSessionManager, 'getOrCreateChatId').mockResolvedValue('chat-1');
    const connect = vi.spyOn(streamClient, 'connect').mockResolvedValue();

    const { container } = renderWidget({}, { previewMode: false });
    await waitFor(() => expect(connect).toHaveBeenCalled());

    const anchor = container.querySelector<HTMLElement>('.mtx-fab-anchor');
    expect(anchor).not.toBeNull();
    const pinned = (['top', 'bottom', 'left', 'right'] as const).filter(edge => anchor?.style[edge] !== '');
    expect(pinned.sort()).toEqual(['bottom', 'right']);
  });
});
