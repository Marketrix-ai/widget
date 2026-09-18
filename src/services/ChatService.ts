/**
 * Sends one visitor turn to the api. `chatPost` mints or reuses the chat id, then posts a
 * `chat/${mode}` command over the stream.
 *
 * The reply itself never comes back from here — it arrives later on the SSE stream as `chat/delta`
 * fragments and a final `chat/response`, matched by the request id. The stream must already be
 * registered before the post, or the reply has nowhere to land.
 */
import type { InstructionType, WidgetCommand } from '../sdk';
import { chatSessionManager } from './ChatSessionManager';
import { streamClient } from './StreamClient';

export async function chatPost(message: string, mode: InstructionType, requestId: string): Promise<void> {
  const chatId = await chatSessionManager.getOrCreateChatId();

  const command: WidgetCommand = { type: `chat/${mode}`, request_id: requestId, content: message };
  await streamClient.ready(chatId);
  await streamClient.send(command);
}
