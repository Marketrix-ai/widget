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

const log = createLogger('ChatIdManager');
const TAB_ID_STORAGE_KEY = 'marketrix_tab_id';

class SessionManager {
  private static instance: SessionManager | null = null;
  private chatId: string | null = null;
  private tabId: string | null = null;
  private initializationPromise: Promise<string> | null = null;

  private constructor() {
    // Guard against SSR - only initialize in browser
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    // Initialize tab ID (persists across same-tab navigations via sessionStorage)
    this.tabId = this.getOrCreateTabId();
    log.debug('Tab ID:', this.tabId);

    // Load existing chat ID from storage
    this.chatId = this.getStoredChatId();
    if (this.chatId) {
      log.debug('Loaded existing chat ID from storage:', this.chatId);
    }

    // Setup link click interceptor for cross-domain tab_id propagation
    this.setupLinkInterceptor();
  }

  /**
   * Intercept link clicks to append tab_id for cross-domain navigation.
   * This ensures the same tab_id is preserved when navigating to external domains.
   */
  private setupLinkInterceptor(): void {
    // Guard against SSR
    if (typeof document === 'undefined') {
      return;
    }

    document.addEventListener(
      'click',
      event => {
        const target = event.target as HTMLElement;
        const anchor = target.closest('a') as HTMLAnchorElement | null;

        if (!anchor?.href) return;

        // Skip if it's the same origin (sessionStorage will handle it)
        try {
          const linkUrl = new URL(anchor.href, window.location.origin);
          const currentOrigin = window.location.origin;

          // Only intercept cross-origin links
          if (linkUrl.origin === currentOrigin) return;

          // Skip non-http(s) links
          if (!linkUrl.protocol.startsWith('http')) return;

          // Skip links that open in new tab/window
          if (anchor.target === '_blank') return;

          // Append tab_id to the URL
          if (this.tabId && !linkUrl.searchParams.has('_mktx_tab')) {
            linkUrl.searchParams.set('_mktx_tab', this.tabId);
            anchor.href = linkUrl.toString();
            log.debug('Added tab_id to cross-domain link:', anchor.href);
          }
        } catch {
          // Invalid URL, skip
        }
      },
      true,
    ); // Use capture phase to intercept before navigation
  }

  /**
   * Get or create a tab ID that persists across same-tab navigations.
   * Priority:
   * 1. URL parameter (_mktx_tab) - for cross-domain navigation
   * 2. sessionStorage - for same-origin navigation
   * 3. Generate new - for new tabs
   */
  private getOrCreateTabId(): string {
    // Guard against SSR
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
      return this.generateTabId();
    }

    // 1. Check URL for tab_id parameter (cross-domain navigation)
    const urlParams = new URLSearchParams(window.location.search);
    const urlTabId = urlParams.get('_mktx_tab');
    if (urlTabId) {
      // Store in sessionStorage for future same-origin navigations
      sessionStorage.setItem(TAB_ID_STORAGE_KEY, urlTabId);
      log.info('Restored tab ID from URL:', urlTabId);
      // Clean up URL (remove the parameter)
      this.cleanupTabIdFromUrl();
      return urlTabId;
    }

    // 2. Try to get existing tab ID from sessionStorage
    let tabId = sessionStorage.getItem(TAB_ID_STORAGE_KEY);

    if (!tabId) {
      // 3. Generate a new tab ID
      tabId = this.generateTabId();
      sessionStorage.setItem(TAB_ID_STORAGE_KEY, tabId);
      log.info('Created new tab ID:', tabId);
    }

    return tabId;
  }

  /**
   * Remove _mktx_tab parameter from URL without page reload
   */
  private cleanupTabIdFromUrl(): void {
    // Guard against SSR
    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);
    if (url.searchParams.has('_mktx_tab')) {
      url.searchParams.delete('_mktx_tab');
      // Replace URL without reload
      window.history.replaceState({}, '', url.toString());
    }
  }

  /**
   * Generate a unique tab ID
   */
  private generateTabId(): string {
    return `tab_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Get the current tab ID
   */
  getTabId(): string | null {
    return this.tabId;
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
        SessionManager.instance.tabId = null;
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

      this.chatId = chatId;
      this.storeChatId(this.chatId);
      log.info('Created and stored new chat ID:', this.chatId);

      chatService.createInitialContext(this.chatId);

      return this.chatId;
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
    return storageService.getChatId();
  }

  private storeChatId(id: string): void {
    storageService.setChatId(id);
  }
}

export const sessionManager = SessionManager.getInstance();
