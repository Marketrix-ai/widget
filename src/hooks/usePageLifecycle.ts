/**
 * Page Lifecycle Hook
 *
 * Handles page unload, visibility changes, and storage synchronization.
 * Ensures screen sharing is properly stopped and chat context is saved.
 */

import { useEffect } from 'react';

import { isScreenSharing, stopScreenShare } from '../services/screenShareService';
import type { WidgetState } from '../types';
import { CHAT_CONTEXT_STORAGE_KEY, storeChatContext } from '../utils/chatStorage';
import { initializationState } from '../utils/initializationState';
import { createLogger } from '../utils/logger';
import { createSystemMessage } from '../utils/messageFactory';

const log = createLogger('PageLifecycle');

/**
 * Hook for managing page lifecycle events
 */
export function usePageLifecycle(
  stateRef: React.MutableRefObject<WidgetState>,
  restoreChatContext: (chatId: string) => void
) {
  useEffect(() => {
    const handlePageUnload = () => {
      const chatId = initializationState.getChatId();
      if (!chatId) {
        return;
      }

      // Get current state synchronously using ref to access latest state
      // Since setState is async, we use the ref to get the most recent state
      const currentState = stateRef.current;

      // Check if screen sharing is active
      if (isScreenSharing()) {
        log.debug('Page unloading, stopping screen share and preserving chat history');

        // Stop screen sharing
        stopScreenShare();

        // Remove screenshare messages (with videoStream) but keep ALL other messages
        const messagesWithoutScreenshare = currentState.messages.filter((msg) => !msg.videoStream);

        // Check if "Stopped screenshare" message already exists to avoid duplicates
        const hasStoppedMessage = messagesWithoutScreenshare.some(
          (msg) =>
            msg.id === 'screenshare-stopped' ||
            (msg.isSystemMessage && msg.content === 'Stopped screenshare')
        );

        // Only add the message if it doesn't already exist
        let updatedMessages = messagesWithoutScreenshare;
        if (!hasStoppedMessage) {
          // Add "Stopped screenshare" message to chat history (append, don't replace)
          const stoppedMessage = createSystemMessage(
            'Stopped screenshare',
            'show',
            'user',
            'screenshare-stopped'
          );
          updatedMessages = [...messagesWithoutScreenshare, stoppedMessage];
        }

        // Save the updated state synchronously BEFORE page unloads
        // This is critical for form submits which navigate very quickly
        try {
          storeChatContext(
            chatId,
            updatedMessages,
            currentState.isTaskRunning,
            currentState.activeTaskId,
            currentState.taskProgress,
            currentState.currentMode,
            currentState.isOpen,
            currentState.isMinimized
          );
          log.debug('Saved chat context with stopped screenshare message on page unload');
        } catch (error) {
          log.warn('Failed to save chat context on page unload:', error);
        }

        // Also update stateRef so if there's any delay, the ref has the latest state
        stateRef.current = {
          ...currentState,
          messages: updatedMessages,
        };
      } else {
        // No screenshare active, just save current state
        try {
          storeChatContext(
            chatId,
            currentState.messages,
            currentState.isTaskRunning,
            currentState.activeTaskId,
            currentState.taskProgress,
            currentState.currentMode,
            currentState.isOpen,
            currentState.isMinimized
          );
          log.debug('Saved chat context on page unload');
        } catch (error) {
          log.warn('Failed to save chat context on page unload:', error);
        }
      }
    };

    // Listen to page lifecycle events
    // Use both beforeunload (fires earlier, gives more time) and pagehide (more reliable for cached pages)
    // beforeunload fires when navigation starts, giving us time to save before page unloads
    // pagehide is more reliable for cached pages and mobile browsers
    window.addEventListener('beforeunload', handlePageUnload);
    window.addEventListener('pagehide', handlePageUnload);

    // Also handle visibility change (when tab becomes hidden)
    // This catches cases where the page is hidden but not unloaded
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Save state when page becomes hidden (especially important for screenshare tasks)
        const chatId = initializationState.getChatId();
        if (chatId) {
          try {
            const currentState = stateRef.current;
            storeChatContext(
              chatId,
              currentState.messages,
              currentState.isTaskRunning,
              currentState.activeTaskId,
              currentState.taskProgress,
              currentState.currentMode,
              currentState.isOpen,
              currentState.isMinimized
            );
            log.debug('Saved chat context on visibility change (page hidden)');
          } catch (error) {
            log.warn('Failed to save chat context on visibility change:', error);
          }
        }

        // If screenshare is active, also handle stopping it
        if (isScreenSharing()) {
          log.debug('Page hidden, stopping screen share and adding message');
          handlePageUnload();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Handle storage events from other tabs/windows
    // This allows state to be synchronized across multiple tabs
    const handleStorageChange = (e: StorageEvent) => {
      // Only handle our storage key
      if (e.key === CHAT_CONTEXT_STORAGE_KEY && e.newValue) {
        try {
          const updatedContext = JSON.parse(e.newValue);
          const currentChatId = initializationState.getChatId();

          // If the updated context is for the same chat ID, restore it
          if (updatedContext.chat_id === currentChatId && currentChatId) {
            log.debug('Storage updated from another tab, restoring context');
            restoreChatContext(currentChatId);
          }
        } catch (error) {
          log.warn('Failed to parse storage event data:', error);
        }
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
