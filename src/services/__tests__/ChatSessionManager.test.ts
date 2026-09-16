/**
 * `chatSessionManager` mints a `chat_id` exactly once even when several callers ask before the first
 * create resolves: `InitBridge`'s stream connect, the rrweb recorder and `chatPost` all race for it on
 * first load, and each one minting its own thread would leave the stream listening on a chat no message
 * ever posts to. `sdk.chatCreate` is a controllable, delayed mock so the test can assert the lock is held
 * across the concurrent window, not just that the final id matches; `storageService.getChatId` is empty
 * throughout so every caller genuinely needs the in-flight promise rather than the stored fast path.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { sdk } from '../../sdk';
import { mocked, mockSdkModule, restoreModuleAfterAll } from '../../test/vi-compat';
import { chatSessionManager } from '../ChatSessionManager';
import { type CredentialedConfig, storageService } from '../StorageService';

vi.mock('../../sdk', () => mockSdkModule({ chatCreate: vi.fn() }));
restoreModuleAfterAll('../../sdk', () => import('../../sdk/index.ts?real'));

const mockSdk = mocked(sdk);

// storageService's `context` is loaded once per tenant scope, not re-read from localStorage per
// call, so a fresh tenant id per test (not just clearing localStorage) is what guarantees
// `getChatId()` starts null — otherwise the previous test's minted id would still be cached in
// memory and short-circuit `getOrCreateChatId` before it ever reaches `sdk.chatCreate`.
let tenant = 0;
beforeEach(() => {
  tenant += 1;
  storageService.setConfig({ mtxId: `tenant-${tenant}`, mtxKey: 'key', mtxApp: 1 } as CredentialedConfig);
});

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('ChatSessionManager concurrent callers', () => {
  it('mints exactly one chat id under concurrent callers, and all resolve to it', async () => {
    let resolveCreate!: (id: string) => void;
    mockSdk.chatCreate.mockReturnValue(new Promise<string>(resolve => (resolveCreate = resolve)));

    const callers = [
      chatSessionManager.getOrCreateChatId(),
      chatSessionManager.getOrCreateChatId(),
      chatSessionManager.getOrCreateChatId(),
    ];

    expect(mockSdk.chatCreate).toHaveBeenCalledTimes(1);
    resolveCreate('chat-minted-once');

    const ids = await Promise.all(callers);

    expect(ids).toEqual(['chat-minted-once', 'chat-minted-once', 'chat-minted-once']);
    expect(mockSdk.chatCreate).toHaveBeenCalledTimes(1);
    expect(storageService.getChatId()).toBe('chat-minted-once');
  });

  it('retries on the next call after a failed create, rather than caching the rejection', async () => {
    mockSdk.chatCreate.mockRejectedValueOnce(new Error('network down'));
    await expect(chatSessionManager.getOrCreateChatId()).rejects.toThrow('network down');

    mockSdk.chatCreate.mockResolvedValueOnce('chat-retry');
    await expect(chatSessionManager.getOrCreateChatId()).resolves.toBe('chat-retry');
    expect(mockSdk.chatCreate).toHaveBeenCalledTimes(2);
  });
});
