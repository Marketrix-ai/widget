import type { ChatMessage, InstructionType, TaskProgress } from '../types';
import { removeThinkingMarkers } from '../utils/chat';
import { storageService } from './StorageService';

/**
 * Snapshot of widget state persisted to / restored from localStorage.
 * React context is the single source of truth at runtime — this is the
 * load/persist boundary only.
 */
export interface ChatSnapshot {
  messages: ChatMessage[];
  isTaskRunning: boolean;
  activeTaskId: string | null;
  taskProgress: TaskProgress[];
  currentMode: InstructionType;
  isOpen: boolean;
  isMinimized: boolean;
  isLoading: boolean;
}

/**
 * ChatService — thin persistence layer.
 *
 * Owns only the localStorage read/write lifecycle for the widget chat context:
 * contexts call `persist(snapshot)` from a single effect and `restore()` once on mount.
 */
export class ChatService {
  private static instance: ChatService;
  private chatId: string | null = null;
  initError: Error | null = null;

  private constructor() {}

  static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  initialize(chatId: string | null): void {
    this.chatId = chatId;
  }

  createInitialContext(chatId: string): void {
    try {
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
      this.initError = error instanceof Error ? error : new Error(String(error));
    }
  }

  getInitError(): Error | null {
    return this.initError;
  }

  /** Read the persisted snapshot, rehydrating messages (dates, lost streams). */
  restore(): ChatSnapshot {
    const context = storageService.getContext();

    const messages: ChatMessage[] = context.chat_id
      ? context.messages.map(msg => {
          // A screenshare stream can't survive a reload — replace it with an
          // "ended" system message rather than a dangling video placeholder.
          if (msg.id.startsWith('screenshare-')) {
            return {
              ...msg,
              content: 'Screenshare ended',
              videoStream: undefined,
              isSystemMessage: true,
              timestamp: new Date(msg.timestamp),
              parts: [{ type: 'text', content: 'Screenshare ended' }],
            };
          }

          const restoredMsg: ChatMessage = {
            ...msg,
            timestamp: new Date(msg.timestamp),
            videoStream: undefined,
            placeholderState: msg.placeholderState,
            taskStatus: msg.taskStatus,
            parts: msg.parts || [],
          };

          if (restoredMsg.parts?.length === 0 && restoredMsg.content) {
            const cleanContent = restoredMsg.content.replace(/\n\n__THINKING__$/, '').trim();
            if (cleanContent && restoredMsg.parts) {
              restoredMsg.parts.push({ type: 'text', content: cleanContent });
            }
          }

          return restoredMsg;
        })
      : [];

    return {
      messages,
      isTaskRunning: context.isTaskRunning,
      activeTaskId: context.activeTaskId,
      taskProgress: context.taskProgress,
      currentMode: context.currentMode,
      isOpen: context.isOpen,
      isMinimized: context.isMinimized,
      isLoading: context.isLoading ?? false,
    };
  }

  /** Persist the current widget snapshot. No-op until a chatId is known. */
  persist(snapshot: ChatSnapshot): void {
    if (!this.chatId) return;

    try {
      const serializedMessages = snapshot.messages
        .filter(msg => {
          if (!msg.isPlaceholder) return true;
          // Keep placeholders that are still thinking/waiting, or that carry parts.
          if (msg.placeholderState === 'thinking' || msg.placeholderState === 'waiting-for-user') {
            return true;
          }
          return (msg.parts || []).length > 0;
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
          placeholderState: msg.placeholderState,
          taskStatus: msg.taskStatus,
          parts: msg.parts,
        }));

      storageService.updateContext({
        chat_id: this.chatId,
        messages: serializedMessages,
        isTaskRunning: snapshot.isTaskRunning,
        activeTaskId: snapshot.activeTaskId,
        taskProgress: snapshot.taskProgress,
        currentMode: snapshot.currentMode,
        isOpen: snapshot.isOpen,
        isMinimized: snapshot.isMinimized,
        isLoading: snapshot.isLoading,
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
