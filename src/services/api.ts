import axios, { AxiosInstance } from 'axios';
import { 
  ApiResponse, 
  SendMessageRequest, 
  SendMessageResponse,
  MarketrixConfig 
} from '../types';

class MarketrixApiService {
  private api: AxiosInstance;
  private config: MarketrixConfig;

  constructor(config: MarketrixConfig) {
    this.config = config;
    
    // Initialize axios instance with base configuration
    this.api = axios.create({
      baseURL: 'https://api.marketrix.ai', // Replace with actual API base URL
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Marketrix-ID': config.marketrixId,
        'X-Marketrix-Key': config.marketrixKey,
      },
    });

    // Add request interceptor for authentication
    this.api.interceptors.request.use(
      (config) => {
        config.headers['X-Marketrix-ID'] = this.config.marketrixId;
        config.headers['X-Marketrix-Key'] = this.config.marketrixKey;
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('Marketrix API Error:', error);
        return Promise.reject(error);
      }
    );
  }

  async sendMessage(message: string, mode: 'show' | 'tell' | 'do'): Promise<SendMessageResponse> {
    try {
      const request: SendMessageRequest = {
        message,
        mode,
        marketrixId: this.config.marketrixId,
        marketrixKey: this.config.marketrixKey,
      };

      const response = await this.api.post<ApiResponse<SendMessageResponse>>(
        '/chat/send',
        request
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to send message');
      }

      return response.data.data!;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async checkAgentAvailability(): Promise<boolean> {
    try {
      const response = await this.api.get<ApiResponse<{ available: boolean }>>(
        '/agent/status'
      );

      if (!response.data.success) {
        return false;
      }

      return response.data.data?.available || false;
    } catch (error) {
      console.error('Error checking agent availability:', error);
      return false;
    }
  }

  async getAgentInfo(): Promise<{ name: string; avatarUrl: string } | null> {
    try {
      const response = await this.api.get<ApiResponse<{ name: string; avatarUrl: string }>>(
        '/agent/info'
      );

      if (!response.data.success) {
        return null;
      }

      return response.data.data || null;
    } catch (error) {
      console.error('Error getting agent info:', error);
      return null;
    }
  }

  // Method to update configuration
  updateConfig(newConfig: Partial<MarketrixConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update axios headers
    this.api.defaults.headers['X-Marketrix-ID'] = this.config.marketrixId;
    this.api.defaults.headers['X-Marketrix-Key'] = this.config.marketrixKey;
  }

  // Get current configuration
  getConfig(): MarketrixConfig {
    return { ...this.config };
  }
}

export default MarketrixApiService;
