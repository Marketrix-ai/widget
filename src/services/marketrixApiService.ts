import { sdk } from '../sdk';
import type { MarketrixConfig, SendMessageRequest, SendMessageResponse } from '../types';
import { extractApiData, extractErrorMessage } from '../utils/apiUtils';
import { getStoredChatId, storeChatId } from '../utils/chatStorage';
import { isChatResponseData } from '../utils/typeGuards';

export class MarketrixApiService {
  private config: MarketrixConfig;
  private chatId: string | null = null;

  constructor(config: MarketrixConfig) {
    this.config = config;
    // Load chat_id from storage on initialization
    this.chatId = getStoredChatId();
  }

  /**
   * Get the current chat ID
   */
  getChatId(): string | null {
    return this.chatId;
  }

  /**
   * Initialize chat_id by creating a new chat session
   * This should be called when the widget first loads
   */
  async initializeChatId(): Promise<string> {
    // If we already have a chat_id, return it
    if (this.chatId) {
      return this.chatId;
    }

    // Try to get from storage first
    const storedChatId = getStoredChatId();
    if (storedChatId) {
      this.chatId = storedChatId;
      return this.chatId;
    }

    // Create a new chat session
    try {
      const chatResponse = await sdk.chatCreate({ body: undefined });
      const chatIdData = extractApiData(chatResponse);
      if (chatIdData && typeof chatIdData === 'string') {
        this.chatId = chatIdData;
        // Store in localStorage for persistence
        storeChatId(this.chatId);
        console.log('[API Service] Created and stored chat_id:', this.chatId);
        return this.chatId;
      } else {
        throw new Error('Failed to create chat session');
      }
    } catch (error) {
      console.error('[API Service] Failed to initialize chat_id:', error);
      throw error;
    }
  }

  /**
   * Send a message to the Marketrix API
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    try {
      // Ensure chat_id is initialized (should already be done on widget load)
      if (!this.chatId) {
        await this.initializeChatId();
      }

      // Map the mode to the appropriate chat endpoint
      const mode = request.mode || 'tell';
      let response;

      if (!this.config.marketrixId) {
        throw new Error('marketrixId is required');
      }
      if (!this.chatId) {
        throw new Error('chatId is required');
      }

      const integrationId = this.config.marketrixId;
      const chatId = this.chatId;

      switch (mode) {
        case 'tell': {
          const body: {
            integration_id: string;
            chat_id: string;
            content: string;
          } = {
            integration_id: integrationId,
            chat_id: chatId,
            content: request.message || '',
          };
          response = await sdk.chatTell({
            params: { chat_id: Number(chatId) },
            body,
          });
          break;
        }
        case 'show': {
          const body: {
            integration_id: string;
            chat_id: string;
            content: string;
          } = {
            integration_id: integrationId,
            chat_id: chatId,
            content: request.message || '',
          };
          response = await sdk.chatShow({
            params: { chat_id: Number(chatId) },
            body,
          });
          break;
        }
        case 'do': {
          const body: {
            integration_id: string;
            chat_id: string;
            content: string;
          } = {
            integration_id: integrationId,
            chat_id: chatId,
            content: request.message || '',
          };
          response = await sdk.chatDo({
            params: { chat_id: Number(chatId) },
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

      const responseData = extractApiData(response);
      if (responseData) {
        // Map the response to our expected format
        if (mode === 'do') {
          // chatDo returns UsageStatsData, not ChatResponseData
          return {
            messageId: Date.now().toString(),
            response: 'Action completed successfully',
            mode,
            timestamp: new Date(),
          };
        } else {
          // chatTell and chatShow return ChatResponseData
          if (!isChatResponseData(responseData)) {
            throw new Error('Invalid chat response data format');
          }

          const chatResponse = responseData;
          return {
            messageId: Date.now().toString(),
            response: chatResponse.text || 'Response received',
            mode,
            timestamp: new Date(),
          };
        }
      }

      throw new Error('Failed to send message');
    } catch (error) {
      console.error('Failed to send message:', extractErrorMessage(error));
      throw error;
    }
  }

  /**
   * Check agent availability - simplified implementation
   * Since there's no dedicated endpoint, we'll assume agent is available
   * if we can successfully initialize chat_id
   */
  async checkAgentAvailability(): Promise<boolean> {
    try {
      // Try to initialize chat_id to test availability
      await this.initializeChatId();
      return true;
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
   * Update configuration
   */
  updateConfig(newConfig: Partial<MarketrixConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export default MarketrixApiService;
