import { sdk } from '../sdk';
import type { MarketrixConfig, SendMessageRequest, SendMessageResponse } from '../types';
import { extractErrorMessage } from '../utils/apiUtils';
import { sessionManager } from './SessionManager';

export class MarketrixApiService {
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
   * Get or create chat ID using centralized manager
   * This ensures only one chat ID is created even with concurrent calls
   */
  async getOrCreateChatId(): Promise<string> {
    return sessionManager.getOrCreateChatId();
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

      // Add connection_id or marketrix credentials to metadata for tenant lookup
      if (this.config.mtxApp) {
        metadata.connection_id = this.config.mtxApp;
      }
      if (this.config.mtxId && this.config.mtxKey) {
        metadata.marketrix_id = this.config.mtxId;
        metadata.marketrix_key = this.config.mtxKey;
      }

      // Log the question (fire and forget - don't block on this)
      sdk
        .logCreate({
          type: 'widget_question',
          metadata,
        })
        .catch(error => {
          // Silently fail - logging is not critical for widget functionality
          console.warn('[API Service] Failed to log widget question:', error);
        });
    } catch (error) {
      // Silently fail - logging is not critical
      console.warn('[API Service] Error logging widget question:', error);
    }
  }

  /**
   * Send a message to the Marketrix API
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    try {
      // Get or create chat ID using centralized manager
      const chatId = await sessionManager.getOrCreateChatId();

      // Map the mode to the appropriate chat endpoint
      const mode = request.mode || 'tell';

      // Log the question and mode to action_log
      if (request.message) {
        await this.logWidgetQuestion(request.message, mode);
      }

      // Validate chat_id after initialization
      if (!chatId) {
        throw new Error('Failed to initialize chat session. Please try again.');
      }

      // Support both mtxId/mtxKey and mtxApp/mtxAgent paths
      if (!(this.config.mtxId && this.config.mtxKey) && (!this.config.mtxApp || !this.config.mtxAgent)) {
        throw new Error('Either mtxId + mtxKey or both mtxApp + mtxAgent are required');
      }

      // Build request input with available identifiers
      const input: {
        marketrix_id?: string;
        marketrix_key?: string;
        agent_id?: number;
        connection_id?: number;
        chat_id: string;
        content: string;
      } = {
        chat_id: chatId,
        content: request.message || '',
      };

      if (this.config.mtxId && this.config.mtxKey) {
        // Use mtxId + mtxKey - API will validate credentials
        input.marketrix_id = this.config.mtxId;
        input.marketrix_key = this.config.mtxKey;
      } else if (this.config.mtxApp && this.config.mtxAgent) {
        // Use mtxApp and mtxAgent
        input.agent_id = this.config.mtxAgent;
        input.connection_id = this.config.mtxApp;
      }

      // Validate chatId exists
      if (!chatId || typeof chatId !== 'string' || chatId.trim() === '') {
        throw new Error('Invalid chat_id. Please ensure chat session is initialized.');
      }

      try {
        switch (mode) {
          case 'do': {
            await sdk.chatDo(input);
            return {
              messageId: Date.now().toString(),
              response: 'Action completed successfully',
              mode,
              timestamp: new Date(),
            };
          }
          case 'tell': {
            const tellResponse = await sdk.chatTell(input);
            return {
              messageId: Date.now().toString(),
              response: tellResponse.text || 'Response received',
              mode,
              timestamp: new Date(),
            };
          }
          case 'show': {
            const showResponse = await sdk.chatShow(input);
            return {
              messageId: Date.now().toString(),
              response: showResponse.text || 'Response received',
              mode,
              timestamp: new Date(),
            };
          }
          default: {
            const _exhaustiveCheck: never = mode;
            throw new Error(`Unsupported mode: ${String(_exhaustiveCheck)}`);
          }
        }
      } catch (sdkError) {
        const errorMessage = extractErrorMessage(sdkError);
        console.error('[API Service] SDK error:', {
          mode,
          chatId,
          error: sdkError,
          errorMessage,
        });
        throw new Error(`API request failed: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Failed to send message:', extractErrorMessage(error));
      throw error;
    }
  }

  /**
   * Check agent availability - simplified implementation
   * Since there's no dedicated endpoint, we'll assume agent is available
   * if we have a chat ID (does not create one if missing)
   */
  async checkAgentAvailability(): Promise<boolean> {
    try {
      // Just check if we have a chat ID, don't create one
      // This prevents unnecessary chat ID creation during availability checks
      const chatId = sessionManager.getChatId();
      return chatId !== null;
    } catch (error) {
      console.error('Failed to check agent availability:', error);
      return false;
    }
  }

  /**
   * Get agent information - simplified implementation
   * Since there's no dedicated endpoint, return basic info
   */
  async getAgentInfo(): Promise<{ available: boolean; status: string }> {
    return {
      available: true,
      status: 'online',
      // Add any other basic info that might be needed
    };
  }

  /**
   * Stop a running task
   */
  async stopTask(taskId?: string): Promise<{ status: string; message: string }> {
    try {
      // Get or create chat ID using centralized manager
      const chatId = await sessionManager.getOrCreateChatId();

      if (!chatId) {
        throw new Error('Failed to initialize chat session. Please try again.');
      }

      // Call the stop endpoint - oRPC returns { status: string, message: string }
      const responseData = await sdk.chatStop({
        chat_id: chatId,
        task_id: taskId,
      });

      return {
        status: responseData.status,
        message: responseData.message,
      };
    } catch (error) {
      console.error('Failed to stop task:', extractErrorMessage(error));
      throw error;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MarketrixConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export default MarketrixApiService;
