/**
 * The one home for `vitest` `vi.*` helpers bun's `vi` compat shim does not implement.
 *
 * `mocked` widens vitest's type-narrowing identity function to bun's own `Mock` type: bun-types leaves
 * `Mocked`/`MockedObject` commented out, so a `vi.mock`-replaced import needs its own mapped type here or
 * every `.mockResolvedValueOnce`/`.mock.calls` read on it fails to type-check. `hoisted` is a plain
 * function call, since bun's `vi.mock`/`mock.module` already runs before the mocked specifier is
 * imported without vitest's separate hoisting pass. `advanceTimersByTimeAsync` advances then yields one
 * microtask tick, letting a promise callback a fired timer just resolved run before the next assertion —
 * bun's shim only has the synchronous form. `waitFor` polls `check` on a real macrotask tick up to
 * `timeout`ms, surfacing only the LAST assertion error after the deadline, matching vitest's contract.
 *
 * `restoreModuleAfterAll(specifier, importReal)` is the fallback for a `vi.mock` that can't instead
 * `vi.spyOn` per export: `vi.mock` replaces a module for the whole `bun test` process by RESOLVED PATH,
 * so every importer (even via a different relative path or `@/` alias) inherits whichever factory
 * registered last. `vi.spyOn` on the real module's namespace normally fixes this by patching one
 * property on the shared object, but it doesn't work when that object's OWN property-assignment traps
 * ignore it — an oRPC client `Proxy`, for one. This restores the real module in `afterAll`, dynamically
 * imported through a `?real`-suffixed specifier so the import bypasses this exact mock.
 *
 * `mockSdkModule(procedures)` is the one home for a `vi.mock('.../sdk', ...)` factory: every caller of
 * `sdk.<procedure>` stubs only the handful it calls, but the object literal is typed against the real
 * `sdk` client, so a procedure renamed or re-signatured on the widget contract fails each stub at
 * compile time instead of silently returning `undefined` at the call site.
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
      await new Promise(resolve => setTimeout(resolve, 10));
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
