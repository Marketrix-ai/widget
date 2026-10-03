/**
 * Tests for `getOrCreateChatId`: the stored-id fast path, and that several callers racing before the
 * first `chatCreate` resolves still mint exactly one chat id and all resolve to it.
 *
 * Each test uses a fresh tenant id, since `StorageService`'s per-tenant context is cached in memory and
 * a shared tenant would carry a previous test's minted id into the next one.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import type { WidgetClient } from '../../sdk';
import { mockSdk } from '../../test/vi-compat';
import { getOrCreateChatId } from '../chatThread';
import { getChatId, scopeStorageTo, setChatId } from '../StorageService';

const chatCreate = vi.fn<WidgetClient['chatCreate']>();
mockSdk({ chatCreate });

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
    expect(chatCreate).not.toHaveBeenCalled();
  });
});

describe('getOrCreateChatId concurrent callers', () => {
  it('mints exactly one chat id under concurrent callers, and all resolve to it', async () => {
    let resolveCreate!: (id: string) => void;
    chatCreate.mockReturnValue(new Promise<string>(resolve => (resolveCreate = resolve)));

    const callers = [getOrCreateChatId(), getOrCreateChatId(), getOrCreateChatId()];

    expect(chatCreate).toHaveBeenCalledTimes(1);
    resolveCreate('chat-minted-once');

    const ids = await Promise.all(callers);

    expect(ids).toEqual(['chat-minted-once', 'chat-minted-once', 'chat-minted-once']);
    expect(chatCreate).toHaveBeenCalledTimes(1);
    expect(getChatId()).toBe('chat-minted-once');
  });

  it('retries on the next call after a failed create, rather than caching the rejection', async () => {
    chatCreate.mockRejectedValueOnce(new Error('network down'));
    await expect(getOrCreateChatId()).rejects.toThrow('network down');

    chatCreate.mockResolvedValueOnce('chat-retry');
    await expect(getOrCreateChatId()).resolves.toBe('chat-retry');
    expect(chatCreate).toHaveBeenCalledTimes(2);
  });
});
