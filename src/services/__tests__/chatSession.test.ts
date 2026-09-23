/**
 * Tests for `getOrCreateChatId`: the stored-id fast path, and that several callers racing before the
 * first `chatCreate` resolves still mint exactly one chat id and all resolve to it.
 *
 * Each test uses a fresh tenant id, since `StorageService`'s per-tenant context is cached in memory and
 * a shared tenant would carry a previous test's minted id into the next one.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { sdk } from '../../sdk';
import { mocked, mockSdkModule, restoreModuleAfterAll } from '../../test/vi-compat';
import { getOrCreateChatId } from '../chatSession';
import { getChatId, scopeStorageTo, setChatId } from '../StorageService';

vi.mock('../../sdk', () => mockSdkModule({ chatCreate: vi.fn() }));
restoreModuleAfterAll('../../sdk', () => import('../../sdk/index.ts?real'));

const mockSdk = mocked(sdk);

let tenant = 0;
beforeEach(() => {
  tenant += 1;
  scopeStorageTo({ mtxId: `tenant-${tenant}` });
});

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('getOrCreateChatId stored id', () => {
  it('returns the id already in storage without minting a new one', async () => {
    setChatId('chat-stored');

    await expect(getOrCreateChatId()).resolves.toBe('chat-stored');
    expect(mockSdk.chatCreate).not.toHaveBeenCalled();
  });
});

describe('getOrCreateChatId concurrent callers', () => {
  it('mints exactly one chat id under concurrent callers, and all resolve to it', async () => {
    let resolveCreate!: (id: string) => void;
    mockSdk.chatCreate.mockReturnValue(new Promise<string>(resolve => (resolveCreate = resolve)));

    const callers = [getOrCreateChatId(), getOrCreateChatId(), getOrCreateChatId()];

    expect(mockSdk.chatCreate).toHaveBeenCalledTimes(1);
    resolveCreate('chat-minted-once');

    const ids = await Promise.all(callers);

    expect(ids).toEqual(['chat-minted-once', 'chat-minted-once', 'chat-minted-once']);
    expect(mockSdk.chatCreate).toHaveBeenCalledTimes(1);
    expect(getChatId()).toBe('chat-minted-once');
  });

  it('retries on the next call after a failed create, rather than caching the rejection', async () => {
    mockSdk.chatCreate.mockRejectedValueOnce(new Error('network down'));
    await expect(getOrCreateChatId()).rejects.toThrow('network down');

    mockSdk.chatCreate.mockResolvedValueOnce('chat-retry');
    await expect(getOrCreateChatId()).resolves.toBe('chat-retry');
    expect(mockSdk.chatCreate).toHaveBeenCalledTimes(2);
  });
});
