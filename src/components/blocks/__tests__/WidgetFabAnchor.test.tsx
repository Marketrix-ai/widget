/**
 * Regression test for the resting launcher's CSS anchoring: it pins exactly the `bottom`/`right`
 * offsets, never all four edges.
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
