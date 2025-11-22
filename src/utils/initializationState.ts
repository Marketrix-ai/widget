/**
 * Initialization State Manager
 *
 * Centralized management of widget initialization state to prevent
 * race conditions and duplicate initialization attempts.
 */

import { createLogger } from './logger';

const log = createLogger('InitState');

class InitializationStateManager {
  private isInProgress: boolean = false;
  private isComplete: boolean = false;
  private chatId: string | null = null;
  private earlyRestorationDone: boolean = false;
  private hasAttemptedInitialization: boolean = false;

  /**
   * Check if initialization is currently in progress
   */
  getInProgress(): boolean {
    return this.isInProgress;
  }

  /**
   * Check if initialization has been attempted (even if it failed or is in progress)
   */
  hasAttempted(): boolean {
    return this.hasAttemptedInitialization;
  }

  /**
   * Mark initialization as in progress
   * Returns true if successfully marked, false if already in progress
   */
  markInProgress(): boolean {
    if (this.isInProgress) {
      // Silent check - don't log expected cases
      return false;
    }
    this.isInProgress = true;
    this.hasAttemptedInitialization = true;
    log.debug('Marked initialization as in progress');
    return true;
  }

  /**
   * Mark initialization as complete
   */
  markComplete(): void {
    this.isInProgress = false;
    this.isComplete = true;
    log.debug('Marked initialization as complete');
  }

  /**
   * Check if initialization is complete
   */
  getComplete(): boolean {
    return this.isComplete;
  }

  /**
   * Reset initialization state (for testing/reset purposes)
   */
  reset(): void {
    this.isInProgress = false;
    this.isComplete = false;
    this.chatId = null;
    this.earlyRestorationDone = false;
    this.hasAttemptedInitialization = false;
    log.debug('Reset initialization state');
  }

  /**
   * Get the initialized chat ID
   */
  getChatId(): string | null {
    return this.chatId;
  }

  /**
   * Set the initialized chat ID
   */
  setChatId(chatId: string): void {
    const changed = this.chatId !== chatId;
    this.chatId = chatId;
    if (changed) {
      log.debug('Set initialized chat ID:', chatId);
    }
  }

  /**
   * Check if early restoration has been done
   */
  getEarlyRestorationDone(): boolean {
    return this.earlyRestorationDone;
  }

  /**
   * Mark early restoration as done
   */
  markEarlyRestorationDone(): void {
    this.earlyRestorationDone = true;
    log.debug('Marked early restoration as done');
  }

  /**
   * Check if we should skip initialization (silent version - doesn't log)
   * Returns true if already initialized and connected or already in progress
   */
  shouldSkipInitializationSilent(
    getWebSocketChatId: () => string | null,
    isWebSocketConnected: () => boolean
  ): boolean {
    // If already initialized with the same chat_id and websocket is connected, skip
    if (
      this.isComplete &&
      this.chatId &&
      getWebSocketChatId() === this.chatId &&
      isWebSocketConnected()
    ) {
      return true;
    }

    // Prevent multiple simultaneous initializations
    if (this.isInProgress) {
      return true;
    }

    return false;
  }

  /**
   * Check if we should skip initialization
   * Returns true if already initialized and connected
   * Logs only on meaningful state transitions (not on every check)
   */
  shouldSkipInitialization(
    getWebSocketChatId: () => string | null,
    isWebSocketConnected: () => boolean
  ): boolean {
    return this.shouldSkipInitializationSilent(getWebSocketChatId, isWebSocketConnected);
  }
}

// Export singleton instance
export const initializationState = new InitializationStateManager();
export default InitializationStateManager;
