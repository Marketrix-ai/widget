import { sdk } from '../sdk';
import type { MarketrixConfig, SendMessageRequest, SendMessageResponse } from '../types';
import { extractApiData, extractErrorMessage } from '../utils/apiUtils';
import { isChatResponseData, isNonNullObject } from '../utils/validation';
import { sessionManager } from './SessionManager';

interface TaskResponse {
  task_id?: string;
  status?: string;
  message?: string;
}

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
          body: {
            type: 'widget_question',
            metadata,
          },
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

      // Build request body with available identifiers
      const body: {
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
        body.marketrix_id = this.config.mtxId;
        body.marketrix_key = this.config.mtxKey;
      } else if (this.config.mtxApp && this.config.mtxAgent) {
        // Use mtxApp and mtxAgent
        body.agent_id = this.config.mtxAgent;
        body.connection_id = this.config.mtxApp;
      }

      // Validate chatId exists
      if (!chatId || typeof chatId !== 'string' || chatId.trim() === '') {
        throw new Error('Invalid chat_id. Please ensure chat session is initialized.');
      }

      let apiResponse;
      try {
        switch (mode) {
          case 'tell': {
            apiResponse = await sdk.chatTell({
              params: { chat_id: chatId },
              body,
            });
            break;
          }
          case 'show': {
            apiResponse = await sdk.chatShow({
              params: { chat_id: chatId },
              body,
            });
            break;
          }
          case 'do': {
            apiResponse = await sdk.chatDo({
              params: { chat_id: chatId },
              body,
            });
            break;
          }
          default: {
            // This should never happen due to TypeScript's exhaustive checking
            const _exhaustiveCheck: never = mode;
            throw new Error(`Unsupported mode: ${String(_exhaustiveCheck)}`);
          }
        }
      } catch (sdkError) {
        // SDK throws errors for failed requests - rethrow with better context
        const errorMessage = extractErrorMessage(sdkError);
        console.error('[API Service] SDK error:', {
          mode,
          chatId,
          error: sdkError,
          errorMessage,
        });
        throw new Error(`API request failed: ${errorMessage}`);
      }

      const responseData = extractApiData(apiResponse);
      if (responseData) {
        // Map the response to our expected format
        if (mode === 'do') {
          // chatDo returns UsageStatsData, not ChatResponseData
          // But we also get task_id for show/do modes
          const result: SendMessageResponse = {
            messageId: Date.now().toString(),
            response: 'Action completed successfully',
            mode,
            timestamp: new Date(),
          };

          if (isNonNullObject(responseData) && typeof responseData.task_id === 'string') {
            result.task_id = responseData.task_id;
          }

          return result;
        } else {
          // chatTell and chatShow return ChatResponseData
          if (!isChatResponseData(responseData)) {
            console.error('[API Service] Invalid chat response data format:', responseData);
            throw new Error('Invalid chat response data format');
          }

          const chatResponse = responseData;
          // Fix for missing property access by type checking or casting
          const responseText = chatResponse.text || 'Response received';

          const result: SendMessageResponse = {
            messageId: Date.now().toString(),
            response: responseText,
            mode,
            timestamp: new Date(),
          };
          // Include task_id if available (for show mode)
          // We need to check if responseData has task_id property (it might if it's a union type)
          // Or we can cast to TaskResponse
          const taskResponse = responseData as unknown as TaskResponse;
          if (taskResponse.task_id) {
            result.task_id = taskResponse.task_id;
          }
          return result;
        }
      }

      // Log the actual response for debugging
      const errorBody =
        apiResponse.body &&
        typeof apiResponse.body === 'object' &&
        apiResponse.body !== null &&
        'error' in apiResponse.body
          ? String(apiResponse.body.error)
          : JSON.stringify(apiResponse.body || 'Unknown error');
      console.error('[API Service] Failed to extract data from response:', {
        status: apiResponse.status,
        body: apiResponse.body,
        response: apiResponse,
      });
      throw new Error(`Failed to send message. API returned status ${apiResponse.status}. ${errorBody}`);
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

      // Call the stop endpoint
      const apiResponse = await sdk.chatStop({
        params: { chat_id: chatId },
        body: {
          task_id: taskId,
        },
      });

      const responseData = extractApiData(apiResponse);
      if (responseData && typeof responseData === 'object' && 'status' in responseData) {
        const data = responseData as { status: unknown; message?: unknown };
        return {
          status: String(data.status),
          message: String(data.message || 'Task stopped'),
        };
      }

      throw new Error('Invalid response from stop endpoint');
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
