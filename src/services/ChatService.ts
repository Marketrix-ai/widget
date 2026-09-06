import type { ChatMessage, InstructionType } from '../types';
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

  const parts = [...msg.parts];
  const text = msg.content.trim();
  if (parts.length === 0 && text) parts.push({ type: 'text', content: text });
  return { ...msg, timestamp: new Date(msg.timestamp), parts };
}

function serializeMessage({ videoStream: _videoStream, ...msg }: ChatMessage): StoredMessage {
  return { ...msg, timestamp: msg.timestamp.toISOString() };
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

export const createScreenAccessRequestMessage = (mode?: InstructionType): ChatMessage =>
  createMessage('screen-access-request', 'agent', 'Can I take a look at your screen?', {
    mode,
    isScreenAccessRequest: true,
  });

export const createScreenshareMessage = (stream: MediaStream, mode: InstructionType = 'show'): ChatMessage =>
  createMessage('screenshare', 'user', '', { mode, videoStream: stream });
