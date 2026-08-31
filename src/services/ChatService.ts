import type { ChatMessage, InstructionType } from '../types';
import { removeThinkingMarkers } from '../utils/chat';
import { type ChatSnapshot, storageService, type StoredMessage } from './StorageService';

function reviveMessage(msg: StoredMessage): ChatMessage {
  // A MediaStream can't survive a reload, so a restored screenshare becomes an "ended" notice.
  if (msg.id.startsWith('screenshare-')) {
    const content = 'Screenshare ended';
    return {
      ...msg,
      content,
      isSystemMessage: true,
      timestamp: new Date(msg.timestamp),
      parts: [{ type: 'text', content }],
    };
  }

  const parts = [...(msg.parts ?? [])];
  const text = msg.content.replace(/\n\n__THINKING__$/, '').trim();
  if (parts.length === 0 && text) parts.push({ type: 'text', content: text });
  return { ...msg, timestamp: new Date(msg.timestamp), parts };
}

function serializeMessage({ videoStream: _videoStream, ...msg }: ChatMessage): StoredMessage {
  return { ...msg, content: removeThinkingMarkers(msg.content), timestamp: msg.timestamp.toISOString() };
}

/** A placeholder with nothing to show yet would restore as a permanently empty bubble. */
function isPersistable(msg: ChatMessage): boolean {
  if (!msg.isPlaceholder) return true;
  return (
    msg.placeholderState === 'thinking' || msg.placeholderState === 'waiting-for-user' || (msg.parts?.length ?? 0) > 0
  );
}

export class ChatService {
  private restored = false;

  restore(): ChatSnapshot {
    const { chat_id: _chatId, config: _config, timestamp: _timestamp, messages, ...rest } = storageService.getContext();
    this.restored = true;
    return { ...rest, messages: messages.map(reviveMessage) };
  }

  persist(snapshot: ChatSnapshot): void {
    // The mount-time render fires before restore() lands; persisting then would write [] over the stored messages.
    if (!this.restored) return;
    storageService.updateContext({
      ...snapshot,
      messages: snapshot.messages.filter(isPersistable).map(serializeMessage),
    });
  }
}

export const chatService = new ChatService();

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
