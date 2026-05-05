/**
 * Chat ID Manager Service
 *
 * Centralized chat ID management with promise-based locking to prevent
 * concurrent chat ID creation. Ensures only one chat ID is created per session.
 */

import { sdk } from '../sdk';
import { createLogger } from '../utils/common';
import { chatService } from './ChatService';
import { storageService } from './StorageService';

const log = createLogger('SessionManager');

class SessionManager {
  private static instance: SessionManager | null = null;
  private chatId: string | null = null;
  private initializationPromise: Promise<string> | null = null;

  private constructor() {
    // Guard against SSR - only initialize in browser
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

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
    // Guard against SSR - return a dummy instance that won't be used
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      if (!SessionManager.instance) {
        // Create a minimal instance that won't access browser APIs
        SessionManager.instance = Object.create(SessionManager.prototype) as SessionManager;
        SessionManager.instance.chatId = null;
        SessionManager.instance.initializationPromise = null;
      }
      return SessionManager.instance;
    }

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
   * Create a new chat ID - oRPC returns data directly
   */
  private async createChatId(): Promise<string> {
    try {
      log.info('Creating new chat ID...');
      const chatId = await sdk.chatCreate(undefined);
      if (!chatId) {
        throw new Error('API returned empty chat ID');
      }

      this.chatId = chatId;
      this.storeChatId(chatId);
      log.info('Created and stored new chat ID:', this.chatId);

      chatService.createInitialContext(chatId);

      return chatId;
    } catch (error) {
      log.error('Failed to create chat ID:', error);
      // Clear the promise on error so retry is possible
      this.initializationPromise = null;
      throw error;
    }
  }

  private getStoredChatId(): string | null {
    return storageService.getChatId();
  }

  private storeChatId(id: string): void {
    storageService.setChatId(id);
  }
}

export const sessionManager = SessionManager.getInstance();
