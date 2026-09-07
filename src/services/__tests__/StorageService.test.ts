import { beforeEach, describe, expect, it } from 'vitest';

import { type CredentialedConfig, storageService, tenantScope } from '../StorageService';

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
