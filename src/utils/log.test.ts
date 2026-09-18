/**
 * Tests for `logWarn`: prints the bare message with no cause, and appends the cause's message when one
 * is given.
 */
import { describe, expect, it, vi } from 'bun:test';

import { logWarn } from './log';

describe('logWarn', () => {
  it('prints the bare message when no cause is given', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logWarn('something degraded');
    expect(warn).toHaveBeenCalledWith('something degraded');
    warn.mockRestore();
  });

  it('appends the cause message when one is given', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logWarn('something degraded:', new Error('offline'));
    expect(warn).toHaveBeenCalledWith('something degraded: offline');
    warn.mockRestore();
  });
});
