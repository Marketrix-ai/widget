/**
 * The one home for turning an unknown throw into something a caller can read. `errorMessage` returns an
 * `Error`'s message, a thrown string as-is, and `fallback` for anything else — the fallback is a parameter
 * because a widget-init failure names itself on the host page while a tool failure has nothing better than
 * "Unknown error". `withCause` wraps a caller-facing message around a throw while retaining the original as
 * `cause`, so nothing that reports a failure swallows the one underneath it.
 *
 * `cause` is assigned rather than passed to the constructor because this package targets es2020, whose
 * `Error` signature has no options argument.
 */

export function errorMessage(error: unknown, fallback = 'Unknown error'): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : fallback;
}

export function withCause(message: string, cause: unknown): Error {
  return Object.assign(new Error(message), { cause });
}
