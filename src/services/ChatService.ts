import type { ChatMessage, InstructionType, TaskProgress } from '../types';
import { removeThinkingMarkers } from '../utils/chat';
import { storageService } from './StorageService';

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
  private isLoading: boolean = false;

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

  createInitialContext(chatId: string): void {
    try {
      // Only create if no existing context
      if (storageService.hasValidContext()) {
        return;
      }

      storageService.updateContext({
        chat_id: chatId,
        messages: [],
        isTaskRunning: false,
        activeTaskId: null,
        taskProgress: [],
        currentMode: 'tell',
        isOpen: false,
        isMinimized: false,
        isLoading: false,
      });
    } catch (error) {
      console.error('[ChatService] Failed to create initial chat context:', error);
    }
  }

  getMessages(): ChatMessage[] {
    return this.messages;
  }

  getIsLoading(): boolean {
    return this.isLoading;
  }

  getIsTaskRunning(): boolean {
    return this.isTaskRunning;
  }

  getActiveTaskId(): string | null {
    return this.activeTaskId;
  }

  getTaskProgress(): TaskProgress[] {
    return this.taskProgress;
  }

  getCurrentMode(): InstructionType {
    return this.currentMode;
  }

  getIsOpen(): boolean {
    return this.isOpen;
  }

  getIsMinimized(): boolean {
    return this.isMinimized;
  }

  addMessage(message: ChatMessage): void {
    this.messages = [...this.messages, message];
    this.persistState();
  }

  updateMessage(messageId: string, updates: Partial<ChatMessage>): void {
    this.messages = this.messages.map(msg => (msg.id === messageId ? { ...msg, ...updates } : msg));
    this.persistState();
  }

  removeMessage(messageId: string): void {
    this.messages = this.messages.filter(msg => msg.id !== messageId);
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

  setIsLoading(loading: boolean): void {
    this.isLoading = loading;
    this.persistState();
  }

  // State Restoration & Persistence

  private restoreState(): void {
    try {
      const context = storageService.getContext();

      if (!context.chat_id) return;

      if (this.chatId && context.chat_id !== this.chatId) {
        // Chat ID mismatch - restoring history anyway
      }

      this.messages = context.messages.map(msg => {
        // Handle restored screenshare messages
        // If a message was a screenshare stream (id starts with 'screenshare-'),
        // replace it with a "Screenshare ended" message since the stream is lost on refresh.
        if (msg.id.startsWith('screenshare-')) {
          return {
            ...msg,
            content: 'Screenshare ended',
            videoStream: undefined,
            isSystemMessage: true, // Treat as system message now
            timestamp: new Date(msg.timestamp),
            parts: [{ type: 'text', content: 'Screenshare ended' }],
          };
        }

        const restoredMsg: ChatMessage = {
          ...msg,
          timestamp: new Date(msg.timestamp),
          videoStream: undefined,
          placeholderState: msg.placeholderState, // Restore placeholder state
          taskStatus: msg.taskStatus, // Restore task status
          parts: msg.parts || [], // Use stored parts or default to empty
        };

        // If no parts, create default text part from content (if any)
        if (restoredMsg.parts?.length === 0 && restoredMsg.content) {
          const cleanContent = restoredMsg.content.replace(/\n\n__THINKING__$/, '').trim();
          if (cleanContent && restoredMsg.parts) {
            restoredMsg.parts.push({
              type: 'text',
              content: cleanContent,
            });
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
      this.isLoading = context.isLoading ?? false;
    } catch (error) {
      console.warn('[ChatService] Failed to restore state:', error);
    }
  }

  private persistState(): void {
    if (!this.chatId) return;

    try {
      const serializedMessages = this.messages
        .filter(msg => {
          if (!msg.isPlaceholder) return true;
          // Keep placeholders if they have content, progress parts, OR are thinking/waiting
          if (msg.placeholderState === 'thinking' || msg.placeholderState === 'waiting-for-user') {
            return true;
          }

          // Only keep other placeholders if they have content or progress parts
          const parts = msg.parts || [];
          return parts.length > 0;
        })
        .filter(msg => !(msg.isSystemMessage && msg.content === 'Chat context changed'))
        .map(msg => ({
          id: msg.id,
          content: removeThinkingMarkers(msg.content),
          sender: msg.sender,
          timestamp: msg.timestamp.toISOString(),
          mode: msg.mode,
          isScreenAccessRequest: msg.isScreenAccessRequest,
          screenShareStatus: msg.screenShareStatus,
          isSystemMessage: msg.isSystemMessage,
          isPlaceholder: msg.isPlaceholder,
          placeholderState: msg.placeholderState, // Save placeholder state
          taskStatus: msg.taskStatus, // Save task status
          parts: msg.parts, // Save parts
        }));

      storageService.updateContext({
        chat_id: this.chatId,
        messages: serializedMessages,
        isTaskRunning: this.isTaskRunning,
        activeTaskId: this.activeTaskId,
        taskProgress: this.taskProgress,
        currentMode: this.currentMode,
        isOpen: this.isOpen,
        isMinimized: this.isMinimized,
        isLoading: this.isLoading,
      });
    } catch (error) {
      console.warn('[ChatService] Failed to persist state:', error);
    }
  }
}

export const chatService = ChatService.getInstance();

// Exported Factory Functions
export function createUserMessage(
  content: string,
  mode?: InstructionType,
  idPrefix: string = 'user-message',
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
  idPrefix: string = 'agent-message',
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
  idPrefix: string = 'system-message',
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

export function createScreenshareMessage(stream: MediaStream, mode: InstructionType = 'show'): ChatMessage {
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
