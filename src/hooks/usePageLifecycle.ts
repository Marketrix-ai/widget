/**
 * Page Lifecycle Hook
 *
 * Handles page unload, visibility changes, and storage synchronization.
 * Ensures screen sharing is properly stopped and chat context is saved.
 */

import { useEffect } from 'react';

import { chatService, createSystemMessage } from '../services/features/ChatService';
import { isScreenSharing, stopScreenShare } from '../services/features/screenShareService';
import type { WidgetState } from '../types';

/**
 * Hook for managing page lifecycle events
 */
export function usePageLifecycle(
  stateRef: React.MutableRefObject<WidgetState>,
  restoreChatContext: (chatId: string) => void
) {
  useEffect(() => {
    const handlePageUnload = () => {
      // Screen sharing cleanup
      if (isScreenSharing()) {
        stopScreenShare();

        const currentState = stateRef.current;
        const messagesWithoutScreenshare = currentState.messages.filter((msg) => !msg.videoStream);

        const hasStoppedMessage = messagesWithoutScreenshare.some(
          (msg) =>
            msg.id === 'screenshare-stopped' ||
            (msg.isSystemMessage && msg.content === 'Stopped screenshare')
        );

        if (!hasStoppedMessage) {
          const stoppedMessage = createSystemMessage(
            'Stopped screenshare',
            'show',
            'user',
            'screenshare-stopped'
          );
          // Directly add to service to ensure it's persisted
          chatService.addMessage(stoppedMessage);
        }
      }

      // Force persist state
      // ChatService persists on addMessage, but we might want to force save everything
      // chatService.persistState(); // Private method, but addMessage triggers it.
    };

    window.addEventListener('beforeunload', handlePageUnload);
    window.addEventListener('pagehide', handlePageUnload);

    const handleVisibilityChange = () => {
      if (document.hidden && isScreenSharing()) {
        handlePageUnload();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Storage sync listener
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'marketrix_chat_context' && e.newValue) {
        // Trigger restore if needed
        // restoreChatContext(chatId);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('beforeunload', handlePageUnload);
      window.removeEventListener('pagehide', handlePageUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [stateRef, restoreChatContext]);
}
