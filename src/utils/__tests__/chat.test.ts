/**
 * Direct unit coverage for `utils/chat.ts`'s pure helpers — invariants the scattered indirect coverage
 * in `chatReducer`/`ChatProvider`/`ChatView` tests leaves unpinned: `findMessageForProgress`'s
 * kind/mode gating, progress-line lookup at index 0, the
 * failed-progress-line message format, message id uniqueness, user-content trimming, and the two fixed
 * user-facing strings.
 */
import { describe, expect, it } from 'bun:test';

import { mockMediaStream } from '../../test/fixtures';
import type { AgentMessage, ChatMessage } from '../../types';
import {
  addProgressLine,
  CHAT_FAILURE_TEXT,
  createScreenAccessRequestMessage,
  createScreenshareMessage,
  createUserMessage,
  findMessageForProgress,
  markProgressLineComplete,
  markProgressLineFailed,
  messageText,
  SCREEN_ACCESS_DETAIL,
  SCREEN_ACCESS_PROMPT,
} from '../chat';

const agentReply = (overrides: Partial<AgentMessage> = {}): AgentMessage => ({
  id: 'agent-1',
  kind: 'agent',
  timestamp: new Date(),
  parts: [],
  ...overrides,
});

describe('findMessageForProgress', () => {
  it('never matches a user message', () => {
    const userMsg: ChatMessage = { id: 'user-1', kind: 'user', mode: 'tell', timestamp: new Date(), parts: [] };
    const result = findMessageForProgress({ messages: [userMsg], isTaskRunning: false, currentMode: 'tell' });
    expect(result).toBeNull();
  });

  it('only applies mode-specific ranking while the task is running, otherwise falls to the generic placeholder-first rank', () => {
    const placeholderOtherMode = agentReply({ id: 'placeholder-other-mode', status: 'thinking', mode: 'tell' });
    const replyMatchingMode = agentReply({ id: 'reply-matching-mode', mode: 'show' });
    const result = findMessageForProgress({
      messages: [placeholderOtherMode, replyMatchingMode],
      isTaskRunning: false,
      currentMode: 'show',
    });
    expect(result?.message.id).toBe('placeholder-other-mode');
  });
});

describe('progress-line lookup and failure text', () => {
  it('finds and completes the open progress line even at part index 0', () => {
    const msg = addProgressLine(agentReply(), 'click_element', 'clicking');
    expect(msg.parts).toHaveLength(1);
    const completed = markProgressLineComplete(msg, 'click_element');
    expect(completed.parts[0]).toMatchObject({ status: 'completed' });
  });

  it('patches the existing open line at index 0 in place, rather than appending a second one', () => {
    const first = addProgressLine(agentReply(), 'click_element', 'clicking');
    const second = addProgressLine(first, 'click_element', 'still clicking');
    expect(second.parts).toHaveLength(1);
    expect(second.parts[0]?.content).toBe('still clicking');
  });

  it.each([
    [
      'appends the error in parentheses after the existing content, not in place of it',
      'timed out',
      'clicking the button (timed out)',
    ],
    ['keeps the original content unchanged when there is no error text', '', 'clicking the button'],
  ] as const)('%s', (_case, error, expectedContent) => {
    const msg = addProgressLine(agentReply(), 'click_element', 'clicking the button');
    const failed = markProgressLineFailed(msg, 'click_element', error);
    expect(failed.parts[0]?.content).toBe(expectedContent);
  });
});

describe('message construction', () => {
  it('mints a unique id per message rather than a bare prefix', () => {
    const a = createUserMessage('hi', 'tell');
    const b = createUserMessage('hi', 'tell');
    expect(a.id).not.toBe(b.id);
    expect(a.id.startsWith('user-')).toBe(true);
  });

  it('trims user-supplied content before storing it', () => {
    expect(messageText(createUserMessage('  hello there  ', 'tell').parts)).toBe('hello there');
  });

  it('builds a screenshare message as its own kind', () => {
    expect(createScreenshareMessage(mockMediaStream()).kind).toBe('screenshare');
  });
});

describe('screen-access consent', () => {
  it('says declining withholds only the screen, since Show and Do still act on the page', () => {
    const request = createScreenAccessRequestMessage('do', 'Upgrade my plan');
    expect(request.parts.map(part => part.content)).toEqual([SCREEN_ACCESS_PROMPT, SCREEN_ACCESS_DETAIL]);
  });
});

describe('fixed user-facing strings', () => {
  it('pins the exact screen-access prompt and chat-failure sentence', () => {
    expect(SCREEN_ACCESS_PROMPT).toBe('Can I take a look at your screen?');
    expect(SCREEN_ACCESS_DETAIL).toContain('Saying no only keeps your screen private');
    expect(CHAT_FAILURE_TEXT).toBe("I'm sorry, I encountered an error processing your request. Please try again.");
  });
});
