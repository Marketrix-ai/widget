/**
 * Tests for `ChatView`'s composer lock while a screen-access request is pending, multi-line message
 * rendering, resend-safe recovery when a send fails while the stream is down, and the screen-access
 * allow flows. A send-while-down test must mock `streamClient.ready` and not just `connect` — a turn
 * awaits `ready()`, which only resolves on `registered`, so mocking `connect` alone leaves that await
 * hanging forever and silently swallows the whole test.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { useChatContext } from '../../context/ChatContext';
import * as chatSession from '../../services/chatSession';
import * as ScreenShareService from '../../services/ScreenShareService';
import { storageService } from '../../services/StorageService';
import { streamClient } from '../../services/StreamClient';
import { mockMediaStream } from '../../test/fixtures';
import { ChatHarness, openChatTab, openWidget, renderWidget } from '../../test/renderWidget';
import { messageText } from '../../types';

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
    vi.spyOn(chatSession, 'getOrCreateChatId').mockResolvedValue('chat-1');
    vi.spyOn(streamClient, 'connect').mockResolvedValue();
    vi.spyOn(streamClient, 'ready').mockResolvedValue();
    vi.spyOn(streamClient, 'send').mockRejectedValue(new Error('offline'));

    storageService.scopeTo({ mtxId: 'chatview-stream-down-1' });
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
    vi.spyOn(chatSession, 'getOrCreateChatId').mockResolvedValue('chat-1');
    vi.spyOn(streamClient, 'connect').mockResolvedValue();
    vi.spyOn(streamClient, 'ready').mockResolvedValue();
    vi.spyOn(streamClient, 'send').mockRejectedValue(new Error('offline'));

    storageService.scopeTo({ mtxId: 'chatview-stream-down-2' });
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
    expect(captured!.messages[1]?.screenShareStatus).toBe('allowed');
  });

  it('allow, but the picker was cancelled: marks the card denied and still releases the turn', async () => {
    vi.spyOn(ScreenShareService, 'startScreenShare').mockRejectedValue(new Error('permission denied'));
    await requestAccess();

    await act(async () => await captured!.chatActions.allowScreenAccess());

    expect(captured!.messages[1]?.screenShareStatus).toBe('denied');
    expect(captured!.messages.map(m => m.kind)).toEqual(['user', 'screenAccess', 'agent']);
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
