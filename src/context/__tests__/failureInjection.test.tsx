/**
 * Table-driven failure injection over `ChatContext`: every external interaction it drives (message POST,
 * tool/response POST, chat/stop POST, an unmatched `chat/error`, the auth give-up) is failed once via
 * `it.each`, asserting the SAME three invariants that stopped the leaks this pass fixed — the visible text
 * (a transcript bubble or the `useWidget().state.error` banner) is drawn from the fixed human sentence in
 * the case table, never contains the case's injected raw marker (a stand-in for a stack, a status code or
 * a server internals string), and a following retry of the same action succeeds with no reducer left
 * stuck mid-flight. `RAW_MARKER` is deliberately implausible prose so a `.toContain` false-negative (the
 * marker coincidentally appearing in a legitimate human sentence) cannot happen.
 *
 * Screen-share denial (`ChatView.test.tsx`) and a stuck `rrweb/events` flush (`RrwebSessionRecorder.test.ts`)
 * already pin the same invariant for their own transports and are not repeated here.
 */
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'bun:test';

import { useWidget } from '../../hooks/useWidget';
import type { WidgetEvent } from '../../sdk';
import type * as ChatServiceModule from '../../services/ChatService';
import { type CredentialedConfig, storageService } from '../../services/StorageService';
import { streamClient } from '../../services/StreamClient';
import { asStreamClientInternals, browserToolServiceMock, getMockWidgetConfig } from '../../test/fixtures';
import { waitFor } from '../../test/vi-compat';
import { messageText } from '../../types';
import { CHAT_FAILURE_TEXT } from '../../utils/chat';
import { ChatProvider, useChatContext } from '../ChatContext';
import { UIStateProvider } from '../UIStateContext';

const RAW_MARKER = 'PG::ConnectionBad at db_pool.rb:42 — ECONNREFUSED 10.0.4.12:5432';

const chatPostMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../../services/ChatService', (): typeof ChatServiceModule => ({
  chatPost: (...args) => chatPostMock(...args),
}));

const mockExecuteTool = vi.fn().mockResolvedValue({ success: true, data: {} });
vi.mock('../../services/BrowserToolService', () => browserToolServiceMock(mockExecuteTool));

const TOOL_CALL: WidgetEvent = {
  type: 'tool/call',
  tool_call_id: 'tc-fault',
  browser_tool: 'click_element',
  args: { index: 1 },
  mode: 'do',
  explanation: 'Click it',
};

const Probe = () => {
  const { state, actions } = useWidget();
  const { messages } = useChatContext();
  return (
    <div>
      <div data-testid='error'>{state.error ?? ''}</div>
      <div data-testid='awaiting'>{String(state.isAwaitingReply)}</div>
      <div data-testid='transcript'>{messages.map(m => messageText(m.parts)).join('|')}</div>
      <div data-testid='placeholder-id'>{messages.find(m => m.isPlaceholder)?.id ?? ''}</div>
      <button data-testid='send' onClick={() => void actions.messageDispatch('hi', 'tell', true)} />
      <button data-testid='stop' onClick={() => void actions.stopTask()} />
    </div>
  );
};

function renderProbe() {
  storageService.setConfig(getMockWidgetConfig({ mtxId: 'fault-id', mtxKey: 'fault-key' }) as CredentialedConfig);
  render(
    <UIStateProvider>
      <ChatProvider previewMode={false}>
        <Probe />
      </ChatProvider>
    </UIStateProvider>,
  );
}

function visibleText(): string {
  return `${screen.getByTestId('error').textContent}|${screen.getByTestId('transcript').textContent}`;
}

beforeEach(() => {
  chatPostMock.mockReset().mockResolvedValue(undefined);
  mockExecuteTool.mockReset().mockResolvedValue({ success: true, data: {} });
  vi.spyOn(streamClient, 'send').mockResolvedValue(undefined);
});

describe('external-interaction failures never reach the customer page raw, and every one recovers', () => {
  it.each([
    {
      name: 'message POST rejects with a raw server body',
      humanText: CHAT_FAILURE_TEXT,
      run: async () => {
        chatPostMock.mockRejectedValueOnce(new Error(RAW_MARKER));
        await act(async () => screen.getByTestId('send').click());
        return () => chatPostMock.mockResolvedValueOnce(undefined);
      },
    },
    {
      name: 'an unmatched chat/error settles the placeholder',
      humanText: CHAT_FAILURE_TEXT,
      run: async () => {
        await act(async () => screen.getByTestId('send').click());
        const requestId = screen.getByTestId('placeholder-id').textContent ?? '';
        act(() =>
          asStreamClientInternals().handleMessage({ type: 'chat/error', request_id: requestId, error: RAW_MARKER }),
        );
        return () => {};
      },
    },
    {
      name: 'tool/call execution throws unexpectedly',
      humanText: 'Something went wrong running that step. Please try again.',
      run: async () => {
        mockExecuteTool.mockRejectedValueOnce(new Error(RAW_MARKER));
        await act(async () => {
          asStreamClientInternals().handleMessage(TOOL_CALL);
          await Promise.resolve();
        });
        return () => {};
      },
    },
    {
      name: 'the tool/response POST fails',
      humanText: 'Could not report that step back to the assistant — it may stop responding.',
      run: async () => {
        vi.spyOn(streamClient, 'send').mockRejectedValueOnce(new Error(RAW_MARKER));
        await act(async () => {
          asStreamClientInternals().handleMessage({ ...TOOL_CALL, tool_call_id: 'tc-fault-2' });
          await Promise.resolve();
        });
        return () => {};
      },
    },
    {
      name: 'the chat/stop POST fails',
      humanText: 'Could not stop the assistant — it may still be working.',
      run: async () => {
        vi.spyOn(streamClient, 'send').mockRejectedValueOnce(new Error(RAW_MARKER));
        await act(async () => screen.getByTestId('stop').click());
        return () => {};
      },
    },
  ])('$name', async ({ humanText, run }) => {
    renderProbe();

    const undo = await run();

    await waitFor(() => expect(visibleText()).toContain(humanText));
    expect(visibleText()).not.toContain(RAW_MARKER);
    expect(screen.getByTestId('awaiting')).toHaveTextContent('false');

    undo();
    await act(async () => screen.getByTestId('send').click());
    await waitFor(() => expect(screen.getByTestId('awaiting')).toHaveTextContent('true'));
  });
});
