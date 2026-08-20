import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as ScreenShareService from '../services/ScreenShareService';
import { type PendingMessage, useScreenShare, type UseScreenShareOptions } from './useScreenShare';

vi.mock('../services/ScreenShareService', () => ({
  isScreenSharing: () => false,
  startScreenShare: vi.fn(),
  stopScreenShare: vi.fn(),
}));

const startScreenShare = vi.mocked(ScreenShareService.startScreenShare);

const REQUEST_ID = 'screen-access-request-1';
const PENDING: PendingMessage = { content: 'do the thing', mode: 'do', alreadyAdded: true };

const setup = (pendingMessage: PendingMessage | null) => {
  const opts = {
    onAddMessage: vi.fn(),
    onUpdateMessage: vi.fn(),
    onRemoveMessage: vi.fn(),
    onSendMessage: vi.fn(),
    onScreenSharingChange: vi.fn(),
    pendingMessage,
    setPendingMessage: vi.fn(),
  } satisfies UseScreenShareOptions;
  const { result } = renderHook(() => useScreenShare(opts));
  act(() => result.current.requestScreenAccess('do'));
  opts.onAddMessage.mockClear();
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
    const { result, opts } = setup(PENDING);
    await act(async () => await result.current.handleScreenAccessAllow());

    expect(opts.onUpdateMessage).toHaveBeenCalledWith(REQUEST_ID, { screenShareStatus: 'allowed' });
    expect(opts.onAddMessage.mock.calls.map(([m]) => m.content)).toEqual(['Started screenshare', '']);
    expect(opts.onSendMessage).toHaveBeenCalledWith('do the thing', 'do', true);
    expect(opts.setPendingMessage).toHaveBeenCalledWith(null);
    expect(result.current.isScreenSharing).toBe(true);
  });

  it('allow, but the picker was cancelled: marks the card denied and still flushes', async () => {
    startScreenShare.mockRejectedValue(new Error('permission denied'));
    const { result, opts } = setup(PENDING);
    await act(async () => await result.current.handleScreenAccessAllow());

    expect(opts.onUpdateMessage).toHaveBeenCalledWith(REQUEST_ID, { screenShareStatus: 'denied' });
    expect(opts.onAddMessage).not.toHaveBeenCalled();
    expect(opts.onSendMessage).toHaveBeenCalledWith('do the thing', 'do', true);
    expect(result.current.isScreenSharing).toBe(false);
  });

  it('deny: resolves the card and flushes without starting a share', async () => {
    const { result, opts } = setup(PENDING);
    act(() => result.current.handleScreenAccessDeny());

    expect(opts.onUpdateMessage).toHaveBeenCalledWith(REQUEST_ID, { screenShareStatus: 'denied' });
    expect(startScreenShare).not.toHaveBeenCalled();
    expect(opts.onSendMessage).toHaveBeenCalledWith('do the thing', 'do', true);
  });

  it('dialog allow: same start, and now resolves an open card and flushes too', async () => {
    const { result, opts } = setup(PENDING);
    await act(async () => await result.current.handleScreenAccessDialogAllow());

    expect(result.current.showScreenAccessDialog).toBe(false);
    expect(opts.onAddMessage.mock.calls.map(([m]) => m.content)).toEqual(['Started screenshare', '']);
    expect(opts.onUpdateMessage).toHaveBeenCalledWith(REQUEST_ID, { screenShareStatus: 'allowed' });
    expect(opts.onSendMessage).toHaveBeenCalledWith('do the thing', 'do', true);
  });

  it('flushes nothing when there is no pending message', async () => {
    const { result, opts } = setup(null);
    await act(async () => await result.current.handleScreenAccessAllow());

    expect(opts.onSendMessage).not.toHaveBeenCalled();
    expect(opts.setPendingMessage).not.toHaveBeenCalled();
  });
});
