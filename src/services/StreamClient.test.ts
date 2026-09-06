import { afterEach, describe, expect, it } from 'vitest';

import { StreamClient, StreamGaveUpError } from './StreamClient';

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
      tornDown: boolean;
      handleMessage: (event: { type: 'registered'; chat_id: string; application_id: number }) => void;
    };
    internals.chatId = 'new-chat';
    internals.tornDown = false;
    const remountRegistration = client.waitUntilRegistered();
    internals.handleMessage({ type: 'registered', chat_id: 'new-chat', application_id: 2 });

    await expect(remountRegistration).resolves.toBeUndefined();
  });

  it('rejects a pending registration when reconnection gives up, rather than leaving it hanging', async () => {
    const client = StreamClient.getInstance();
    const internals = client as unknown as {
      chatId: string;
      tornDown: boolean;
      reconnectAttempts: number;
      maxReconnectAttempts: number;
      scheduleReconnect: () => void;
    };
    internals.chatId = 'chat-1';
    internals.tornDown = false;

    const registration = client.waitUntilRegistered();
    internals.reconnectAttempts = internals.maxReconnectAttempts;
    internals.scheduleReconnect();

    await expect(registration).rejects.toBeInstanceOf(StreamGaveUpError);
  });

  it('rejects a pending registration when the credentials are refused', async () => {
    const client = StreamClient.getInstance();
    const internals = client as unknown as {
      chatId: string;
      tornDown: boolean;
      handleMessage: (event: { type: 'chat/error'; request_id: string; error: string }) => void;
    };
    internals.chatId = 'chat-1';
    internals.tornDown = false;

    const registration = client.waitUntilRegistered();
    internals.handleMessage({ type: 'chat/error', request_id: 'auth', error: 'unauthorized' });

    await expect(registration).rejects.toBeInstanceOf(StreamGaveUpError);
  });

  it('a rejected credential outlives connect, and a send cannot wait on a registration that will never come', async () => {
    const client = StreamClient.getInstance();
    const internals = client as unknown as {
      chatId: string;
      status: string;
      tornDown: boolean;
      credentialRejected: boolean;
      handleMessage: (event: { type: 'chat/error'; request_id: string; message: string }) => void;
    };
    internals.chatId = 'chat-auth';
    internals.status = 'open';
    internals.tornDown = false;
    internals.credentialRejected = false;

    internals.handleMessage({ type: 'chat/error', request_id: 'auth', message: 'rejected' });
    expect(internals.credentialRejected).toBe(true);

    await client.connect('chat-auth');
    expect(internals.credentialRejected).toBe(true);
    expect(client.canReconnect()).toBe(false);

    await expect(client.waitUntilRegistered()).rejects.toThrow('credentials were rejected');
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
      tornDown: boolean;
      handleMessage: (event: { type: 'registered'; chat_id: string; application_id: number }) => void;
    };
    internals.chatId = 'chat-1';
    internals.status = 'open';
    internals.tornDown = false;

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
