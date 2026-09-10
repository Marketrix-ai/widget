/**
 * `StorageService` tests: `tenantScope` prefers the credential id, then the application id, then a
 * fixed default; `setConfig` never carries one tenant's `chat_id` into another's scope; a chat snapshot
 * round-trips, with an active screen share stored as an ended notice because a MediaStream cannot
 * survive a reload.
 */
import { beforeEach, describe, expect, it } from 'bun:test';

import { agentMessage } from '../../test/fixtures';
import type { ChatMessage } from '../../types';
import { createScreenshareMessage } from '../../utils/chat';
import {
  type CredentialedConfig,
  readChatSnapshot,
  scopedKey,
  storageService,
  tenantScope,
  writeChatSnapshot,
} from '../StorageService';

describe('tenantScope', () => {
  it('prefers the credential id over the application id', () => {
    expect(tenantScope({ mtxId: 'cred-1', mtxApp: 7 })).toBe('cred-1');
  });

  it('falls back to the application id with no credential', () => {
    expect(tenantScope({ mtxApp: 7 })).toBe('7');
  });

  it('falls back to a fixed default with neither', () => {
    expect(tenantScope({})).toBe('default');
  });
});

describe('scopedKey', () => {
  it('keeps the three tenant-scoped browser-local keys byte-identical', () => {
    const config = { mtxId: 'cred-1' };
    expect(scopedKey('marketrix_chat_context', config)).toBe('marketrix_chat_context_cred-1');
    expect(scopedKey('marketrix_widget_position', config)).toBe('marketrix_widget_position_cred-1');
    expect(scopedKey('marketrix_widget_size', config)).toBe('marketrix_widget_size_cred-1');
  });
});

describe('setConfig scopes the chat context to the tenant', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const credentials = (mtxId: string): CredentialedConfig =>
    ({ mtxId, mtxKey: 'key', mtxApp: 1 }) as CredentialedConfig;

  it('does not carry one tenant’s chat_id into another’s scope', () => {
    storageService.setConfig(credentials('tenant-a'));
    storageService.setChatId('chat-a');
    expect(storageService.getChatId()).toBe('chat-a');

    storageService.setConfig(credentials('tenant-b'));
    expect(storageService.getChatId()).toBeNull();

    storageService.setConfig(credentials('tenant-a'));
    expect(storageService.getChatId()).toBe('chat-a');
  });
});

describe('chat snapshot persistence', () => {
  const message = (overrides: Partial<ChatMessage> = {}): ChatMessage =>
    agentMessage({
      content: 'hello',
      mode: undefined,
      isPlaceholder: undefined,
      placeholderState: undefined,
      parts: [{ type: 'text', content: 'hello' }],
      ...overrides,
    });

  const snapshot = (messages: ChatMessage[]) => ({
    messages,
    currentMode: 'tell' as const,
    isOpen: true,
  });

  beforeEach(() => {
    storageService.updateContext({ chat_id: 'chat-1', messages: [], isOpen: false });
  });

  it('round-trips a snapshot', () => {
    writeChatSnapshot(snapshot([message()]));

    expect(storageService.getContext().isOpen).toBe(true);
    expect(readChatSnapshot().messages).toEqual([message()]);
  });

  it('stores a screenshare as an ended notice, because a MediaStream cannot survive a reload', () => {
    writeChatSnapshot(snapshot([createScreenshareMessage({ id: 'stream' } as unknown as MediaStream)]));

    expect(readChatSnapshot().messages[0]).toMatchObject({
      content: 'Screen sharing ended',
      isSystemMessage: true,
      parts: [{ type: 'text', content: 'Screen sharing ended' }],
    });
  });
});
