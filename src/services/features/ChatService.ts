import type { ChatMessage, InstructionType, TaskProgress } from '../../types';
import { parseProgressSteps, removeThinkingMarkers } from '../../utils/messageContentUtils';

interface StoredChatContext {
  chat_id: string;
  messages: Array<Omit<ChatMessage, 'videoStream' | 'timestamp'> & { timestamp: string }>;
  isTaskRunning: boolean;
  activeTaskId: string | null;
  taskProgress: TaskProgress[];
  currentMode: InstructionType;
  isOpen: boolean;
  isMinimized: boolean;
  timestamp: number;
}

const CHAT_CONTEXT_STORAGE_KEY = 'marketrix_chat_context';
const CONTEXT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class ChatService {
  private static instance: ChatService;
  private messages: ChatMessage[] = [];
  private chatId: string | null = null;
  private isTaskRunning: boolean = false;
  private activeTaskId: string | null = null;
  private taskProgress: TaskProgress[] = [];
  private currentMode: InstructionType = 'tell';
  private isOpen: boolean = false;
  private isMinimized: boolean = false;

  private constructor() {}

  static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  initialize(chatId: string | null): void {
    this.chatId = chatId;
    this.restoreState();
  }

  getMessages(): ChatMessage[] {
    return this.messages;
  }

  addMessage(message: ChatMessage): void {
    this.messages = [...this.messages, message];
    this.persistState();
  }

  updateMessage(messageId: string, updates: Partial<ChatMessage>): void {
    this.messages = this.messages.map((msg) =>
      msg.id === messageId ? { ...msg, ...updates } : msg
    );
    this.persistState();
  }

  removeMessage(messageId: string): void {
    this.messages = this.messages.filter((msg) => msg.id !== messageId);
    this.persistState();
  }

  setMessages(messages: ChatMessage[]): void {
    this.messages = messages;
    this.persistState();
  }

  clearMessages(): void {
    this.messages = [];
    this.persistState();
  }

  setTaskState(isRunning: boolean, taskId: string | null, progress: TaskProgress[]): void {
    this.isTaskRunning = isRunning;
    this.activeTaskId = taskId;
    this.taskProgress = progress;
    this.persistState();
  }

  setMode(mode: InstructionType): void {
    this.currentMode = mode;
    this.persistState();
  }

  setWidgetState(isOpen: boolean, isMinimized: boolean): void {
    this.isOpen = isOpen;
    this.isMinimized = isMinimized;
    this.persistState();
  }

  // State Restoration & Persistence

  private restoreState(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(CHAT_CONTEXT_STORAGE_KEY);
      if (!stored) return;

      const context = JSON.parse(stored) as StoredChatContext;

      if (!context || typeof context !== 'object') return;

      if (Date.now() - context.timestamp > CONTEXT_EXPIRY_MS) {
        localStorage.removeItem(CHAT_CONTEXT_STORAGE_KEY);
        return;
      }

      if (this.chatId && context.chat_id !== this.chatId) {
        console.log('[ChatService] Chat ID mismatch but restoring history');
      }

      this.messages = context.messages.map((msg) => {
        const restoredMsg: ChatMessage = {
          ...msg,
          timestamp: new Date(msg.timestamp),
          videoStream: undefined,
        };

        // Migration: If progressSteps is missing, parse from content
        if (!restoredMsg.progressSteps) {
          const { mainContent, progressSteps } = parseProgressSteps(restoredMsg.content);
          if (progressSteps.length > 0) {
            restoredMsg.content = mainContent;
            restoredMsg.progressSteps = progressSteps;
          }
        }
        return restoredMsg;
      });

      this.isTaskRunning = context.isTaskRunning;
      this.activeTaskId = context.activeTaskId;
      this.taskProgress = context.taskProgress;
      this.currentMode = context.currentMode;
      this.isOpen = context.isOpen;
      this.isMinimized = context.isMinimized;
    } catch (error) {
      console.warn('[ChatService] Failed to restore state:', error);
    }
  }

  private persistState(): void {
    if (typeof window === 'undefined' || !this.chatId) return;

    try {
      const serializedMessages = this.messages
        .filter((msg) => {
          if (!msg.isPlaceholder) return true;
          const hasContent = msg.content.trim().length > 0;
          const hasProgress = msg.progressSteps && msg.progressSteps.length > 0;
          return hasContent || hasProgress;
        })
        .filter((msg) => !(msg.isSystemMessage && msg.content === 'Chat context changed'))
        .map((msg) => ({
          id: msg.id,
          content: removeThinkingMarkers(msg.content),
          sender: msg.sender,
          timestamp: msg.timestamp.toISOString(),
          mode: msg.mode,
          isScreenAccessRequest: msg.isScreenAccessRequest,
          isSystemMessage: msg.isSystemMessage,
          isPlaceholder: msg.isPlaceholder,
          progressSteps: msg.progressSteps,
        }));

      const context: StoredChatContext = {
        chat_id: this.chatId,
        messages: serializedMessages,
        isTaskRunning: this.isTaskRunning,
        activeTaskId: this.activeTaskId,
        taskProgress: this.taskProgress,
        currentMode: this.currentMode,
        isOpen: this.isOpen,
        isMinimized: this.isMinimized,
        timestamp: Date.now(),
      };

      localStorage.setItem(CHAT_CONTEXT_STORAGE_KEY, JSON.stringify(context));
    } catch (error) {
      console.warn('[ChatService] Failed to persist state:', error);
    }
  }

  // Message Factory Methods
  createUserMessage(content: string, mode?: InstructionType): ChatMessage {
    return createUserMessage(content, mode);
  }

  createAgentMessage(content: string, mode?: InstructionType, messageId?: string): ChatMessage {
    return createAgentMessage(content, mode, messageId);
  }

  createSystemMessage(
    content: string,
    mode?: InstructionType,
    sender: 'user' | 'agent' = 'agent',
    idPrefix: string = 'system-message'
  ): ChatMessage {
    return createSystemMessage(content, mode, sender, idPrefix);
  }
}

export const chatService = ChatService.getInstance();

// Exported Factory Functions
export function createUserMessage(
  content: string,
  mode?: InstructionType,
  idPrefix: string = 'user-message'
): ChatMessage {
  return {
    id: `${idPrefix}-${Date.now()}`,
    content: content.trim(),
    sender: 'user',
    timestamp: new Date(),
    mode,
  };
}

export function createAgentMessage(
  content: string,
  mode?: InstructionType,
  messageId?: string,
  idPrefix: string = 'agent-message'
): ChatMessage {
  return {
    id: messageId || `${idPrefix}-${Date.now()}`,
    content,
    sender: 'agent',
    timestamp: new Date(),
    mode,
  };
}

export function createSystemMessage(
  content: string,
  mode?: InstructionType,
  sender: 'user' | 'agent' = 'agent',
  idPrefix: string = 'system-message'
): ChatMessage {
  return {
    id: `${idPrefix}-${Date.now()}`,
    content,
    sender,
    timestamp: new Date(),
    mode,
    isSystemMessage: true,
  };
}

export function createPlaceholderMessage(
  mode?: InstructionType,
  placeholderState: 'thinking' | 'waiting-for-user' = 'thinking'
): ChatMessage {
  return {
    id: `placeholder-${Date.now()}`,
    content: '',
    sender: 'agent',
    timestamp: new Date(),
    mode,
    isPlaceholder: true,
    placeholderState,
  };
}

export function createScreenAccessRequestMessage(mode?: InstructionType): ChatMessage {
  return {
    id: `screen-access-request-${Date.now()}`,
    content: 'Can I take a look at your screen?',
    sender: 'agent',
    timestamp: new Date(),
    mode,
    isScreenAccessRequest: true,
  };
}

export function createStartedScreenshareMessage(mode: InstructionType = 'show'): ChatMessage {
  return {
    id: `started-screenshare-${Date.now()}`,
    content: 'Started screenshare',
    sender: 'user',
    timestamp: new Date(),
    mode,
    isSystemMessage: true,
  };
}

export function createScreenshareMessage(
  stream: MediaStream,
  mode: InstructionType = 'show'
): ChatMessage {
  return {
    id: `screenshare-${Date.now()}`,
    content: '',
    sender: 'user',
    timestamp: new Date(),
    mode,
    videoStream: stream,
  };
}

export function createErrorMessage(
  content: string,
  mode?: InstructionType,
  originalMessageId?: string
): ChatMessage {
  return {
    id: originalMessageId ? `error-${originalMessageId}-${Date.now()}` : `error-${Date.now()}`,
    content,
    sender: 'agent',
    timestamp: new Date(),
    mode,
  };
}
