/**
 * The widget's warn-logging door: `logWarn` prints a message and its cause's text, never a trace, because
 * a customer's console must not see a stack for a condition the widget already recovers from.
 */
import { errorMessage } from './errors';

export function logWarn(message: string, cause?: unknown): void {
  console.warn(cause === undefined ? message : `${message} ${errorMessage(cause)}`);
}
