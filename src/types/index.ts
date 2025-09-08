export interface MarketrixConfig {
  marketrixId: string;
  marketrixKey: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  theme?: 'light' | 'dark';
  avatarUrl?: string;
  agentName?: string;
  enabledModes?: ('show' | 'tell' | 'do')[];
}

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: Date;
  mode?: 'show' | 'tell' | 'do';
}

export interface WidgetState {
  isOpen: boolean;
  isMinimized: boolean;
  isLoading: boolean;
  messages: ChatMessage[];
  currentMode: 'show' | 'tell' | 'do';
  agentAvailable: boolean;
  error?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface SendMessageRequest {
  message: string;
  mode: 'show' | 'tell' | 'do';
  marketrixId: string;
  marketrixKey: string;
}

export interface SendMessageResponse {
  messageId: string;
  response: string;
  mode: 'show' | 'tell' | 'do';
  timestamp: Date;
}

export type WidgetPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
export type ChatMode = 'show' | 'tell' | 'do';
export type Theme = 'light' | 'dark';
