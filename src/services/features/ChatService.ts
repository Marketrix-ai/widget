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

        // Migration: Ensure parts exist
        if (!restoredMsg.parts) {
          restoredMsg.parts = [];

          // Migrate progressSteps if present
          if (restoredMsg.progressSteps && restoredMsg.progressSteps.length > 0) {
            // Add initial text content if exists
            const cleanContent = restoredMsg.content.replace(/\n\n__THINKING__$/, '').trim();
            if (cleanContent) {
              restoredMsg.parts.push({
                type: 'text',
                content: cleanContent,
              });
            }
            // Add progress steps
            restoredMsg.progressSteps.forEach((step) => {
              restoredMsg.parts!.push({
                type: 'progress',
                content: step.explanation || `Executing ${step.tool}...`,
                status: step.status === 'pending' ? 'running' : step.status,
                toolName: step.tool,
              });
            });
          } else {
            // Check if legacy content string needs migration
            const { mainContent, progressSteps } = parseProgressSteps(restoredMsg.content);

            if (progressSteps.length > 0) {
              // Was legacy string format
              if (mainContent) {
                restoredMsg.parts.push({ type: 'text', content: mainContent });
              }
              progressSteps.forEach((step) => {
                restoredMsg.parts!.push({
                  type: 'progress',
                  content: step.explanation || `Executing ${step.tool}...`,
                  status: step.status === 'pending' ? 'running' : step.status,
                  toolName: step.tool,
                });
              });

              // Update content to mainContent only to avoid reparsing
              restoredMsg.content = mainContent;
              // We can optionally set progressSteps for legacy compatibility or leave it
              restoredMsg.progressSteps = progressSteps;
            } else {
              // Just plain text
              const cleanContent = restoredMsg.content.replace(/\n\n__THINKING__$/, '').trim();
              if (cleanContent) {
                restoredMsg.parts.push({
                  type: 'text',
                  content: cleanContent,
                });
              }
            }
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
          // Only keep placeholders if they have content or progress parts
          const parts = msg.parts || [];
          return parts.length > 0;
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
          parts: msg.parts, // Save parts
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
  const parts = [];
  const cleanContent = content.trim();
  if (cleanContent) {
    parts.push({ type: 'text' as const, content: cleanContent });
  }

  return {
    id: `${idPrefix}-${Date.now()}`,
    content: cleanContent,
    sender: 'user',
    timestamp: new Date(),
    mode,
    parts,
  };
}

export function createAgentMessage(
  content: string,
  mode?: InstructionType,
  messageId?: string,
  idPrefix: string = 'agent-message'
): ChatMessage {
  const parts = [];
  const cleanContent = content.trim();
  if (cleanContent) {
    parts.push({ type: 'text' as const, content: cleanContent });
  }

  return {
    id: messageId || `${idPrefix}-${Date.now()}`,
    content,
    sender: 'agent',
    timestamp: new Date(),
    mode,
    parts,
  };
}

export function createSystemMessage(
  content: string,
  mode?: InstructionType,
  sender: 'user' | 'agent' = 'agent',
  idPrefix: string = 'system-message'
): ChatMessage {
  const parts = [];
  if (content) {
    parts.push({ type: 'text' as const, content });
  }

  return {
    id: `${idPrefix}-${Date.now()}`,
    content,
    sender,
    timestamp: new Date(),
    mode,
    isSystemMessage: true,
    parts,
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
    parts: [],
  };
}

export function createScreenAccessRequestMessage(mode?: InstructionType): ChatMessage {
  const content = 'Can I take a look at your screen?';
  return {
    id: `screen-access-request-${Date.now()}`,
    content,
    sender: 'agent',
    timestamp: new Date(),
    mode,
    isScreenAccessRequest: true,
    parts: [{ type: 'text', content }],
  };
}

export function createStartedScreenshareMessage(mode: InstructionType = 'show'): ChatMessage {
  const content = 'Started screenshare';
  return {
    id: `started-screenshare-${Date.now()}`,
    content,
    sender: 'user',
    timestamp: new Date(),
    mode,
    isSystemMessage: true,
    parts: [{ type: 'text', content }],
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
    parts: [],
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
    parts: [{ type: 'text', content }],
  };
}
