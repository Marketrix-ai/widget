import { API_URL_GLOBAL_SET } from '../config';
import type {
  ApiResponse,
  MarketrixConfig,
  SendMessageRequest,
  SendMessageResponse,
} from '../types';
import { HttpClient } from './base';

class MarketrixApiService extends HttpClient {
  private config: MarketrixConfig;

  constructor(config: MarketrixConfig) {
    super({
      baseURL: API_URL_GLOBAL_SET.API_END_POINT,
      timeout: 30000,
      headers: {
        'X-Marketrix-ID': config.marketrixId,
        'X-Marketrix-Key': config.marketrixKey,
      },
    });

    this.config = config;
  }

  /**
   * Send a message to the Marketrix API
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    try {
      const response = await this.post<ApiResponse<SendMessageResponse>>('/message/send', request);

      if (response.success && response.data) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to send message');
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(conversationId: string): Promise<any[]> {
    try {
      const response = await this.get<ApiResponse<any[]>>(
        `/conversation/${conversationId}/history`
      );

      if (response.success && response.data) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to get conversation history');
    } catch (error) {
      console.error('Failed to get conversation history:', error);
      throw error;
    }
  }

  /**
   * Get agent status
   */
  async getAgentStatus(): Promise<{ online: boolean; available: boolean }> {
    try {
      const response =
        await this.get<ApiResponse<{ online: boolean; available: boolean }>>('/agent/status');

      if (response.success && response.data) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to get agent status');
    } catch (error) {
      console.error('Failed to get agent status:', error);
      throw error;
    }
  }

  /**
   * Start a new conversation
   */
  async startConversation(): Promise<{ conversationId: string }> {
    try {
      const response = await this.post<ApiResponse<{ conversationId: string }>>(
        '/conversation/start',
        {}
      );

      if (response.success && response.data) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to start conversation');
    } catch (error) {
      console.error('Failed to start conversation:', error);
      throw error;
    }
  }

  /**
   * End a conversation
   */
  async endConversation(conversationId: string): Promise<void> {
    try {
      const response = await this.post<ApiResponse<void>>(
        `/conversation/${conversationId}/end`,
        {}
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to end conversation');
      }
    } catch (error) {
      console.error('Failed to end conversation:', error);
      throw error;
    }
  }

  /**
   * Upload file
   */
  async uploadFile(file: File, conversationId: string): Promise<{ fileId: string; url: string }> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('conversationId', conversationId);

      const response = await this.post<ApiResponse<{ fileId: string; url: string }>>(
        '/file/upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.success && response.data) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to upload file');
    } catch (error) {
      console.error('Failed to upload file:', error);
      throw error;
    }
  }

  /**
   * Get widget configuration
   */
  async getWidgetConfig(): Promise<any> {
    try {
      const response = await this.get<ApiResponse<any>>('/widget/config');

      if (response.success && response.data) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to get widget config');
    } catch (error) {
      console.error('Failed to get widget config:', error);
      throw error;
    }
  }

  /**
   * Update widget configuration
   */
  async updateWidgetConfig(config: any): Promise<void> {
    try {
      const response = await this.put<ApiResponse<void>>('/widget/config', config);

      if (!response.success) {
        throw new Error(response.error || 'Failed to update widget config');
      }
    } catch (error) {
      console.error('Failed to update widget config:', error);
      throw error;
    }
  }

  /**
   * Check agent availability
   */
  async checkAgentAvailability(): Promise<boolean> {
    try {
      const response = await this.get<ApiResponse<{ available: boolean }>>('/agent/availability');
      return response.success && response.data?.available === true;
    } catch (error) {
      console.error('Failed to check agent availability:', error);
      return false;
    }
  }

  /**
   * Get agent information
   */
  async getAgentInfo(): Promise<any> {
    try {
      const response = await this.get<ApiResponse<any>>('/agent/info');
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to get agent info');
    } catch (error) {
      console.error('Failed to get agent info:', error);
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
