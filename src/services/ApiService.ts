import { sdk, type WidgetCommand } from '../sdk';
import type { MarketrixConfig, SendMessageRequest, SendMessageResponse } from '../types';
import { sessionManager } from './SessionManager';
import { StreamClient } from './StreamClient';

export class ApiService {
  private config: MarketrixConfig;

  constructor(config: MarketrixConfig) {
    this.config = config;
  }

  /**
   * Get the current chat ID (does not create if missing)
   */
  getChatId(): string | null {
    return sessionManager.getChatId();
  }

  /**
   * Get user_id from various sources (config, localStorage, sessionStorage)
   */
  private getUserId(): number | null {
    // Try to get from config first
    if (this.config.userId && typeof this.config.userId === 'number') {
      return this.config.userId;
    }

    // Try to get from localStorage
    try {
      const storedUserId = localStorage.getItem('marketrix_user_id');
      if (storedUserId) {
        const userId = Number(storedUserId);
        if (!isNaN(userId)) {
          return userId;
        }
      }
    } catch (error) {
      console.warn('[API Service] Failed to get user_id from localStorage:', error);
    }

    // Try to get from sessionStorage
    try {
      const sessionUserId = sessionStorage.getItem('marketrix_user_id');
      if (sessionUserId) {
        const userId = Number(sessionUserId);
        if (!isNaN(userId)) {
          return userId;
        }
      }
    } catch (error) {
      console.warn('[API Service] Failed to get user_id from sessionStorage:', error);
    }

    return null;
  }

  /**
   * Log widget question to action_log
   */
  async logWidgetQuestion(question: string, mode: string): Promise<void> {
    try {
      const userId = this.getUserId();

      const metadata: Record<string, unknown> = {
        question,
        mode,
        chat_id: this.getChatId(),
        timestamp: new Date().toISOString(),
      };

      // Add user_id if available
      if (userId !== null) {
        metadata.user_id = userId;
      }

      // Add application_id or marketrix credentials to metadata for workspace lookup
      if (this.config.mtxApp) {
        metadata.application_id = this.config.mtxApp;
      }
      if (this.config.mtxId && this.config.mtxKey) {
        metadata.marketrix_id = this.config.mtxId;
        metadata.marketrix_key = this.config.mtxKey;
      }

      // Log the question (fire and forget - don't block on this)
      sdk
        .activityLogCreate({
          type: 'widget_question',
          metadata,
        })
        .catch((error: unknown) => {
          // Silently fail - logging is not critical for widget functionality
          console.warn('[API Service] Failed to log widget question:', error);
        });
    } catch (error) {
      // Silently fail - logging is not critical
      console.warn('[API Service] Error logging widget question:', error);
    }
  }

  /**
   * Send a message via the typed stream (fire-and-forget).
   * The actual response arrives asynchronously as a chat/response stream event.
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    const chatId = await sessionManager.getOrCreateChatId();
    if (!chatId) throw new Error('Failed to initialize chat session');

    const mode = request.mode || 'tell';

    // Log the question and mode to action_log
    if (request.message) {
      await this.logWidgetQuestion(request.message, mode);
    }

    // Auth validation still needed
    if (!(this.config.mtxId && this.config.mtxKey) && (!this.config.mtxApp || !this.config.mtxAgent)) {
      throw new Error('Either mtxId + mtxKey or both mtxApp + mtxAgent are required');
    }

    const requestId = request.requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const command: WidgetCommand = {
      type: `chat/${mode}` as 'chat/tell' | 'chat/show' | 'chat/do',
      request_id: requestId,
      content: request.message || '',
    };

    // Send command via stream (fire-and-forget — response arrives as chat/response event)
    const wsClient = StreamClient.getInstance();
    wsClient.send(command);

    // Return immediately — the actual response text will come via stream
    return {
      messageId: requestId,
      response: '', // Will be populated by chat/response stream event
      mode,
      timestamp: new Date(),
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MarketrixConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export default ApiService;
