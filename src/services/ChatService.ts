/**
 * Sends one visitor turn to the api. `chatPost` mints or reuses the chat id, then POSTs a
 * `chat/${mode}` `WidgetCommand` over the stream.
 *
 * The reply never comes back from here — it arrives asynchronously on the SSE stream as `chat/delta`
 * fragments and a final `chat/response`, matched by `request_id` (the caller's placeholder message id).
 * That is why `StreamClient.ready` must resolve BEFORE the POST: registration is what gives the reply
 * somewhere to land.
 *
 * `ChatService` never files the `widget_question` activity-log row itself: `StreamClient` sends `user_id`
 * once, at `widgetStream` registration, and the api derives the row from `chat_id`'s bound application on
 * every Tell/Show/Do command, so no per-message credential re-send is needed here.
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
