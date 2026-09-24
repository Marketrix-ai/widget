/**
 * `VideoStreamDisplay` tests: a `play()` rejection that is not an abort shows the failure overlay and is
 * logged, whatever value it rejects with, while an abort from a replaced stream stays silent.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'bun:test';

import { mockMediaStream } from '../../../test/fixtures';
import { VideoStreamDisplay } from '../VideoStreamDisplay';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it.each([
  ['a DOMException', new DOMException('denied', 'NotAllowedError')],
  ['a non-Error value', 'blocked'],
])('shows the failure overlay when play() rejects with %s', async (_case, reason) => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(reason);
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

  render(<VideoStreamDisplay stream={mockMediaStream()} />);

  expect(await screen.findByText('Failed to load stream')).toBeInTheDocument();
  expect(consoleError).toHaveBeenCalledWith('[Widget] Failed to play the screen-share stream:', reason);
});

it('stays silent when play() is aborted by a replaced stream', async () => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new DOMException('replaced', 'AbortError'));
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

  render(<VideoStreamDisplay stream={mockMediaStream()} />);
  await Promise.resolve();

  expect(screen.getByText('Loading stream...')).toBeInTheDocument();
  expect(consoleError).not.toHaveBeenCalled();
});
