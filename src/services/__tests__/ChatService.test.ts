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
  activeTaskId: null,
  currentMode: 'tell' as const,
  isOpen: true,
  isMinimized: false,
  isLoading: false,
});

describe('ChatService persistence', () => {
  beforeEach(() => {
    storageService.updateContext({ chat_id: 'chat-1', messages: [], isOpen: false });
  });

  it('ignores a persist that arrives before restore, so a mount-time render cannot wipe stored messages', () => {
    new ChatService().persist(snapshot([message()]));

    expect(storageService.getContext().messages).toEqual([]);
  });

  it('round-trips a snapshot once restore has run', () => {
    const service = new ChatService();
    service.restore();
    service.persist(snapshot([message()]));

    expect(storageService.getContext().isOpen).toBe(true);
    expect(service.restore().messages).toEqual([message()]);
  });

  it('drops the __THINKING__ marker and a placeholder with nothing to show', () => {
    const service = new ChatService();
    service.restore();
    service.persist(
      snapshot([
        message({ content: 'thinking\n\n__THINKING__' }),
        message({ id: 'empty', isPlaceholder: true, parts: [] }),
      ]),
    );

    expect(storageService.getContext().messages.map(m => m.id)).toEqual(['agent-1']);
    expect(storageService.getContext().messages[0].content).toBe('thinking\n\n');
  });

  it('restores a screenshare as an ended notice, because a MediaStream cannot survive a reload', () => {
    const service = new ChatService();
    service.restore();
    service.persist(snapshot([message({ id: 'screenshare-1', content: '', parts: [] })]));

    expect(service.restore().messages[0]).toMatchObject({
      content: 'Screenshare ended',
      isSystemMessage: true,
      parts: [{ type: 'text', content: 'Screenshare ended' }],
    });
  });
});
