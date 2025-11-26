/**
 * Chat ID Manager Service
 *
 * Centralized chat ID management with promise-based locking to prevent
 * concurrent chat ID creation. Ensures only one chat ID is created per session.
 */

import { sdk } from '../sdk';
import { extractApiData } from '../utils/apiUtils';
import { createLogger } from '../utils/common';
import { chatService } from './ChatService';

const log = createLogger('ChatIdManager');
const CHAT_ID_STORAGE_KEY = 'marketrix_chat_id';

class SessionManager {
  private static instance: SessionManager | null = null;
  private chatId: string | null = null;
  private initializationPromise: Promise<string> | null = null;

  private constructor() {
    // Load existing chat ID from storage
    this.chatId = this.getStoredChatId();
    if (this.chatId) {
      log.debug('Loaded existing chat ID from storage:', this.chatId);
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Get current chat ID without creating a new one
   */
  getChatId(): string | null {
    return this.chatId;
  }

  /**
   * Get or create chat ID with promise-based locking
   * If multiple calls happen concurrently, they all wait for the same promise
   */
  async getOrCreateChatId(): Promise<string> {
    // If we already have a chat ID, return it immediately
    if (this.chatId) {
      log.debug('Returning existing chat ID:', this.chatId);
      return this.chatId;
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      log.debug('Chat ID initialization in progress, waiting...');
      return this.initializationPromise;
    }

    // Check storage one more time (in case it was set by another instance)
    const storedChatId = this.getStoredChatId();
    if (storedChatId) {
      this.chatId = storedChatId;
      log.debug('Found chat ID in storage:', this.chatId);
      return this.chatId;
    }

    // Create new chat ID with promise-based locking
    this.initializationPromise = this.createChatId();

    try {
      const newChatId = await this.initializationPromise;
      return newChatId;
    } finally {
      // Clear the promise after completion
      this.initializationPromise = null;
    }
  }

  /**
   * Create a new chat ID
   */
  private async createChatId(): Promise<string> {
    try {
      log.info('Creating new chat ID...');
      const chatResponse = await sdk.chatCreate({ body: undefined });
      const chatIdData = extractApiData(chatResponse);

      if (chatIdData && typeof chatIdData === 'string') {
        this.chatId = chatIdData;
        this.storeChatId(this.chatId);
        log.info('Created and stored new chat ID:', this.chatId);

        chatService.createInitialContext(this.chatId);

        return this.chatId;
      } else {
        throw new Error('Failed to create chat session: invalid response');
      }
    } catch (error) {
      log.error('Failed to create chat ID:', error);
      // Clear the promise on error so retry is possible
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Clear the current chat ID (for testing/reset purposes)
   */
  clearChatId(): void {
    this.chatId = null;
    this.initializationPromise = null;
    log.debug('Cleared chat ID');
  }

  /**
   * Reset the singleton instance (for testing purposes)
   */
  static resetInstance(): void {
    SessionManager.instance = null;
  }

  private getStoredChatId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(CHAT_ID_STORAGE_KEY);
  }

  private storeChatId(id: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CHAT_ID_STORAGE_KEY, id);
  }
}

export const sessionManager = SessionManager.getInstance();
