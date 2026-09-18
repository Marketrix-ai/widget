/**
 * `chatPost`'s ordering contract: mint or reuse the chat id, wait for the stream to be registered on
 * it, then post the turn — never sending before the chat id or the registration is settled.
 */
import { afterEach, describe, expect, it, vi } from 'bun:test';

import { chatPost } from '../ChatService';
import { chatSessionManager } from '../ChatSessionManager';
import { streamClient } from '../StreamClient';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('chatPost', () => {
  it('sends the mode-prefixed command with the request id and content after the stream is ready', async () => {
    vi.spyOn(chatSessionManager, 'getOrCreateChatId').mockResolvedValue('chat-1');
    vi.spyOn(streamClient, 'ready').mockResolvedValue();
    const send = vi.spyOn(streamClient, 'send').mockResolvedValue();

    await chatPost('hello', 'do', 'req-1');

    expect(streamClient.ready).toHaveBeenCalledWith('chat-1');
    expect(send).toHaveBeenCalledWith({ type: 'chat/do', request_id: 'req-1', content: 'hello' });
  });

  it('waits for the stream to register before sending, rather than racing the two', async () => {
    vi.spyOn(chatSessionManager, 'getOrCreateChatId').mockResolvedValue('chat-1');
    const order: string[] = [];
    let resolveReady!: () => void;
    vi.spyOn(streamClient, 'ready').mockImplementation(() => {
      order.push('ready-called');
      return new Promise<void>(resolve => {
        resolveReady = () => {
          order.push('ready-resolved');
          resolve();
        };
      });
    });
    vi.spyOn(streamClient, 'send').mockImplementation(async () => {
      order.push('send-called');
    });

    const pending = chatPost('hello', 'tell', 'req-2');
    await Promise.resolve();
    expect(order).toEqual(['ready-called']);

    resolveReady();
    await pending;

    expect(order).toEqual(['ready-called', 'ready-resolved', 'send-called']);
  });

  it('never posts if minting the chat id fails, and never mints a second id for that turn', async () => {
    vi.spyOn(chatSessionManager, 'getOrCreateChatId').mockRejectedValue(new Error('no chat id'));
    const ready = vi.spyOn(streamClient, 'ready').mockResolvedValue();
    const send = vi.spyOn(streamClient, 'send').mockResolvedValue();

    await expect(chatPost('hello', 'tell', 'req-3')).rejects.toThrow('no chat id');

    expect(ready).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
