/**
 * Direct unit coverage for `utils/chat.ts`'s pure helpers: message id uniqueness, user-content trimming, and
 * the fixed user-facing strings.
 */
import { describe, expect, it } from 'bun:test';

import { FakeMediaStream } from '../../test/fixtures';
import {
  CHAT_FAILURE_TEXT,
  createScreenAccessRequestMessage,
  createScreenshareMessage,
  createUserMessage,
  messageText,
  SCREEN_ACCESS_DETAIL,
  SCREEN_ACCESS_PROMPT,
} from '../chat';

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
    expect(createScreenshareMessage(new FakeMediaStream([])).kind).toBe('screenshare');
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
