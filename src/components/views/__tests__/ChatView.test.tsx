/**
 * Tests for `ChatView`'s composer lock while a screen-access request is pending, multi-line message
 * rendering, resend-safe recovery when a send fails while the stream is down, the screen-access
 * allow flows, a disabled mode never being sent and a forbidden turn showing the api's reason, Clear chat
 * starting a new thread, and the transcript scrolling itself rather than the host page.
 */
import { ORPCError } from '@orpc/client';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { useChatContext } from '../../../context/ChatContext';
import * as chatThread from '../../../services/chatThread';
import * as ScreenShareService from '../../../services/ScreenShareService';
import { scopeStorageTo } from '../../../services/StorageService';
import { streamClient } from '../../../services/StreamClient';
import { mockMediaStream, ofKind } from '../../../test/fixtures';
import { ChatHarness, openChatTab, openWidget, renderWidget } from '../../../test/renderWidget';
import { messageText } from '../../../utils/chat';

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
    vi.spyOn(chatThread, 'getOrCreateChatId').mockResolvedValue('chat-1');
    vi.spyOn(streamClient, 'connect').mockResolvedValue();
    vi.spyOn(streamClient, 'ready').mockResolvedValue();
    vi.spyOn(streamClient, 'send').mockRejectedValue(new Error('offline'));

    scopeStorageTo({ mtxId: 'chatview-stream-down-1' });
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
    vi.spyOn(chatThread, 'getOrCreateChatId').mockResolvedValue('chat-1');
    vi.spyOn(streamClient, 'connect').mockResolvedValue();
    vi.spyOn(streamClient, 'ready').mockResolvedValue();
    vi.spyOn(streamClient, 'send').mockRejectedValue(new Error('offline'));

    scopeStorageTo({ mtxId: 'chatview-stream-down-2' });
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

let captured: ReturnType<typeof useChatContext> | undefined;
const Capture = () => {
  captured = useChatContext();
  return null;
};

const liveStream = () =>
  mockMediaStream({
    getVideoTracks: () => [{ readyState: 'live', addEventListener: vi.fn() }],
    getTracks: () => [{ stop: vi.fn() }],
  });

const requestAccess = async () => {
  render(
    <ChatHarness>
      <Capture />
    </ChatHarness>,
  );
  await act(async () => {
    await captured!.chatActions.sendTurn('do the thing', 'do');
  });
};

describe('answering a screen-access request', () => {
  afterEach(() => {
    ScreenShareService.stopScreenShare();
    vi.restoreAllMocks();
  });

  it('allow: starts the share, announces it, resolves the card and releases the held turn', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getDisplayMedia: vi.fn().mockResolvedValue(liveStream()) },
      configurable: true,
    });
    await requestAccess();

    await act(async () => await captured!.chatActions.allowScreenAccess());

    expect(captured!.messages.map(m => m.kind)).toEqual(['user', 'screenAccess', 'system', 'screenshare', 'agent']);
    expect(ofKind(captured!.messages[1], 'screenAccess').screenShareStatus).toBe('allowed');
  });

  it('allow, but the picker was cancelled: says so, marks the card denied and still releases the turn', async () => {
    vi.spyOn(ScreenShareService, 'startScreenShare').mockRejectedValue(new Error('permission denied'));
    await requestAccess();

    await act(async () => await captured!.chatActions.allowScreenAccess());

    expect(ofKind(captured!.messages[1], 'screenAccess').screenShareStatus).toBe('denied');
    expect(captured!.messages.map(m => m.kind)).toEqual(['user', 'screenAccess', 'system', 'agent']);
    expect(messageText(captured!.messages[2]!.parts)).toBe(
      'Screen sharing could not start, so the assistant will continue without it.',
    );
  });

  it('a share ending announces it and drops the live video bubble', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getDisplayMedia: vi.fn().mockResolvedValue(liveStream()) },
      configurable: true,
    });
    await requestAccess();
    await act(async () => await captured!.chatActions.allowScreenAccess());

    act(() => ScreenShareService.stopScreenShare());

    expect(captured!.messages.some(m => m.kind === 'screenshare')).toBe(false);
    expect(messageText(captured!.messages.at(-1)!.parts)).toBe('Screen sharing stopped');
  });
});

describe('a mode the tenant disabled', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const liveChat = async (mtxId: string, overrides: Parameters<typeof renderWidget>[0]) => {
    vi.spyOn(chatThread, 'getOrCreateChatId').mockResolvedValue('chat-1');
    vi.spyOn(streamClient, 'connect').mockResolvedValue();
    vi.spyOn(streamClient, 'ready').mockResolvedValue();
    vi.spyOn(streamClient, 'send').mockResolvedValue();
    scopeStorageTo({ mtxId });
    renderWidget({ mtxId, use_screenshare: false, ...overrides }, { previewMode: false });
    await waitFor(() => expect(streamClient.connect).toHaveBeenCalled());
    openWidget();
    openChatTab();
    return screen.getByPlaceholderText('Ask anything') as HTMLTextAreaElement;
  };

  it('is never sent: the composer falls back to the first enabled mode', async () => {
    const composer = await liveChat('chatview-mode-1', { widget_feature_tell: false });

    send(composer, 'walk me through it');

    await waitFor(() => expect(streamClient.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'chat/show' })));
    expect(streamClient.send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'chat/tell' }));
  });

  it('locks the composer when the tenant enabled no mode at all', async () => {
    const composer = await liveChat('chatview-mode-2', {
      widget_feature_tell: false,
      widget_feature_show: false,
      widget_feature_do: false,
    });

    expect(composer.disabled).toBe(true);
  });
});

describe('clearing the chat', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('stops the reply in flight and opens a new chat thread, so the agent forgets the cleared turns', async () => {
    const chatIds = ['chat-1', 'chat-2'];
    vi.spyOn(chatThread, 'getOrCreateChatId').mockImplementation(() => Promise.resolve(chatIds[0] ?? 'none'));
    vi.spyOn(streamClient, 'connect').mockResolvedValue();
    vi.spyOn(streamClient, 'ready').mockResolvedValue();
    vi.spyOn(streamClient, 'send').mockResolvedValue();
    scopeStorageTo({ mtxId: 'chatview-clear-1' });
    renderWidget({ mtxId: 'chatview-clear-1' }, { previewMode: false });
    await waitFor(() => expect(streamClient.connect).toHaveBeenCalledWith('chat-1'));
    openWidget();
    openChatTab();
    send(screen.getByPlaceholderText('Ask anything') as HTMLTextAreaElement, 'hello?');
    await waitFor(() => expect(streamClient.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'chat/tell' })));

    chatIds.shift();
    fireEvent.click(screen.getByText('Clear chat'));

    expect(streamClient.send).toHaveBeenCalledWith({ type: 'chat/stop' });
    await waitFor(() => expect(streamClient.connect).toHaveBeenCalledWith('chat-2'));
    expect(screen.queryByText('hello?', { ignore: 'textarea' })).toBeNull();
  });
});

describe('following the conversation', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('scrolls the transcript itself, never the page around the widget', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const composer = openChat();

    send(composer, 'a new message');
    await act(() => new Promise(resolve => window.requestAnimationFrame(() => resolve(undefined))));

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(screen.getByRole('log').scrollTop).toBe(screen.getByRole('log').scrollHeight);
  });
});

describe('a turn the api refuses as forbidden', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows the api's reason instead of the generic failure text", async () => {
    vi.spyOn(chatThread, 'getOrCreateChatId').mockResolvedValue('chat-1');
    vi.spyOn(streamClient, 'connect').mockResolvedValue();
    vi.spyOn(streamClient, 'ready').mockResolvedValue();
    vi.spyOn(streamClient, 'send').mockRejectedValue(
      new ORPCError('FORBIDDEN', { message: 'Tell is turned off for this widget' }),
    );
    scopeStorageTo({ mtxId: 'chatview-forbidden-1' });
    renderWidget({ mtxId: 'chatview-forbidden-1' }, { previewMode: false });
    await waitFor(() => expect(streamClient.connect).toHaveBeenCalled());
    openWidget();
    openChatTab();

    send(screen.getByPlaceholderText('Ask anything') as HTMLTextAreaElement, 'hello?');

    expect(await screen.findByText('Tell is turned off for this widget')).toBeInTheDocument();
  });
});
