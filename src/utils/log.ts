/**
 * The widget's warn-logging door. Severity is picked by what a record MEANS, per the root `CLAUDE.md`
 * Logging rule: a genuinely benign, already-handled condition (SSE retry, storage denial) is `logWarn`,
 * which takes only a message plus an optional cause and prints the cause's MESSAGE text via
 * `errorMessage`, never the raw `Error` object, because a customer's console must never see a trace for
 * a condition the widget already recovers from. An unexpected failure — where the stacktrace rule
 * applies — calls `console.error` directly (eslint's `no-console` allows `error` everywhere and `warn`
 * only in this file). `log`/`info`/`debug` have no equivalent here because terser's `drop_console`
 * strips them from the shipped bundle.
 */
import { errorMessage } from './errors';

export function logWarn(message: string, cause?: unknown): void {
  console.warn(cause === undefined ? message : `${message} ${errorMessage(cause)}`);
}
