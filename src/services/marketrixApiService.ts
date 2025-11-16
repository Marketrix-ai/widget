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
        this.chatId = await this.initializeChatId();
      }

      // Map the mode to the appropriate chat endpoint
      const mode = request.mode || 'tell';

      // Validate chat_id after initialization
      if (!this.chatId) {
        throw new Error('Failed to initialize chat session. Please try again.');
      }

      // Support both marketrixId/marketrixKey and agentId/connectionId paths
      if (
        !(this.config.marketrixId && this.config.marketrixKey) &&
        (!this.config.agentId || !this.config.connectionId)
      ) {
        throw new Error(
          'Either marketrixId + marketrixKey or both agentId + connectionId are required'
        );
      }

      const chatId = this.chatId;

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

      if (this.config.marketrixId && this.config.marketrixKey) {
        // Use marketrixId + marketrixKey - API will validate credentials
        body.marketrix_id = this.config.marketrixId;
        body.marketrix_key = this.config.marketrixKey;
      } else if (this.config.agentId && this.config.connectionId) {
        // Use agentId and connectionId
        body.agent_id = this.config.agentId;
        body.connection_id = this.config.connectionId;
      }

      // Validate chatId exists
      if (!chatId || typeof chatId !== 'string' || chatId.trim() === '') {
        throw new Error('Invalid chat_id. Please ensure chat session is initialized.');
      }

      // Try to parse chat_id as number (API expects numeric chat_id in path)
      // If chat_id is a string like "chat_1234567890_abc123", extract numeric part or use as-is
      let chatIdNum: number;
      if (chatId.startsWith('chat_')) {
        // Extract numeric part from "chat_timestamp_nonce" format
        const numericPart = chatId.split('_')[1];
        chatIdNum = Number(numericPart);
        if (isNaN(chatIdNum) || chatIdNum <= 0) {
          // Fallback: try to parse the entire string as number (will fail but gives better error)
          chatIdNum = Number(chatId);
        }
      } else {
        chatIdNum = Number(chatId);
      }

      if (isNaN(chatIdNum) || chatIdNum <= 0) {
        console.error('[API Service] Invalid chat_id format:', chatId);
        throw new Error(`Invalid chat_id format: ${chatId}. Expected numeric chat_id.`);
      }

      let apiResponse;
      try {
        switch (mode) {
          case 'tell': {
            apiResponse = await sdk.chatTell({
              params: { chat_id: chatIdNum },
              body,
            });
            break;
          }
          case 'show': {
            apiResponse = await sdk.chatShow({
              params: { chat_id: chatIdNum },
              body,
            });
            break;
          }
          case 'do': {
            apiResponse = await sdk.chatDo({
              params: { chat_id: chatIdNum },
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
          chatId: chatIdNum,
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
          return {
            messageId: Date.now().toString(),
            response: 'Action completed successfully',
            mode,
            timestamp: new Date(),
          };
        } else {
          // chatTell and chatShow return ChatResponseData
          if (!isChatResponseData(responseData)) {
            console.error('[API Service] Invalid chat response data format:', responseData);
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

      // Log the actual response for debugging
      const errorBody =
        apiResponse.body && typeof apiResponse.body === 'object' && 'error' in apiResponse.body
          ? String(apiResponse.body.error)
          : 'Unknown error';
      console.error('[API Service] Failed to extract data from response:', {
        status: apiResponse.status,
        body: apiResponse.body,
        response: apiResponse,
      });
      throw new Error(
        `Failed to send message. API returned status ${apiResponse.status}. ${errorBody}`
      );
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
