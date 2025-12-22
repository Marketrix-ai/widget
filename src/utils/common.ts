/**
 * Logger Utility
 *
 * Centralized logging utility with log levels and environment-based filtering.
 * Only logs in development mode to reduce noise in production.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Check if we're in development mode
const isDevelopment =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.includes('localhost');

/**
 * Log levels configuration
 * Set to 'error' in production to only show errors
 */
const MIN_LOG_LEVEL: LogLevel = isDevelopment ? 'debug' : 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Check if a log level should be displayed
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LOG_LEVEL];
}

/**
 * Format log message with prefix
 */
function formatMessage(
  prefix: string,
  message: string,
  ...args: unknown[]
): [string, ...unknown[]] {
  return [`[${prefix}] ${message}`, ...args];
}

/**
 * Logger interface
 */
export const logger = {
  /**
   * Debug logs - detailed information for debugging
   */
  debug: (prefix: string, message: string, ...args: unknown[]): void => {
    if (shouldLog('debug')) {
      console.debug(...formatMessage(prefix, message, ...args));
    }
  },

  /**
   * Info logs - general information about application flow
   */
  info: (prefix: string, message: string, ...args: unknown[]): void => {
    if (shouldLog('info')) {
      console.info(...formatMessage(prefix, message, ...args));
    }
  },

  /**
   * Warning logs - potential issues that don't break functionality
   */
  warn: (prefix: string, message: string, ...args: unknown[]): void => {
    if (shouldLog('warn')) {
      console.warn(...formatMessage(prefix, message, ...args));
    }
  },

  /**
   * Error logs - errors that need attention
   */
  error: (prefix: string, message: string, ...args: unknown[]): void => {
    if (shouldLog('error')) {
      console.error(...formatMessage(prefix, message, ...args));
    }
  },
};

/**
 * Create a scoped logger with a fixed prefix
 */
export function createLogger(prefix: string) {
  return {
    debug: (message: string, ...args: unknown[]) => logger.debug(prefix, message, ...args),
    info: (message: string, ...args: unknown[]) => logger.info(prefix, message, ...args),
    warn: (message: string, ...args: unknown[]) => logger.warn(prefix, message, ...args),
    error: (message: string, ...args: unknown[]) => logger.error(prefix, message, ...args),
  };
}
/**
 * Error Handling Utilities
 *
 * Centralized error handling and logging utilities to reduce code duplication
 * and ensure consistent error handling patterns across the widget.
 */

import { extractErrorMessage } from './apiUtils';

const log = createLogger('ErrorUtils');

/**
 * Execute a function safely with error handling
 * Returns the result or undefined if an error occurs
 */
export function safeExecute<T>(fn: () => T, errorMessage: string, defaultValue?: T): T | undefined {
  try {
    return fn();
  } catch (error) {
    logError('safeExecute', error, { errorMessage, defaultValue });
    return defaultValue;
  }
}

/**
 * Execute an async function safely with error handling
 * Returns the result or undefined if an error occurs
 */
export async function safeExecuteAsync<T>(
  fn: () => Promise<T>,
  errorMessage: string,
  defaultValue?: T
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    logError('safeExecuteAsync', error, { errorMessage, defaultValue });
    return defaultValue;
  }
}

/**
 * Centralized error logging
 */
export function logError(
  context: string,
  error: unknown,
  additionalInfo?: Record<string, unknown>
): void {
  const errorMessage = extractErrorMessage(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  log.error(`${context}: ${errorMessage}`, {
    ...additionalInfo,
    stack: errorStack,
  });
}

/**
 * Centralized warning logging
 */
export function logWarning(
  context: string,
  message: string,
  additionalInfo?: Record<string, unknown>
): void {
  log.warn(`${context}: ${message}`, additionalInfo || {});
}
