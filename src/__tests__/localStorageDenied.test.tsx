/**
 * End-to-end test that the widget keeps working — opening, chatting, dragging, resizing — when a host
 * page throws on every `localStorage` access, warning at most once per kind.
 */
import { fireEvent, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import * as chatThread from '../services/chatThread';
import { scopeStorageTo } from '../services/StorageService';
import { streamClient } from '../services/StreamClient';
import { dragFabAndResize, getComposer, openChatTab, openWidget, renderWidget } from '../test/renderWidget';

describe('a host page that denies localStorage outright', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: storage is disabled');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError: storage is disabled');
    });
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(chatThread, 'getOrCreateChatId').mockResolvedValue('chat-1');
    vi.spyOn(streamClient, 'connect').mockResolvedValue();
    vi.spyOn(streamClient, 'ready').mockResolvedValue();
    vi.spyOn(streamClient, 'send').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('still opens, switches tabs, sends a chat message, and lets the visitor drag and resize — warning at most twice total', async () => {
    scopeStorageTo({ mtxId: 'storage-denied-1' });

    const result = renderWidget({ mtxId: 'storage-denied-1' }, { previewMode: false });
    const scope = within(result.container);
    await waitFor(() => expect(streamClient.connect).toHaveBeenCalled());

    openWidget();
    openChatTab();
    const composer = getComposer();

    fireEvent.change(composer, { target: { value: 'does this still work without storage?' } });
    fireEvent.keyDown(composer, { key: 'Enter' });
    await waitFor(() => expect(streamClient.send).toHaveBeenCalled());
    expect(scope.getByText('does this still work without storage?')).toBeInTheDocument();

    const panel = scope.getByRole('separator').parentElement;
    const sizeBefore = panel?.style.width;
    dragFabAndResize(result.container, { releaseGrip: true });
    expect(panel?.style.width).not.toBe(sizeBefore);

    expect(scope.getByRole('tab', { name: 'Chat' })).toBeInTheDocument();

    expect(warnSpy.mock.calls.length).toBeLessThanOrEqual(2);
    expect(warnSpy.mock.calls.length).toBeGreaterThan(0);
  });
});
