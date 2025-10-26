import { type ChatResponseData, sdk } from '../sdk';
import type { MarketrixConfig, SendMessageRequest, SendMessageResponse } from '../types';

class MarketrixApiService {
  private config: MarketrixConfig;
  private chatId: string | null = null;

  constructor(config: MarketrixConfig) {
    this.config = config;
  }

  /**
   * Send a message to the Marketrix API
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    try {
      // Create a chat if we don't have one
      if (!this.chatId) {
        const chatResponse = await sdk.chatCreate({ body: undefined });
        if (chatResponse.status === 200 && chatResponse.body?.success && chatResponse.body.data) {
          this.chatId = chatResponse.body.data;
        } else {
          throw new Error('Failed to create chat session');
        }
      }

      // Map the mode to the appropriate chat endpoint
      const mode = request.mode || 'tell';
      let response;

      switch (mode) {
        case 'tell':
          response = await sdk.chatTell({
            params: { chat_id: Number(this.chatId) },
            body: {
              integration_id: this.config.marketrixId,
              chat_id: this.chatId,
              content: request.message || '',
            },
          });
          break;
        case 'show':
          response = await sdk.chatShow({
            params: { chat_id: Number(this.chatId) },
            body: {
              integration_id: this.config.marketrixId,
              chat_id: this.chatId,
              content: request.message || '',
            },
          });
          break;
        case 'do':
          response = await sdk.chatDo({
            params: { chat_id: this.chatId },
            body: {
              integration_id: this.config.marketrixId,
              chat_id: this.chatId,
              content: request.message || '',
            },
          });
          break;
        default: {
          // This should never happen due to TypeScript's exhaustive checking
          const _exhaustiveCheck: never = mode;
          throw new Error(`Unsupported mode: ${String(_exhaustiveCheck)}`);
        }
      }

      if (response.status === 200 && response.body?.success && response.body.data) {
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
          const chatResponse = response.body.data as ChatResponseData;
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
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Check agent availability - simplified implementation
   * Since there's no dedicated endpoint, we'll assume agent is available
   * if we can successfully create a chat
   */
  async checkAgentAvailability(): Promise<boolean> {
    try {
      // Try to create a chat to test availability
      const response = await sdk.chatCreate({ body: undefined });
      return response.status === 200 && response.body?.success === true;
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
