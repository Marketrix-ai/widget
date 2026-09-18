/**
 * Tests for `ChatView`'s composer lock while a screen-access request is pending, multi-line message
 * rendering, resend-safe recovery when a send fails while the stream is down, and the `useScreenShare`
 * hook's allow/deny/dismiss/remount flows. A send-while-down test must mock `streamClient.ready` and not
 * just `connect` — `ChatService.chatPost` awaits `ready()`, which only resolves on `registered`, so
 * mocking `connect` alone leaves that await hanging forever and silently swallows the whole test.
 */
import { act, cleanup, fireEvent, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { chatSessionManager } from '../../services/ChatSessionManager';
import * as ScreenShareService from '../../services/ScreenShareService';
import { type CredentialedConfig, storageService } from '../../services/StorageService';
import { streamClient } from '../../services/StreamClient';
import { agentMessage, getMockWidgetConfig, mockMediaStream } from '../../test/fixtures';
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

describe('a send while the stream is down', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('restores the composed text to the composer instead of dropping it, so a resend is one tap away', async () => {
    storageService.setConfig(getMockWidgetConfig({ mtxId: 'chatview-stream-down-1' }) as CredentialedConfig);
    vi.spyOn(chatSessionManager, 'getOrCreateChatId').mockResolvedValue('chat-1');
    vi.spyOn(streamClient, 'connect').mockResolvedValue();
    vi.spyOn(streamClient, 'ready').mockResolvedValue();
    vi.spyOn(streamClient, 'send').mockRejectedValue(new Error('offline'));

    renderWidget({ mtxId: 'chatview-stream-down-1' }, { previewMode: false });
    await waitFor(() => expect(streamClient.connect).toHaveBeenCalled());
    openWidget();
    openChatTab();
    const composer = screen.getByPlaceholderText('Ask anything') as HTMLTextAreaElement;

    send(composer, 'are you still there?');
    expect(composer.value).toBe('');

    await waitFor(() => expect(composer.value).toBe('are you still there?'));
  });

  it('never overwrites text the visitor already started typing while the failed send was in flight', async () => {
    storageService.setConfig(getMockWidgetConfig({ mtxId: 'chatview-stream-down-2' }) as CredentialedConfig);
    vi.spyOn(chatSessionManager, 'getOrCreateChatId').mockResolvedValue('chat-1');
    vi.spyOn(streamClient, 'connect').mockResolvedValue();
    vi.spyOn(streamClient, 'ready').mockResolvedValue();
    vi.spyOn(streamClient, 'send').mockRejectedValue(new Error('offline'));

    renderWidget({ mtxId: 'chatview-stream-down-2' }, { previewMode: false });
    await waitFor(() => expect(streamClient.connect).toHaveBeenCalled());
    openWidget();
    openChatTab();
    const composer = screen.getByPlaceholderText('Ask anything') as HTMLTextAreaElement;

    send(composer, 'first attempt');
    fireEvent.change(composer, { target: { value: 'already typing something new' } });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(composer.value).toBe('already typing something new');
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
