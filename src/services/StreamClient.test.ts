import { afterEach, describe, expect, it } from 'vitest';

import { StreamClient } from './StreamClient';

afterEach(() => {
  StreamClient.getInstance().disconnect();
});

describe('StreamClient registration lifecycle', () => {
  it('rejects old registration waiters on disconnect without leaking into a remount', async () => {
    const client = StreamClient.getInstance();
    const registration = client.waitUntilRegistered();

    client.disconnect();

    await expect(registration).rejects.toThrow('Stream disconnected before registration');

    const internals = client as unknown as {
      chatId: string;
      isIntentionallyDisconnected: boolean;
      handleMessage: (event: { type: 'registered'; chat_id: string; application_id: number }) => void;
    };
    internals.chatId = 'new-chat';
    internals.isIntentionallyDisconnected = false;
    const remountRegistration = client.waitUntilRegistered();
    internals.handleMessage({ type: 'registered', chat_id: 'new-chat', application_id: 2 });

    await expect(remountRegistration).resolves.toBeUndefined();
  });
});
