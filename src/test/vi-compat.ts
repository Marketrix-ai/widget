/**
 * The one home for the handful of `vitest` `vi.*` helpers bun's `vi` compat shim does not implement:
 * `mocked` (vitest's `vi.mocked` is a pure type-narrowing identity function at runtime — it exists so
 * TypeScript treats an already-mocked import as its `Mock` type, and does nothing else), `hoisted`
 * (vitest's `vi.hoisted` runs its factory before `vi.mock` calls are hoisted above imports; bun's own
 * `vi.mock`/`mock.module` already runs before the mocked specifier is imported without a separate
 * hoisting pass, so a plain function call in the test file, above the `vi.mock`, has the same effect),
 * and `advanceTimersByTimeAsync` (bun's fake-timer shim has the synchronous `advanceTimersByTime` but
 * not the async variant — advancing then yielding one microtask tick lets a promise callback a fired
 * timer just resolved run before the next assertion, which is the only thing the async form adds).
 */
import { vi } from 'bun:test';

export function mocked<T>(item: T): T {
  return item;
}

export function hoisted<T>(factory: () => T): T {
  return factory();
}

export async function advanceTimersByTimeAsync(ms: number): Promise<void> {
  vi.advanceTimersByTime(ms);
  await Promise.resolve();
}

/**
 * `vi.waitFor` is unimplemented under bun: poll `check` on a real macrotask tick, up to `timeout`ms,
 * returning as soon as it stops throwing (or resolving falsy-never — it never rejects the assertion
 * error, only surfaces the LAST one after the deadline, matching vitest's own contract).
 */
export async function waitFor<T>(check: () => T, timeout = 1000): Promise<T> {
  const deadline = Date.now() + timeout;
  for (;;) {
    try {
      return check();
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
}
