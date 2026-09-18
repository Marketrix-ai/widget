/**
 * Direct unit coverage for `utils/chat.ts`'s pure helpers — invariants the scattered indirect coverage
 * in `sseReducer`/`ChatProvider`/`ChatView` tests leaves unpinned: `findMessageForProgress`'s
 * sender/mode gating, `filterCancellationText`'s trim, progress-line lookup at index 0, the
 * failed-progress-line message format, message id uniqueness, user-content trimming, and the two fixed
 * user-facing strings.
 */
import { describe, expect, it } from 'bun:test';

import { mockMediaStream } from '../test/fixtures';
import { type ChatMessage, messageText } from '../types';
import {
  addProgressLine,
  CHAT_FAILURE_TEXT,
  createScreenshareMessage,
  createUserMessage,
  findMessageForProgress,
  markProgressLineComplete,
  markProgressLineFailed,
  SCREEN_ACCESS_PROMPT,
} from './chat';

const agentReply = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'agent-1',
  sender: 'agent',
  timestamp: new Date(),
  parts: [],
  ...overrides,
});

describe('findMessageForProgress', () => {
  it('never matches a user message, even one with no other agent-only flag set', () => {
    const userMsg: ChatMessage = { ...agentReply(), id: 'user-1', sender: 'user' };
    const result = findMessageForProgress({ messages: [userMsg], isTaskRunning: false, currentMode: 'tell' });
    expect(result).toBeNull();
  });

  it('only applies mode-specific ranking while the task is running, otherwise falls to the generic placeholder-first rank', () => {
    const placeholderOtherMode = agentReply({ id: 'placeholder-other-mode', isPlaceholder: true, mode: 'tell' });
    const replyMatchingMode = agentReply({ id: 'reply-matching-mode', mode: 'show' });
    const result = findMessageForProgress({
      messages: [placeholderOtherMode, replyMatchingMode],
      isTaskRunning: false,
      currentMode: 'show',
    });
    expect(result?.message.id).toBe('placeholder-other-mode');
  });
});

describe('progress-line text cleanup and lookup', () => {
  it('trims the cancellation-stripped text, not just replaces the marker', () => {
    const msg = agentReply();
    const withLine = addProgressLine(msg, 'click', '  clicked the button (cancelled by cleanup)  ');
    expect(withLine.parts[0]?.content).toBe('clicked the button');
  });

  it('finds and completes the open progress line even at part index 0', () => {
    const msg = addProgressLine(agentReply(), 'click', 'clicking');
    expect(msg.parts).toHaveLength(1);
    const completed = markProgressLineComplete(msg, 'click');
    expect(completed.parts[0]?.status).toBe('completed');
  });

  it('patches the existing open line at index 0 in place, rather than appending a second one', () => {
    const first = addProgressLine(agentReply(), 'click', 'clicking');
    const second = addProgressLine(first, 'click', 'still clicking');
    expect(second.parts).toHaveLength(1);
    expect(second.parts[0]?.content).toBe('still clicking');
  });

  it.each([
    [
      'appends the cleaned error in parentheses after the existing content, not in place of it',
      'timed out (cancelled by cleanup)',
      'clicking the button (timed out)',
    ],
    [
      'keeps the original content unchanged when the error is nothing but cancellation chatter',
      '(cancelled by cleanup)',
      'clicking the button',
    ],
  ] as const)('%s', (_case, error, expectedContent) => {
    const msg = addProgressLine(agentReply(), 'click', 'clicking the button');
    const failed = markProgressLineFailed(msg, 'click', error);
    expect(failed.parts[0]?.content).toBe(expectedContent);
  });
});

describe('message construction', () => {
  it('mints a unique id per message rather than a bare prefix', () => {
    const a = createUserMessage('hi');
    const b = createUserMessage('hi');
    expect(a.id).not.toBe(b.id);
    expect(a.id.startsWith('user-message-')).toBe(true);
  });

  it('trims user-supplied content before storing it', () => {
    expect(messageText(createUserMessage('  hello there  ').parts)).toBe('hello there');
  });

  it('sends a screenshare message from the user, not the agent', () => {
    expect(createScreenshareMessage(mockMediaStream()).sender).toBe('user');
  });
});

describe('fixed user-facing strings', () => {
  it('pins the exact screen-access prompt and chat-failure sentence', () => {
    expect(SCREEN_ACCESS_PROMPT).toBe('Can I take a look at your screen?');
    expect(CHAT_FAILURE_TEXT).toBe("I'm sorry, I encountered an error processing your request. Please try again.");
  });
});
