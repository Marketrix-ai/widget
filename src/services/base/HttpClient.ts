/**
 * Base HTTP Client
 *
 * This file provides a shared axios setup to eliminate duplication
 * across different API services. All services should extend this
 * base client instead of creating their own axios instances.
 */

import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { CONTENT_TYPES, HEADERS, RETRY_CONFIG, TIMEOUTS } from '../../constants';

export interface HttpClientConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  retryConfig?: typeof RETRY_CONFIG;
}

interface RetryableRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
  _retryCount?: number;
}

interface ApiError extends Error {
  status?: number;
  data?: unknown;
}

export class HttpClient {
  protected client: AxiosInstance;
  private retryConfig: typeof RETRY_CONFIG;

  constructor(config: HttpClientConfig = {}) {
    this.retryConfig = config.retryConfig || RETRY_CONFIG;

    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || TIMEOUTS.DEFAULT,
      headers: {
        [HEADERS.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        [HEADERS.ACCEPT]: CONTENT_TYPES.JSON,
        ...config.headers,
      },
    });

    this.setupInterceptors();
  }

  /**
   * Setup request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig<unknown>) => {
        // Add request ID for tracking
        config.headers[HEADERS.X_REQUEST_ID] = this.generateRequestId();

        // Log request
        console.log(`[HTTP Request] ${config.method?.toUpperCase()} ${config.url}`, {
          headers: config.headers,
          data: config.data,
        });

        return config;
      },
      (error) => {
        console.error('[HTTP Request Error]', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse<unknown>) => {
        // Log response
        console.log(`[HTTP Response] ${response.status} ${response.config.url}`, {
          data: response.data,
          headers: response.headers,
        });

        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as RetryableRequestConfig;

        // Retry logic for network errors
        if (this.shouldRetry(error) && !originalRequest._retry) {
          originalRequest._retry = true;
          originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;

          if (originalRequest._retryCount <= this.retryConfig.MAX_ATTEMPTS) {
            const delay = this.calculateRetryDelay(originalRequest._retryCount);

            console.warn(
              `[HTTP Retry] Attempt ${originalRequest._retryCount}/${this.retryConfig.MAX_ATTEMPTS} after ${delay}ms`
            );

            await this.delay(delay);
            return this.client(originalRequest);
          }
        }

        // Log error
        console.error('[HTTP Response Error]', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
          method: error.config?.method,
        });

        return Promise.reject(this.normalizeError(error));
      }
    );
  }

  /**
   * Determine if a request should be retried
   */
  private shouldRetry(error: AxiosError): boolean {
    // Retry on network errors or 5xx server errors
    return (
      !error.response || // Network error
      error.response.status >= 500 || // Server error
      error.code === 'ECONNABORTED' // Timeout
    );
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const delay =
      this.retryConfig.INITIAL_DELAY * Math.pow(this.retryConfig.BACKOFF_FACTOR, attempt - 1);
    return Math.min(delay, this.retryConfig.MAX_DELAY);
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay utility for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Normalize error response
   */
  private normalizeError(error: AxiosError): ApiError {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      const responseData = data as Record<string, unknown>;
      const message =
        (responseData?.message as string) ||
        (responseData?.error as string) ||
        `HTTP ${status} Error`;

      const normalizedError = new Error(message) as ApiError;
      normalizedError.status = status;
      normalizedError.data = data;
      return normalizedError;
    } else if (error.request) {
      // Network error
      return new Error('Network Error: Unable to reach server') as ApiError;
    } else {
      // Other error
      return error as ApiError;
    }
  }

  /**
   * Set authorization token
   */
  setAuthToken(token: string): void {
    this.client.defaults.headers.common[HEADERS.AUTHORIZATION] = `Bearer ${token}`;
  }

  /**
   * Clear authorization token
   */
  clearAuthToken(): void {
    delete this.client.defaults.headers.common[HEADERS.AUTHORIZATION];
  }

  /**
   * Set base URL
   */
  setBaseURL(baseURL: string): void {
    this.client.defaults.baseURL = baseURL;
  }

  /**
   * Set default timeout
   */
  setTimeout(timeout: number): void {
    this.client.defaults.timeout = timeout;
  }

  /**
   * Get the underlying axios instance
   */
  getAxiosInstance(): AxiosInstance {
    return this.client;
  }

  /**
   * Make GET request
   */
  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  /**
   * Make POST request
   */
  async post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  /**
   * Make PUT request
   */
  async put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  /**
   * Make PATCH request
   */
  async patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  /**
   * Make DELETE request
   */
  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

export default HttpClient;
