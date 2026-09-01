import { type InstructionType, sdk, type WidgetCommand } from '../sdk';
import type { MarketrixConfig } from '../types';
import { chatSessionManager } from './ChatSessionManager';
import { storageService } from './StorageService';
import { StreamClient } from './StreamClient';

function logWidgetQuestion(config: MarketrixConfig, question: string, mode: InstructionType): void {
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

/** The reply does not come back from here — it arrives asynchronously as a chat/response event on the stream. */
export async function messageDispatch(
  config: MarketrixConfig,
  message: string,
  mode: InstructionType,
  requestId: string,
): Promise<void> {
  if (!(config.mtxId && config.mtxKey)) {
    throw new Error('mtxId + mtxKey is required');
  }

  const chatId = await chatSessionManager.getOrCreateChatId();
  logWidgetQuestion(config, message, mode);

  const command: WidgetCommand = { type: `chat/${mode}`, request_id: requestId, content: message };

  // send() addresses the chat id that connect() records, so connect first — on a cold first message there is none yet.
  const streamClient = StreamClient.getInstance();
  if (!streamClient.isConnected()) {
    await streamClient.connect(chatId);
  }
  await streamClient.send(command);
}
