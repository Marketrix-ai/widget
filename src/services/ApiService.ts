import { sdk, type WidgetCommand } from '../sdk';
import type { MarketrixConfig, MessageDispatchRequest } from '../types';
import { chatSessionManager } from './ChatSessionManager';
import { StreamClient } from './StreamClient';

export function getChatId(): string | null {
  return chatSessionManager.getChatId();
}

function getUserId(config: MarketrixConfig): number | null {
  if (config.userId && typeof config.userId === 'number') {
    return config.userId;
  }

  try {
    const storedUserId = localStorage.getItem('marketrix_user_id');
    if (storedUserId) {
      const userId = Number(storedUserId);
      if (!isNaN(userId)) {
        return userId;
      }
    }
  } catch (error) {
    console.warn('[API Service] Failed to get user_id from localStorage:', error);
  }

  try {
    const sessionUserId = sessionStorage.getItem('marketrix_user_id');
    if (sessionUserId) {
      const userId = Number(sessionUserId);
      if (!isNaN(userId)) {
        return userId;
      }
    }
  } catch (error) {
    console.warn('[API Service] Failed to get user_id from sessionStorage:', error);
  }

  return null;
}

async function logWidgetQuestion(config: MarketrixConfig, question: string, mode: string): Promise<void> {
  try {
    const userId = getUserId(config);

    const metadata: Record<string, unknown> = {
      question,
      mode,
      chat_id: getChatId(),
      timestamp: new Date().toISOString(),
    };

    if (userId !== null) {
      metadata.user_id = userId;
    }

    if (config.mtxId && config.mtxKey) {
      metadata.marketrix_id = config.mtxId;
      metadata.marketrix_key = config.mtxKey;
    }

    sdk
      .activityLogCreate({
        type: 'widget_question',
        metadata,
      })
      .catch((error: unknown) => {
        console.warn('[API Service] Failed to log widget question:', error);
      });
  } catch (error) {
    console.warn('[API Service] Error logging widget question:', error);
  }
}

/** Fire-and-forget send over the typed stream; the reply arrives asynchronously as a chat/response event. */
export async function messageDispatch(config: MarketrixConfig, request: MessageDispatchRequest): Promise<void> {
  const chatId = await chatSessionManager.getOrCreateChatId();
  if (!chatId) throw new Error('Failed to initialize chat session');

  const mode = request.mode || 'tell';

  if (request.message) {
    await logWidgetQuestion(config, request.message, mode);
  }

  if (!(config.mtxId && config.mtxKey)) {
    throw new Error('mtxId + mtxKey is required');
  }

  const requestId = request.requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const command: WidgetCommand = {
    type: `chat/${mode}` as 'chat/tell' | 'chat/show' | 'chat/do',
    request_id: requestId,
    content: request.message || '',
  };

  StreamClient.getInstance().send(command);
}
