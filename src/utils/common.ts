/**
 * Logger Utility
 *
 * Centralized logging utility with log levels and environment-based filtering.
 * Only logs in development mode to reduce noise in production.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Check if we're in development mode (SSR-safe)
const getIsDevelopment = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('localhost')
  );
};

/**
 * Log levels configuration
 * Set to 'error' in production to only show errors
 */
const MIN_LOG_LEVEL: LogLevel = getIsDevelopment() ? 'debug' : 'error';

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
function formatMessage(prefix: string, message: string, ...args: unknown[]): [string, ...unknown[]] {
  return [`[${prefix}] ${message}`, ...args];
}

/**
 * Create a scoped logger with a fixed prefix
 */
export function createLogger(prefix: string) {
  return {
    debug: (message: string, ...args: unknown[]) => {
      if (shouldLog('debug')) {
        console.debug(...formatMessage(prefix, message, ...args));
      }
    },
    info: (message: string, ...args: unknown[]) => {
      if (shouldLog('info')) {
        console.info(...formatMessage(prefix, message, ...args));
      }
    },
    warn: (message: string, ...args: unknown[]) => {
      if (shouldLog('warn')) {
        console.warn(...formatMessage(prefix, message, ...args));
      }
    },
    error: (message: string, ...args: unknown[]) => {
      if (shouldLog('error')) {
        console.error(...formatMessage(prefix, message, ...args));
      }
    },
  };
}
