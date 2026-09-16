/**
 * The widget's one console-logging door. Severity is picked by what a record MEANS, per the root
 * `CLAUDE.md` Logging rule: a genuinely benign, already-handled condition (SSE retry, storage denial) is
 * `logWarn`, and attaching a stacktrace is what promotes a record to error — so `logWarn` takes only a
 * message plus an optional cause and prints the cause's MESSAGE text via `errorMessage`, never the raw
 * `Error` object, because a customer's console must never see a trace for a condition the widget already
 * recovers from. `logError` is for the unexpected failures the stacktrace rule is reserved for, so it logs
 * the cause whole. Funnelling every call site through these two keeps that classification from drifting
 * warn-by-warn; `log`/`info`/`debug` have no equivalent here because terser's `drop_console` strips them
 * from the shipped bundle (see `ErrorBoundary`'s header), so only warn/error ever reach a host page.
 */
import { errorMessage } from './errors';

export function logWarn(message: string, cause?: unknown): void {
  console.warn(cause === undefined ? message : `${message} ${errorMessage(cause)}`);
}

export function logError(message: string, cause?: unknown): void {
  console.error(message, cause);
}
