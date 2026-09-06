import { beforeEach, describe, expect, it } from 'vitest';

import { ChatService } from '@/services/ChatService';
import { storageService } from '@/services/StorageService';
import type { ChatMessage } from '@/types';

const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'agent-1',
  content: 'hello',
  sender: 'agent',
  timestamp: new Date('2026-01-01T00:00:00.000Z'),
  parts: [{ type: 'text', content: 'hello' }],
  ...overrides,
});

const snapshot = (messages: ChatMessage[]) => ({
  messages,
  isTaskRunning: false,
  currentMode: 'tell' as const,
  isOpen: true,
});

describe('ChatService persistence', () => {
  beforeEach(() => {
    storageService.updateContext({ chat_id: 'chat-1', messages: [], isOpen: false });
  });

  it('round-trips a snapshot', () => {
    const service = new ChatService();
    service.persist(snapshot([message()]));

    expect(storageService.getContext().isOpen).toBe(true);
    expect(service.restore().messages).toEqual([message()]);
  });

  it('restores a screenshare as an ended notice, because a MediaStream cannot survive a reload', () => {
    const service = new ChatService();
    service.persist(snapshot([message({ id: 'screenshare-1', content: '', parts: [] })]));

    expect(service.restore().messages[0]).toMatchObject({
      content: 'Screenshare ended',
      isSystemMessage: true,
      parts: [{ type: 'text', content: 'Screenshare ended' }],
    });
  });
});
