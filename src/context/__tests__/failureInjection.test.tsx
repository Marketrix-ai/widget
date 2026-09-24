/**
 * Table-driven tests that every external `ChatContext` interaction (message post, tool response, stop,
 * an unmatched error) fails into a human-readable message rather than a raw error, and recovers cleanly
 * on retry.
 */
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'bun:test';

import { useWidget } from '../../hooks/useWidget';
import type { WidgetEvent } from '../../sdk';
import type { executeTool } from '../../services/browserTools';
import * as chatThread from '../../services/chatThread';
import { streamClient } from '../../services/StreamClient';
import { asStreamClientInternals } from '../../test/fixtures';
import { ChatHarness } from '../../test/renderWidget';
import { waitFor } from '../../test/vi-compat';
import { CHAT_FAILURE_TEXT, isPending, messageText } from '../../utils/chat';
import { useChatContext } from '../ChatContext';

const RAW_MARKER = 'PG::ConnectionBad at db_pool.rb:42 — ECONNREFUSED 10.0.4.12:5432';

const mockExecuteTool = vi.fn<typeof executeTool>().mockResolvedValue({ success: true, data: { text: 'ok' } });
vi.mock('../../services/browserTools', () => ({ executeTool: mockExecuteTool }));

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
      <div data-testid='placeholder-id'>{messages.find(isPending)?.id ?? ''}</div>
      <button data-testid='send' onClick={() => void actions.sendTurn('hi', 'tell')} />
      <button data-testid='stop' onClick={actions.stopTask} />
    </div>
  );
};

function renderProbe() {
  render(
    <ChatHarness previewMode={false}>
      <Probe />
    </ChatHarness>,
  );
}

function visibleText(): string {
  return `${screen.getByTestId('error').textContent}|${screen.getByTestId('transcript').textContent}`;
}

beforeEach(() => {
  vi.spyOn(chatThread, 'getOrCreateChatId').mockResolvedValue('chat-1');
  vi.spyOn(streamClient, 'ready').mockResolvedValue();
  mockExecuteTool.mockReset().mockResolvedValue({ success: true, data: { text: 'ok' } });
  vi.spyOn(streamClient, 'send').mockResolvedValue(undefined);
});

describe('external-interaction failures never reach the customer page raw, and every one recovers', () => {
  it.each([
    {
      name: 'message POST rejects with a raw server body',
      humanText: CHAT_FAILURE_TEXT,
      run: async () => {
        vi.spyOn(streamClient, 'send').mockRejectedValueOnce(new Error(RAW_MARKER));
        await act(async () => screen.getByTestId('send').click());
        return () => {};
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
