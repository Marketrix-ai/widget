/**
 * `StorageService` tests: `scopeStorageTo` never carries one tenant's `chat_id` into another's scope and never
 * persists config or credentials, and a corrupted stored message is dropped alone; a chat
 * snapshot round-trips, with an active screen share stored as an ended notice because a MediaStream
 * cannot survive a reload; a stored value that is not JSON or fails its schema reads as absent;
 * `readLocalParsed`/`writeLocal` degrade to memory and keep working unpersisted
 * when `localStorage` throws (private-mode Safari, a sandboxed iframe) -- each warns only ONCE per
 * session (`warnOnce`, read through a fresh module import), proven against repeated denied writes rather
 * than a single one, since a single call could never distinguish "warns once" from "warns every time".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';
import { z } from 'zod';

import { agentMessage, credentialedConfig, mockMediaStream } from '../../test/fixtures';
import type { AgentMessage, ChatMessage } from '../../types';
import { createScreenshareMessage } from '../../utils/chat';
import {
  getChatId,
  readChatSnapshot,
  readLocalParsed,
  scopedKey,
  scopeStorageTo,
  setChatId,
  writeChatSnapshot,
  writeLocal,
} from '../StorageService';

let freshImports = 0;
const freshStorage = () => import(`../StorageService.ts?t=${freshImports++}`);

describe('scopedKey', () => {
  it('keeps the three tenant-scoped browser-local keys byte-identical', () => {
    const config = { mtxId: 'cred-1' };
    expect(scopedKey('marketrix_chat_context', config)).toBe('marketrix_chat_context_cred-1');
    expect(scopedKey('marketrix_widget_position', config)).toBe('marketrix_widget_position_cred-1');
    expect(scopedKey('marketrix_widget_size', config)).toBe('marketrix_widget_size_cred-1');
  });
});

describe('scopeTo scopes the chat context to the tenant', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not carry one tenant’s chat_id into another’s scope', () => {
    scopeStorageTo({ mtxId: 'tenant-a' });
    setChatId('chat-a');
    expect(getChatId()).toBe('chat-a');

    scopeStorageTo({ mtxId: 'tenant-b' });
    expect(getChatId()).toBeNull();

    scopeStorageTo({ mtxId: 'tenant-a' });
    expect(getChatId()).toBe('chat-a');
  });

  it('never persists the config or its credentials', () => {
    scopeStorageTo(credentialedConfig({ mtxId: 'tenant-no-config', mtxKey: 'secret-key' }));
    setChatId('chat-1');

    expect(localStorage.getItem(scopedKey('marketrix_chat_context', { mtxId: 'tenant-no-config' }))).not.toContain(
      'secret-key',
    );
  });

  it('keeps every valid stored message and drops only a corrupted one', () => {
    const key = scopedKey('marketrix_chat_context', { mtxId: 'tenant-corrupt' });
    const valid = { id: 'm1', kind: 'agent', timestamp: new Date().toISOString(), parts: [] };
    writeLocal(key, { chat_id: 7, messages: [valid, { id: 'broken' }], timestamp: Date.now() });

    scopeStorageTo({ mtxId: 'tenant-corrupt' });

    expect(getChatId()).toBeNull();
    expect(readChatSnapshot().messages.map(msg => msg.id)).toEqual(['m1']);
  });
});

describe('private-mode localStorage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('readLocalParsed degrades to absent instead of throwing when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: storage is disabled');
    });

    expect(readLocalParsed('any-key', z.string())).toBeUndefined();
  });

  it('readLocalParsed reads a value that is not JSON, or fails its schema, as absent', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('raw-key', 'top_left');
    localStorage.setItem('typed-key', JSON.stringify('sideways'));

    expect(readLocalParsed('raw-key', z.string())).toBeUndefined();
    expect(readLocalParsed('typed-key', z.enum(['top_left']))).toBeUndefined();
  });

  it('writeLocal degrades silently instead of throwing when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => writeLocal('any-key', 'value')).not.toThrow();
  });

  it('warns exactly once across many denied writes, not once per write', async () => {
    const { writeLocal } = await freshStorage();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError: storage is disabled');
    });

    writeLocal('key-a', 'value-1');
    writeLocal('key-b', 'value-2');
    writeLocal('key-c', 'value-3');

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('warns exactly once across many denied reads, not once per read, independently of the write warning', async () => {
    const { readLocalParsed, writeLocal } = await freshStorage();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: storage is disabled');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError: storage is disabled');
    });

    readLocalParsed('key-a', z.string());
    writeLocal('key-a', 'value');
    readLocalParsed('key-b', z.string());
    readLocalParsed('key-c', z.string());

    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});

describe('chat snapshot persistence', () => {
  const message = (overrides: Partial<AgentMessage> = {}): AgentMessage =>
    agentMessage({
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
    writeChatSnapshot({ messages: [], currentMode: 'tell', isOpen: false });
  });

  it('round-trips a snapshot', () => {
    writeChatSnapshot(snapshot([message()]));

    expect(readChatSnapshot().isOpen).toBe(true);
    expect(readChatSnapshot().messages).toEqual([message()]);
  });

  it('stores a screenshare as an ended notice, because a MediaStream cannot survive a reload', () => {
    writeChatSnapshot(snapshot([createScreenshareMessage(mockMediaStream({ id: 'stream' }))]));

    expect(readChatSnapshot().messages[0]).toMatchObject({
      kind: 'system',
      parts: [{ type: 'text', content: 'Screen sharing ended' }],
    });
  });
});
