/**
 * Page Lifecycle Hook
 *
 * Handles page unload, visibility changes, and storage synchronization.
 * Ensures screen sharing is properly stopped and chat context is saved.
 */

import { useEffect } from 'react';

import { chatService, createSystemMessage } from '../services/ChatService';
import { isScreenSharing, stopScreenShare } from '../services/ScreenShareService';
import type { WidgetState } from '../types';

/**
 * Hook for managing page lifecycle events
 */
export function usePageLifecycle(stateRef: React.RefObject<WidgetState>) {
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
    };

    window.addEventListener('beforeunload', handlePageUnload);
    window.addEventListener('pagehide', handlePageUnload);

    const handleVisibilityChange = () => {
      if (document.hidden && isScreenSharing()) {
        handlePageUnload();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handlePageUnload);
      window.removeEventListener('pagehide', handlePageUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [stateRef]);
}
