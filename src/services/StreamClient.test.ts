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
      reconnectSuppressed: boolean;
      handleMessage: (event: { type: 'registered'; chat_id: string; application_id: number }) => void;
    };
    internals.chatId = 'new-chat';
    internals.reconnectSuppressed = false;
    const remountRegistration = client.waitUntilRegistered();
    internals.handleMessage({ type: 'registered', chat_id: 'new-chat', application_id: 2 });

    await expect(remountRegistration).resolves.toBeUndefined();
  });

  it('does not report a stream that has only reached open as connected', () => {
    const client = StreamClient.getInstance();
    const internals = client as unknown as { chatId: string; status: string };
    internals.chatId = 'chat-1';
    internals.status = 'open';

    expect(client.isConnected()).toBe(false);
  });

  it('leaves an open-but-unregistered stream still pending, so a send cannot outrun registration', async () => {
    const client = StreamClient.getInstance();
    const internals = client as unknown as {
      chatId: string;
      status: string;
      reconnectSuppressed: boolean;
      handleMessage: (event: { type: 'registered'; chat_id: string; application_id: number }) => void;
    };
    internals.chatId = 'chat-1';
    internals.status = 'open';
    internals.reconnectSuppressed = false;

    let registered = false;
    const pending = client.waitUntilRegistered().then(() => {
      registered = true;
    });

    await Promise.resolve();
    expect(registered).toBe(false);

    internals.handleMessage({ type: 'registered', chat_id: 'chat-1', application_id: 1 });
    await pending;
    expect(registered).toBe(true);
  });
});
