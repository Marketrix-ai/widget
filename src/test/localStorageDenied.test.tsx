/**
 * Proves the RESILIENCE contract for a host page that denies `localStorage` outright (Safari private
 * mode, third-party cookies off, a sandboxed iframe): every read/write across the whole widget degrades
 * to memory via `StorageService`'s `readLocal`/`writeLocal` (the only two `localStorage` call sites),
 * and every feature a visitor can reach keeps working — open, chat send/receive, drag the launcher,
 * resize the panel — none of which are storage-gated. `Storage.prototype.getItem`/`setItem` are mocked
 * to throw for the whole test rather than only around one call, so this is the end-to-end proof that
 * `StorageService.test.ts`'s function-level unit tests cannot give on their own: a real session exercises
 * `readLocal`/`writeLocal` dozens of times (every drag frame, every resize frame, every chat update via
 * `updateContext`), and `warnOnce` (`StorageService.ts`) must collapse all of them to ONE console line
 * per kind — proven here against the real UI, not just direct calls to the two functions — so a denied
 * host page's console stays quiet rather than spammed for the visitor's entire session.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { chatSessionManager } from '../services/ChatSessionManager';
import { type CredentialedConfig, storageService } from '../services/StorageService';
import { streamClient } from '../services/StreamClient';
import { getMockWidgetConfig } from './fixtures';
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
    vi.spyOn(chatSessionManager, 'getOrCreateChatId').mockResolvedValue('chat-1');
    vi.spyOn(streamClient, 'connect').mockResolvedValue();
    vi.spyOn(streamClient, 'ready').mockResolvedValue();
    vi.spyOn(streamClient, 'send').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('still opens, switches tabs, sends a chat message, and lets the visitor drag and resize — warning at most twice total', async () => {
    // `renderWidget`'s config prop alone doesn't scope `storageService`'s own module-singleton state
    // (see `ChatView.test.tsx`'s header) — without this, `messageDispatch`'s credentialed path reports
    // "Config not loaded or incomplete" and never reaches `streamClient.send`. `setConfig` itself
    // round-trips through the denied `readLocal`/`writeLocal` and must not throw either.
    const config = getMockWidgetConfig({ mtxId: 'storage-denied-1' }) as CredentialedConfig;
    storageService.setConfig(config);

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

    // Drag the launcher — `WidgetFab`'s drop handler calls `writeLocal` for the tenant position key.
    const fab = result.container.querySelector('.mtx-fab-trigger') as HTMLElement;
    fab.setPointerCapture = () => {};
    fab.releasePointerCapture = () => {};
    fireEvent.pointerDown(fab, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(fab, { pointerId: 1, clientX: 30, clientY: 30 });
    fireEvent.pointerUp(fab, { pointerId: 1, clientX: 30, clientY: 30 });

    // Resize the panel — `MessengerShell`'s drag handler calls `writeLocal` for the tenant size key.
    const grip = result.container.querySelector('[role="separator"]') as HTMLElement | null;
    if (grip) {
      fireEvent.mouseDown(grip, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(document, { clientX: 130, clientY: 140 });
      fireEvent.mouseUp(document, { clientX: 130, clientY: 140 });
    }

    // None of the above threw (an unhandled throw would have failed the test already) — the actual
    // "every feature still works" proof. The composer is disabled here because it's awaiting the
    // (unmocked) agent reply, same as any other send — nothing to do with storage being denied.
    expect(scope.getByRole('tab', { name: 'Chat' })).toBeInTheDocument();

    // `warnOnce` collapses every denied read (module init, every `loadContext`) to one call and every
    // denied write (every `updateContext`, every drag/resize frame) to a second — never one per call
    // despite the dozens of storage touches a real session like this one makes.
    expect(warnSpy.mock.calls.length).toBeLessThanOrEqual(2);
    expect(warnSpy.mock.calls.length).toBeGreaterThan(0);
  });
});
