/**
 * `useScreenShare` tests: allow resolves the request card, posts both messages and flushes the queued
 * message (also when the picker was cancelled, marking the card denied); deny flushes without sharing;
 * dismissing the dialog leaves the separate request card unanswered; a persisted open request survives
 * remount; an already-resolved request is ignored so a new one can be raised.
 */
import { act, renderHook } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'bun:test';

import * as ScreenShareService from '../services/ScreenShareService';
import { agentMessage } from '../test/fixtures';
import type { ChatMessage } from '../types';
import { useScreenShare, type UseScreenShareOptions } from './useScreenShare';

// `vi.mock('../services/ScreenShareService', ...)` registers against that resolved specifier for the
// WHOLE `bun test` process, not just this file — `../services/__tests__/ScreenShareService.test.ts`
// (the real implementation's own suite) statically imports the same path, and every test file's
// top-level imports resolve during one shared collection pass before any test body or `afterAll` runs,
// so a later restore can't un-poison a binding another file already captured. `vi.spyOn` on the shared
// `ScreenShareService` namespace object sidesteps this entirely: it patches the SAME object every
// importer already holds, restorable per test via `vi.restoreAllMocks()`, with no module-registry
// entry left behind for another file to inherit.
const startScreenShare = vi.spyOn(ScreenShareService, 'startScreenShare').mockImplementation(vi.fn());
const stopScreenShare = vi.spyOn(ScreenShareService, 'stopScreenShare').mockImplementation(vi.fn());
const isScreenSharing = vi.spyOn(ScreenShareService, 'isScreenSharing').mockReturnValue(false);

// Unlike a module mock, a spy patches the ONE shared `ScreenShareService` object every importer
// already holds a reference to, so it stays applied process-wide until explicitly restored — this
// file is the only one that needs the fake, so it undoes its own spies once its suite is done rather
// than leaving `../services/__tests__/ScreenShareService.test.ts` calling these fakes too.
afterAll(() => {
  startScreenShare.mockRestore();
  stopScreenShare.mockRestore();
  isScreenSharing.mockRestore();
});

const REQUEST_ID = 'screen-access-request-1';

const openRequestMessage: ChatMessage = agentMessage({
  id: REQUEST_ID,
  content: 'Can I take a look at your screen?',
  isPlaceholder: undefined,
  placeholderState: undefined,
  isScreenAccessRequest: true,
  pendingContent: 'do the thing',
  parts: [{ type: 'text', content: 'Can I take a look at your screen?' }],
});

const setup = (messages: ChatMessage[]) => {
  const opts = {
    onAddMessage: vi.fn(),
    onUpdateMessage: vi.fn(),
    onRemoveMessage: vi.fn(),
    onSendMessage: vi.fn(),
    onScreenSharingChange: vi.fn(),
    messages,
  } satisfies UseScreenShareOptions;
  const { result } = renderHook(() => useScreenShare(opts));
  return { result, opts };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  startScreenShare.mockResolvedValue({ id: 'stream' } as unknown as MediaStream);
  let n = 0;
  vi.spyOn(Date, 'now').mockImplementation(() => ++n);
});

describe('useScreenShare', () => {
  it('allow: resolves the request card, posts both messages, flushes the pending message', async () => {
    const { result, opts } = setup([openRequestMessage]);
    await act(async () => await result.current.handleScreenAccessRequestAllow());

    expect(opts.onUpdateMessage).toHaveBeenCalledWith(REQUEST_ID, { screenShareStatus: 'allowed' });
    expect(opts.onAddMessage.mock.calls.map(([m]) => m.content)).toEqual(['Screen sharing started', '']);
    expect(opts.onSendMessage).toHaveBeenCalledWith('do the thing', 'do', true);
    expect(result.current.isScreenSharing).toBe(true);
  });

  it('allow, but the picker was cancelled: marks the card denied and still flushes', async () => {
    startScreenShare.mockRejectedValue(new Error('permission denied'));
    const { result, opts } = setup([openRequestMessage]);
    await act(async () => await result.current.handleScreenAccessRequestAllow());

    expect(opts.onUpdateMessage).toHaveBeenCalledWith(REQUEST_ID, { screenShareStatus: 'denied' });
    expect(opts.onAddMessage).not.toHaveBeenCalled();
    expect(opts.onSendMessage).toHaveBeenCalledWith('do the thing', 'do', true);
    expect(result.current.isScreenSharing).toBe(false);
  });

  it('deny: resolves the card and flushes without starting a share', async () => {
    const { result, opts } = setup([openRequestMessage]);
    expect(result.current.isAwaitingScreenAccess).toBe(true);

    act(() => result.current.handleScreenAccessRequestDeny());

    expect(opts.onUpdateMessage).toHaveBeenCalledWith(REQUEST_ID, { screenShareStatus: 'denied' });
    expect(startScreenShare).not.toHaveBeenCalled();
    expect(opts.onSendMessage).toHaveBeenCalledWith('do the thing', 'do', true);
  });

  it('dialog dismiss: closes the dialog only, leaving the separate request card unanswered', () => {
    const { result, opts } = setup([openRequestMessage]);
    act(() => result.current.handleScreenAccessDialogDismiss());

    expect(result.current.showScreenAccessDialog).toBe(false);
    expect(result.current.isAwaitingScreenAccess).toBe(true);
    expect(opts.onUpdateMessage).not.toHaveBeenCalled();
    expect(opts.onSendMessage).not.toHaveBeenCalled();
  });

  it('dialog allow: same start, and now resolves an open card and flushes too', async () => {
    const { result, opts } = setup([openRequestMessage]);
    await act(async () => await result.current.handleScreenAccessDialogAllow());

    expect(result.current.showScreenAccessDialog).toBe(false);
    expect(opts.onAddMessage.mock.calls.map(([m]) => m.content)).toEqual(['Screen sharing started', '']);
    expect(opts.onUpdateMessage).toHaveBeenCalledWith(REQUEST_ID, { screenShareStatus: 'allowed' });
    expect(opts.onSendMessage).toHaveBeenCalledWith('do the thing', 'do', true);
  });

  it('flushes nothing when there is no open request', async () => {
    const { result, opts } = setup([]);
    await act(async () => await result.current.handleScreenAccessRequestAllow());

    expect(opts.onSendMessage).not.toHaveBeenCalled();
  });

  it('survives an unmount/remount: a persisted open request still resolves and flushes', () => {
    const { result, unmount } = renderHook(props => useScreenShare(props), {
      initialProps: {
        onAddMessage: vi.fn(),
        onUpdateMessage: vi.fn(),
        onRemoveMessage: vi.fn(),
        onSendMessage: vi.fn(),
        messages: [openRequestMessage],
      } satisfies UseScreenShareOptions,
    });
    expect(result.current.isAwaitingScreenAccess).toBe(true);
    unmount();

    const { result: remounted, opts } = setup([openRequestMessage]);
    expect(remounted.current.isAwaitingScreenAccess).toBe(true);

    act(() => remounted.current.handleScreenAccessRequestDeny());
    expect(opts.onUpdateMessage).toHaveBeenCalledWith(REQUEST_ID, { screenShareStatus: 'denied' });
    expect(opts.onSendMessage).toHaveBeenCalledWith('do the thing', 'do', true);
  });

  it('ignores an already-resolved request: not awaiting access, and a new request can be raised', () => {
    const resolved: ChatMessage = { ...openRequestMessage, screenShareStatus: 'denied' };
    const { result, opts } = setup([resolved]);

    expect(result.current.isAwaitingScreenAccess).toBe(false);

    act(() => result.current.requestScreenAccess('do', 'do the other thing'));
    expect(opts.onAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({ isScreenAccessRequest: true, pendingContent: 'do the other thing' }),
    );
  });
});
