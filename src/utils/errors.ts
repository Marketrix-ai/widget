/**
 * The one home for turning an unknown throw into something a caller can read. `errorMessage` returns an
 * `Error`'s message, a thrown string as-is, and `fallback` for anything else — the fallback is a parameter
 * because a widget-init failure names itself on the host page while a tool failure has nothing better than
 * "Unknown error".
 */

export function errorMessage(error: unknown, fallback = 'Unknown error'): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : fallback;
}
