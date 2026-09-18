/**
 * `StorageService` tests: `tenantScope` prefers the credential id, then the application id, then a
 * fixed default; `setConfig` never carries one tenant's `chat_id` into another's scope, and persists
 * exactly the given config fields to the raw record — no field this repo didn't put there; a chat
 * snapshot round-trips, with an active screen share stored as an ended notice because a MediaStream
 * cannot survive a reload; `readLocal`/`writeLocal` degrade to memory and keep working unpersisted
 * when `localStorage` throws (private-mode Safari, a sandboxed iframe) -- each warns only ONCE per
 * session (`warnOnce`/`resetStorageWarningsForTests`), proven against repeated denied writes rather
 * than a single one, since a single call could never distinguish "warns once" from "warns every time".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { agentMessage, mockMediaStream } from '../../test/fixtures';
import type { ChatMessage } from '../../types';
import { createScreenshareMessage } from '../../utils/chat';
import {
  type CredentialedConfig,
  readChatSnapshot,
  readLocal,
  resetStorageWarningsForTests,
  scopedKey,
  storageService,
  tenantScope,
  writeChatSnapshot,
  writeLocal,
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

  it('persists exactly the given config fields — nothing beyond documented, no fabricated PII', () => {
    const config = credentials('tenant-pii-scope');
    (config as { userId?: number }).userId = 42;

    storageService.setConfig(config);

    const raw = JSON.parse(readLocal(scopedKey('marketrix_chat_context', config)) ?? '{}') as {
      config: Record<string, unknown>;
    };
    expect(Object.keys(raw.config).sort()).toEqual(Object.keys(config).sort());
    expect(raw.config).toEqual(config as unknown as Record<string, unknown>);
  });
});

describe('private-mode localStorage', () => {
  beforeEach(() => {
    resetStorageWarningsForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetStorageWarningsForTests();
  });

  it('readLocal degrades to null instead of throwing when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: storage is disabled');
    });

    expect(() => readLocal('any-key')).not.toThrow();
    expect(readLocal('any-key')).toBeNull();
  });

  it('writeLocal degrades silently instead of throwing when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => writeLocal('any-key', 'value')).not.toThrow();
  });

  it('warns exactly once across many denied writes, not once per write', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError: storage is disabled');
    });

    writeLocal('key-a', 'value-1');
    writeLocal('key-b', 'value-2');
    writeLocal('key-c', 'value-3');

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('warns exactly once across many denied reads, not once per read, independently of the write warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: storage is disabled');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError: storage is disabled');
    });

    readLocal('key-a');
    writeLocal('key-a', 'value');
    readLocal('key-b');
    readLocal('key-c');

    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});

describe('chat snapshot persistence', () => {
  const message = (overrides: Partial<ChatMessage> = {}): ChatMessage =>
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
    storageService.updateContext({ chat_id: 'chat-1', messages: [], isOpen: false });
  });

  it('round-trips a snapshot', () => {
    writeChatSnapshot(snapshot([message()]));

    expect(storageService.getContext().isOpen).toBe(true);
    expect(readChatSnapshot().messages).toEqual([message()]);
  });

  it('stores a screenshare as an ended notice, because a MediaStream cannot survive a reload', () => {
    writeChatSnapshot(snapshot([createScreenshareMessage(mockMediaStream({ id: 'stream' }))]));

    expect(readChatSnapshot().messages[0]).toMatchObject({
      isSystemMessage: true,
      parts: [{ type: 'text', content: 'Screen sharing ended' }],
    });
  });
});
