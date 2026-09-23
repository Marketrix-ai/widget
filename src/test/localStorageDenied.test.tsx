/**
 * End-to-end test that the widget keeps working — opening, chatting, dragging, resizing — when a host
 * page throws on every `localStorage` access, warning at most once per kind.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import * as chatSession from '../services/chatSession';
import { scopeStorageTo } from '../services/StorageService';
import { streamClient } from '../services/StreamClient';
import { openChatTab, openWidget, renderWidget } from './renderWidget';

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
    vi.spyOn(chatSession, 'getOrCreateChatId').mockResolvedValue('chat-1');
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
    const composer = screen.getByPlaceholderText('Ask anything') as HTMLTextAreaElement;

    fireEvent.change(composer, { target: { value: 'does this still work without storage?' } });
    fireEvent.keyDown(composer, { key: 'Enter' });
    await waitFor(() => expect(streamClient.send).toHaveBeenCalled());
    expect(scope.getByText('does this still work without storage?')).toBeInTheDocument();

    const fab = result.container.querySelector('.mtx-fab-trigger') as HTMLElement;
    fab.setPointerCapture = () => {};
    fab.releasePointerCapture = () => {};
    fireEvent.pointerDown(fab, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(fab, { pointerId: 1, clientX: 30, clientY: 30 });
    fireEvent.pointerUp(fab, { pointerId: 1, clientX: 30, clientY: 30 });

    const grip = result.container.querySelector('[role="separator"]') as HTMLElement | null;
    if (grip) {
      fireEvent.mouseDown(grip, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(document, { clientX: 130, clientY: 140 });
      fireEvent.mouseUp(document, { clientX: 130, clientY: 140 });
    }

    expect(scope.getByRole('tab', { name: 'Chat' })).toBeInTheDocument();

    expect(warnSpy.mock.calls.length).toBeLessThanOrEqual(2);
    expect(warnSpy.mock.calls.length).toBeGreaterThan(0);
  });
});
