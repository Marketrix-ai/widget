import type { ChatMessage, InstructionType } from '../types';
import { type ChatSnapshot, storageService, type StoredMessage } from './StorageService';

function reviveMessage(msg: StoredMessage): ChatMessage {
  const parts = [...msg.parts];
  const text = msg.content.trim();
  if (parts.length === 0 && text) parts.push({ type: 'text', content: text });
  return { ...msg, timestamp: new Date(msg.timestamp), parts };
}

function serializeMessage({ videoStream, ...msg }: ChatMessage): StoredMessage {
  const timestamp = msg.timestamp.toISOString();
  if (!videoStream) return { ...msg, timestamp };
  const content = 'Screenshare ended';
  return { ...msg, timestamp, content, isSystemMessage: true, parts: [{ type: 'text', content }] };
}

export class ChatService {
  restore(): ChatSnapshot {
    const { chat_id: _chatId, config: _config, timestamp: _timestamp, messages, ...rest } = storageService.getContext();
    return { ...rest, messages: messages.map(reviveMessage) };
  }

  persist(snapshot: ChatSnapshot): void {
    storageService.updateContext({ ...snapshot, messages: snapshot.messages.map(serializeMessage) });
  }
}

export const chatService = new ChatService();

function createMessage(
  idPrefix: string,
  sender: 'user' | 'agent',
  content: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id: `${idPrefix}-${Date.now()}`,
    content,
    sender,
    timestamp: new Date(),
    parts: content ? [{ type: 'text', content }] : [],
    ...extra,
  };
}

export const createUserMessage = (content: string, mode?: InstructionType, idPrefix = 'user-message'): ChatMessage =>
  createMessage(idPrefix, 'user', content.trim(), { mode });

export const createAgentMessage = (content: string): ChatMessage =>
  createMessage('agent-message', 'agent', content.trim());

export const createSystemMessage = (
  content: string,
  mode: InstructionType,
  sender: 'user' | 'agent',
  idPrefix: string,
): ChatMessage => createMessage(idPrefix, sender, content, { mode, isSystemMessage: true });

export const createScreenAccessRequestMessage = (
  mode: InstructionType | undefined,
  pendingContent?: string,
): ChatMessage =>
  createMessage('screen-access-request', 'agent', 'Can I take a look at your screen?', {
    mode,
    isScreenAccessRequest: true,
    pendingContent,
  });

export const createScreenshareMessage = (stream: MediaStream, mode: InstructionType = 'show'): ChatMessage =>
  createMessage('screenshare', 'user', '', { mode, videoStream: stream });
