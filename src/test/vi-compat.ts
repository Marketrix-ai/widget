/**
 * The one home for `vitest`-compat `vi.*` helpers bun's own `vi` shim doesn't implement:
 * `advanceTimersByTimeAsync`/`waitFor` for fake-timer-aware polling, and `mockSdk`, which swaps the `sdk` module's
 * client for typed procedure mocks and restores the real module after the suite (the fallback for when `vi.spyOn`
 * can't patch a mocked namespace, e.g. an oRPC client `Proxy` whose own property-assignment traps ignore it).
 */
import { afterAll, vi } from 'bun:test';

import * as sdk from '../sdk';

const REAL_SDK = { ...sdk };

export async function advanceTimersByTimeAsync(ms: number): Promise<void> {
  vi.advanceTimersByTime(ms);
  await Promise.resolve();
}

export async function waitFor<T>(check: () => T, timeout = 1000): Promise<T> {
  const deadline = Date.now() + timeout;
  for (;;) {
    try {
      return check();
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      if (vi.isFakeTimers()) await advanceTimersByTimeAsync(10);
      else await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
}

export function mockSdk(procedures: Partial<sdk.WidgetClient>): void {
  vi.mock('../sdk', () => ({ ...REAL_SDK, getSdk: () => procedures }));
  afterAll(() => vi.mock('../sdk', () => REAL_SDK));
}
