import { sdk, type WidgetCommand } from '../sdk';
import type { MarketrixConfig, MessageDispatchRequest } from '../types';
import { chatSessionManager } from './ChatSessionManager';
import { storageService } from './StorageService';
import { StreamClient } from './StreamClient';

function logWidgetQuestion(config: MarketrixConfig, question: string, mode: string): void {
  const metadata: Record<string, unknown> = {
    question,
    mode,
    chat_id: storageService.getChatId(),
    timestamp: new Date().toISOString(),
  };

  if (config.userId) metadata.user_id = config.userId;
  if (config.mtxId && config.mtxKey) {
    metadata.marketrix_id = config.mtxId;
    metadata.marketrix_key = config.mtxKey;
  }

  sdk
    .activityLogCreate({ type: 'widget_question', metadata })
    .catch((error: unknown) => console.warn('[API Service] Failed to log widget question:', error));
}

/** Fire-and-forget send over the typed stream; the reply arrives asynchronously as a chat/response event. */
export async function messageDispatch(config: MarketrixConfig, request: MessageDispatchRequest): Promise<void> {
  await chatSessionManager.getOrCreateChatId();

  const mode = request.mode || 'tell';

  if (request.message) {
    logWidgetQuestion(config, request.message, mode);
  }

  if (!(config.mtxId && config.mtxKey)) {
    throw new Error('mtxId + mtxKey is required');
  }

  const command: WidgetCommand = {
    type: `chat/${mode}` as 'chat/tell' | 'chat/show' | 'chat/do',
    request_id: request.requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    content: request.message || '',
  };

  StreamClient.getInstance().send(command);
}
