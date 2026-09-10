/**
 * Sends one visitor turn to the api. `chatPost` mints or reuses the chat id, files a `widget_question`
 * activity-log row, then POSTs a `chat/${mode}` `WidgetCommand` over the stream.
 *
 * The reply never comes back from here — it arrives asynchronously on the SSE stream as `chat/delta`
 * fragments and a final `chat/response`, matched by `request_id` (the caller's placeholder message id).
 * That is why `StreamClient.ready` must resolve BEFORE the POST: registration is what gives the reply
 * somewhere to land.
 *
 * The logged `chat_id` is read back from `storageService` rather than passed, so it is only correct
 * after `getOrCreateChatId()` has resolved and written it. `user_id` is omitted, never sent null, when
 * the host supplied no visitor identity. The activity log is telemetry and is deliberately not awaited:
 * it can neither delay nor fail the send, and a rejection warns and stops there — whereas a failed
 * `send` propagates to `ChatContext`, which renders the error turn.
 */
import { type InstructionType, sdk, type WidgetCommand } from '../sdk';
import { chatSessionManager } from './ChatSessionManager';
import { type CredentialedConfig, storageService } from './StorageService';
import { streamClient } from './StreamClient';

export async function chatPost(
  config: CredentialedConfig,
  message: string,
  mode: InstructionType,
  requestId: string,
): Promise<void> {
  const chatId = await chatSessionManager.getOrCreateChatId();

  const metadata: Record<string, unknown> = {
    question: message,
    mode,
    chat_id: storageService.getChatId(),
    timestamp: new Date().toISOString(),
    marketrix_id: config.mtxId,
    marketrix_key: config.mtxKey,
  };
  if (config.userId) metadata.user_id = config.userId;
  sdk
    .activityLogCreate({ type: 'widget_question', metadata })
    .catch((error: unknown) => console.warn('[ChatService] Failed to log widget question:', error));

  const command: WidgetCommand = { type: `chat/${mode}`, request_id: requestId, content: message };
  await streamClient.ready(chatId);
  await streamClient.send(command);
}
