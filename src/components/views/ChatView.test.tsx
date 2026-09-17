/**
 * `ChatView` tests: a send waiting on screen access locks the composer so no later send overwrites the
 * queued message, and unlocks to deliver it once answered; a multi-line message keeps its line breaks.
 *
 * `useScreenShare` tests: allow resolves the request card, posts both messages and flushes the queued
 * message (also when the picker was cancelled, marking the card denied); deny flushes without sharing;
 * dismissing the dialog leaves the separate request card unanswered; a persisted open request survives
 * remount; an already-resolved request is ignored so a new one can be raised.
 *
 * `ScreenShareService` is faked with `vi.spyOn`, created and restored inside `beforeEach`/`afterEach`
 * rather than `vi.mock` at module scope — `../../services/__tests__/ScreenShareService.test.ts` imports
 * the same module and a module-scope patch would leak into it regardless of file order (root
 * `CLAUDE.md` has the general cross-file leak mechanism); per-test scoping confines the fake to this
 * file's own tests.
 */
import { act, fireEvent, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import * as ScreenShareService from '../../services/ScreenShareService';
import { agentMessage, mockMediaStream } from '../../test/fixtures';
import { openChatTab, openWidget, renderWidget } from '../../test/renderWidget';
import { type ChatMessage, messageText } from '../../types';
import { useScreenShare, type UseScreenShareOptions } from './ChatView';

const openChat = (mode?: 'Show') => {
  renderWidget();
  openWidget();
  openChatTab();
  if (mode) fireEvent.click(screen.getByRole('button', { name: mode }));
  return screen.getByPlaceholderText('Ask anything') as HTMLTextAreaElement;
};

const send = (composer: HTMLTextAreaElement, text: string) => {
  fireEvent.change(composer, { target: { value: text } });
  fireEvent.keyDown(composer, { key: 'Enter' });
};

describe('a send that is waiting on screen access', () => {
  it('locks the composer, so no later send can overwrite the one queued message', () => {
    const composer = openChat('Show');

    send(composer, 'first message');

    expect(screen.getAllByText('Can I take a look at your screen?')).toHaveLength(1);
    expect(composer.disabled).toBe(true);

    send(composer, 'second message');

    expect(screen.queryByText('second message', { ignore: 'textarea' })).toBeNull();
    expect(screen.getByText('first message', { ignore: 'textarea' })).toBeInTheDocument();
  });

  it('unlocks once the request is answered, and delivers the queued message', () => {
    const composer = openChat('Show');
    send(composer, 'first message');

    fireEvent.click(screen.getByRole('button', { name: 'No' }));

    expect(composer.disabled).toBe(false);
    expect(screen.getByText('No')).toBeInTheDocument();
  });
});

describe('a message the visitor typed across several lines', () => {
  it('keeps its line breaks in the bubble, which is styled to preserve them', () => {
    const composer = openChat();

    send(composer, 'Hi, two things:\nline two');

    expect(screen.getByText('Hi, two things:\nline two', { normalizer: text => text })).toBeInTheDocument();
  });
});

let startScreenShare: ReturnType<typeof vi.spyOn<typeof ScreenShareService, 'startScreenShare'>>;

const REQUEST_ID = 'screen-access-request-1';

const openRequestMessage: ChatMessage = agentMessage({
  id: REQUEST_ID,
  isPlaceholder: undefined,
  placeholderState: undefined,
  isScreenAccessRequest: true,
  pendingContent: 'do the thing',
  parts: [{ type: 'text', content: 'Can I take a look at your screen?' }],
});

const makeScreenShareOpts = (messages: ChatMessage[]) =>
  ({
    onAddMessage: vi.fn(),
    onUpdateMessage: vi.fn(),
    onRemoveMessage: vi.fn(),
    onSendMessage: vi.fn(),
    onScreenSharingChange: vi.fn(),
    messages,
  }) satisfies UseScreenShareOptions;

const setup = (messages: ChatMessage[]) => {
  const opts = makeScreenShareOpts(messages);
  const { result } = renderHook(() => useScreenShare(opts));
  return { result, opts };
};

beforeEach(() => {
  startScreenShare = vi
    .spyOn(ScreenShareService, 'startScreenShare')
    .mockResolvedValue(mockMediaStream({ id: 'stream' }));
  vi.spyOn(ScreenShareService, 'stopScreenShare').mockImplementation(vi.fn());
  vi.spyOn(ScreenShareService, 'isScreenSharing').mockReturnValue(false);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  let n = 0;
  vi.spyOn(Date, 'now').mockImplementation(() => ++n);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useScreenShare', () => {
  it('allow: resolves the request card, posts both messages, flushes the pending message', async () => {
    const { result, opts } = setup([openRequestMessage]);
    await act(async () => await result.current.handleScreenAccessRequestAllow());

    expect(opts.onUpdateMessage).toHaveBeenCalledWith(REQUEST_ID, { screenShareStatus: 'allowed' });
    expect(opts.onAddMessage.mock.calls.map(call => messageText((call[0] as ChatMessage).parts))).toEqual([
      'Screen sharing started',
      '',
    ]);
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
    expect(opts.onAddMessage.mock.calls.map(call => messageText((call[0] as ChatMessage).parts))).toEqual([
      'Screen sharing started',
      '',
    ]);
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
      initialProps: makeScreenShareOpts([openRequestMessage]),
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
