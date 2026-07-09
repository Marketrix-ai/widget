import { sdk, type WidgetCommand } from '../sdk';
import type { MarketrixConfig, MessageDispatchRequest, MessageDispatchResponse } from '../types';
import { chatSessionManager } from './ChatSessionManager';
import { StreamClient } from './StreamClient';

export class ApiService {
  private config: MarketrixConfig;

  constructor(config: MarketrixConfig) {
    this.config = config;
  }

  getChatId(): string | null {
    return chatSessionManager.getChatId();
  }

  /** Resolves user_id from config, then localStorage, then sessionStorage. */
  private getUserId(): number | null {
    if (this.config.userId && typeof this.config.userId === 'number') {
      return this.config.userId;
    }

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

  async logWidgetQuestion(question: string, mode: string): Promise<void> {
    try {
      const userId = this.getUserId();

      const metadata: Record<string, unknown> = {
        question,
        mode,
        chat_id: this.getChatId(),
        timestamp: new Date().toISOString(),
      };

      if (userId !== null) {
        metadata.user_id = userId;
      }

      if (this.config.mtxApp) {
        metadata.application_id = this.config.mtxApp;
      }
      if (this.config.mtxId && this.config.mtxKey) {
        metadata.marketrix_id = this.config.mtxId;
        metadata.marketrix_key = this.config.mtxKey;
      }

      sdk
        .activityLogCreate({
          type: 'widget_question',
          metadata,
        })
        .catch((error: unknown) => {
          // Best-effort: logging isn't critical to widget function.
          console.warn('[API Service] Failed to log widget question:', error);
        });
    } catch (error) {
      console.warn('[API Service] Error logging widget question:', error);
    }
  }

  /** Fire-and-forget send over the typed stream; the reply arrives asynchronously as a chat/response event. */
  async messageDispatch(request: MessageDispatchRequest): Promise<MessageDispatchResponse> {
    const chatId = await chatSessionManager.getOrCreateChatId();
    if (!chatId) throw new Error('Failed to initialize chat session');

    const mode = request.mode || 'tell';

    if (request.message) {
      await this.logWidgetQuestion(request.message, mode);
    }

    if (!(this.config.mtxId && this.config.mtxKey) && !this.config.mtxApp) {
      throw new Error('Either mtxId + mtxKey or mtxApp is required');
    }

    const requestId = request.requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const command: WidgetCommand = {
      type: `chat/${mode}` as 'chat/tell' | 'chat/show' | 'chat/do',
      request_id: requestId,
      content: request.message || '',
    };

    const wsClient = StreamClient.getInstance();
    wsClient.send(command);

    return {
      messageId: requestId,
      response: '', // populated later by the chat/response stream event
      mode,
      timestamp: new Date(),
    };
  }

  updateConfig(newConfig: Partial<MarketrixConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
