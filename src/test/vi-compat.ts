/**
 * The one home for `vitest`-compat `vi.*` helpers bun's own `vi` shim doesn't implement: `mocked`/
 * `hoisted` type and hoisting shims, `advanceTimersByTimeAsync`/`waitFor` for fake-timer-aware polling,
 * `restoreModuleAfterAll` to un-mock a module after a suite (the fallback for when `vi.spyOn` can't patch
 * a mocked namespace, e.g. an oRPC client `Proxy` whose own property-assignment traps ignore it), and
 * `mockSdkModule` to type-check an `sdk` mock against the real client.
 */
import { afterAll, type Mock, vi } from 'bun:test';

import type { sdk } from '../sdk';

type RealSdk = typeof sdk;

type Mocked<T> = T extends (...args: infer A) => infer R
  ? Mock<(...args: A) => R>
  : { [K in keyof T]: T[K] extends (...args: infer A) => infer R ? Mock<(...args: A) => R> : T[K] };

export function mocked<T>(item: T): Mocked<T> {
  return item as Mocked<T>;
}

export function hoisted<T>(factory: () => T): T {
  return factory();
}

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

export function restoreModuleAfterAll(specifier: string, importReal: () => Promise<Record<string, unknown>>): void {
  afterAll(async () => {
    const real = await importReal();
    vi.mock(specifier, () => real);
  });
}

export function mockSdkModule(procedures: Partial<RealSdk>): { sdk: Partial<RealSdk> } {
  return { sdk: procedures };
}
