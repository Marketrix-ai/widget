/**
 * The one home for the handful of `vitest` `vi.*` helpers bun's `vi` compat shim does not implement:
 * `mocked` (vitest's `vi.mocked` is a pure type-narrowing identity function at runtime — it exists so
 * TypeScript treats an already-mocked import as its `Mock` type, and does nothing else), `hoisted`
 * (vitest's `vi.hoisted` runs its factory before `vi.mock` calls are hoisted above imports; bun's own
 * `vi.mock`/`mock.module` already runs before the mocked specifier is imported without a separate
 * hoisting pass, so a plain function call in the test file, above the `vi.mock`, has the same effect),
 * `advanceTimersByTimeAsync` (bun's fake-timer shim has the synchronous `advanceTimersByTime` but
 * not the async variant — advancing then yielding one microtask tick lets a promise callback a fired
 * timer just resolved run before the next assertion, which is the only thing the async form adds), and
 * `restoreModuleAfterAll` (see its own doc comment — the one un-poisoning strategy for a `vi.mock` on a
 * module bun cannot instead `vi.spyOn` per export, e.g. an oRPC client Proxy whose own property
 * assignment traps ignore a spy).
 */
import { afterAll, vi } from 'bun:test';

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

/**
 * `vi.mock(specifier, factory)` replaces a module for the whole `bun test` process by RESOLVED PATH,
 * not just the file that called it — any other file importing the same module (even via a different
 * relative path or a `@/` alias) inherits whichever factory registered last, for as long as that stays
 * true. A `vi.spyOn` on the real module's namespace object is the usual fix (it patches one property
 * on the shared object rather than replacing the whole module), but it doesn't work on an object whose
 * OWN property-assignment traps ignore it — an oRPC client `Proxy`, for one. For a module mock like
 * that, this is the fallback: restore the real module in `afterAll`, dynamically imported through a
 * `?real`-suffixed specifier so the import bypasses this exact mock and reaches the genuine file.
 */
export function restoreModuleAfterAll(specifier: string, importReal: () => Promise<Record<string, unknown>>): void {
  afterAll(async () => {
    const real = await importReal();
    vi.mock(specifier, () => real);
  });
}
