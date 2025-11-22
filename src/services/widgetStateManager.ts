/**
 * Widget State Manager
 *
 * Centralized state management for widget refs and state.
 * Consolidates chatId, activeMessage, restoration state, and widget state refs.
 */

import type { ChatMessage, WidgetState } from '../types';

class WidgetStateManager {
  private chatId: string | null = null;
  private activeMessage: ChatMessage | null = null;
  private isRestoring: boolean = false;
  private stateRef: WidgetState | null = null;

  /**
   * Get current chat ID
   */
  getChatId(): string | null {
    return this.chatId;
  }

  /**
   * Set chat ID
   */
  setChatId(chatId: string | null): void {
    this.chatId = chatId;
  }

  /**
   * Get active message
   */
  getActiveMessage(): ChatMessage | null {
    return this.activeMessage;
  }

  /**
   * Set active message
   */
  setActiveMessage(message: ChatMessage | null): void {
    this.activeMessage = message;
  }

  /**
   * Get restoration state
   */
  getIsRestoring(): boolean {
    return this.isRestoring;
  }

  /**
   * Set restoration state
   */
  setIsRestoring(isRestoring: boolean): void {
    this.isRestoring = isRestoring;
  }

  /**
   * Get state ref
   */
  getStateRef(): WidgetState | null {
    return this.stateRef;
  }

  /**
   * Set state ref
   */
  setStateRef(state: WidgetState | null): void {
    this.stateRef = state;
  }

  /**
   * Reset all state
   */
  reset(): void {
    this.chatId = null;
    this.activeMessage = null;
    this.isRestoring = false;
    this.stateRef = null;
  }
}

// Singleton instance
export const widgetStateManager = new WidgetStateManager();
