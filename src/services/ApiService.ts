import { type InstructionType, sdk, type WidgetCommand } from '../sdk';
import { chatSessionManager } from './ChatSessionManager';
import { type CredentialedConfig, storageService } from './StorageService';
import { StreamClient } from './StreamClient';

function logWidgetQuestion(config: CredentialedConfig, question: string, mode: InstructionType): void {
  const metadata: Record<string, unknown> = {
    question,
    mode,
    chat_id: storageService.getChatId(),
    timestamp: new Date().toISOString(),
    marketrix_id: config.mtxId,
    marketrix_key: config.mtxKey,
  };

  if (config.userId) metadata.user_id = config.userId;

  sdk
    .activityLogCreate({ type: 'widget_question', metadata })
    .catch((error: unknown) => console.warn('[API Service] Failed to log widget question:', error));
}

/** The reply does not come back from here — it arrives asynchronously as a chat/response event on the stream. */
export async function chatPost(
  config: CredentialedConfig,
  message: string,
  mode: InstructionType,
  requestId: string,
): Promise<void> {
  const chatId = await chatSessionManager.getOrCreateChatId();
  logWidgetQuestion(config, message, mode);

  const command: WidgetCommand = { type: `chat/${mode}`, request_id: requestId, content: message };

  const streamClient = StreamClient.getInstance();
  await streamClient.ready(chatId);
  await streamClient.send(command);
}
