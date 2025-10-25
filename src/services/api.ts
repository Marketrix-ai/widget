import axios, { type AxiosInstance } from 'axios';

import type {
  ApiResponse,
  MarketrixConfig,
  SendMessageRequest,
  SendMessageResponse,
} from '../types';

class MarketrixApiService {
  private api: AxiosInstance;
  private config: MarketrixConfig;

  constructor(config: MarketrixConfig) {
    this.config = config;

    // Initialize axios instance with base configuration
    this.api = axios.create({
      baseURL: 'http://localhost:8080', // Local API server
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

  async sendMessage(
    message: string,
    mode: 'show' | 'tell' | 'do',
    connectionId?: number,
    question?: string
  ): Promise<SendMessageResponse> {
    try {
      const request: SendMessageRequest = {
        connection_id: connectionId,
        question,
      };

      console.log('=== SENDING MESSAGE WITH TOUR DATA ===');
      console.log('Message:', message);
      console.log('Mode:', mode);
      console.log('Connection ID received:', connectionId);
      console.log('Question received:', question);
      console.log('Connection ID type:', typeof connectionId);
      console.log('Question type:', typeof question);
      console.log('Request payload:', request);

      const response = await this.api.get<ApiResponse<SendMessageResponse>>(
        `tour?question=${encodeURIComponent(question || '')}&connection_id=${connectionId || 1}`
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to send message');
      }

      console.log('Message sent successfully:', response.data.data);
      return response.data.data!;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // Direct tour API call with specific question and connection_id
  async getTourData(question: string, connectionId: number = 1): Promise<any> {
    try {
      console.log('=== CALLING TOUR API DIRECTLY ===');
      console.log('Question:', question);
      console.log('Connection ID:', connectionId);

      const url = `tour?question=${encodeURIComponent(question)}&connection_id=${connectionId}`;
      console.log('Tour API URL:', url);

      const response = await this.api.get<ApiResponse<any>>(url);

      if (response.data.success) {
        console.log('Tour data received successfully:', response.data.data);
        return response.data.data;
      } else {
        console.error('Failed to get tour data:', response.data.error);
        throw new Error(response.data.error || 'Failed to get tour data');
      }
    } catch (error) {
      console.error('Error getting tour data:', error);
      throw error;
    }
  }

  // Test method for login tour with 4 steps
  async testLoginTour(): Promise<any> {
    return this.getTourData('login tour with 4 steps', 1);
  }

  async checkAgentAvailability(): Promise<boolean> {
    try {
      const response = await this.api.get<ApiResponse<{ available: boolean }>>('/agent/status');

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
      const response =
        await this.api.get<ApiResponse<{ name: string; avatarUrl: string }>>('/agent/info');

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
