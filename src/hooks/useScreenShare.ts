import { useEffect, useImperativeHandle, useRef, useState } from 'react';

import type { InstructionType } from '../sdk';
import {
  isScreenSharing as isScreenSharingActive,
  startScreenShare,
  stopScreenShare,
} from '../services/ScreenShareService';
import type { ChatMessage } from '../types';
import {
  createScreenAccessRequestMessage,
  createScreenshareMessage,
  createSystemMessage,
  lastIndexWhere,
} from '../utils/chat';

/** Keeps a value readable from a callback that must not be re-created (the polling interval, mounted once). */
function useLatest<T>(value: T): React.RefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

export interface UseScreenShareOptions {
  onScreenSharingChange?: (isSharing: boolean) => void;
  toggleScreenShareRef?: React.MutableRefObject<(() => void) | null>;
  onAddMessage: (message: ChatMessage) => void;
  onUpdateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  onRemoveMessage?: (messageId: string) => void;
  onSendMessage: (message: string, mode?: InstructionType, skipUserMessage?: boolean) => void;
  messages: ChatMessage[];
}

export interface UseScreenShareReturn {
  isScreenSharing: boolean;
  isAwaitingScreenAccess: boolean;
  showScreenAccessDialog: boolean;
  handleScreenAccessDialogAllow: () => Promise<void>;
  handleScreenAccessDialogDismiss: () => void;
  handleScreenAccessRequestAllow: () => Promise<void>;
  handleScreenAccessRequestDeny: () => void;
  requestScreenAccess: (mode: InstructionType, content: string) => void;
}

export function useScreenShare({
  onScreenSharingChange,
  toggleScreenShareRef,
  onAddMessage,
  onUpdateMessage,
  onRemoveMessage,
  onSendMessage,
  messages,
}: UseScreenShareOptions): UseScreenShareReturn {
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareMessageId, setScreenShareMessageId] = useState<string | null>(null);
  const [showScreenAccessDialog, setShowScreenAccessDialog] = useState(false);

  const wasSharingRef = useLatest(isScreenSharing);
  const screenShareMessageIdRef = useLatest(screenShareMessageId);
  const onScreenSharingChangeRef = useLatest(onScreenSharingChange);

  const announceStopped = (messageId: string | null) => {
    if (messageId) onRemoveMessage?.(messageId);
    onAddMessage(createSystemMessage('Stopped screenshare', 'show', 'user', 'stopped-sharing'));
    setScreenShareMessageId(null);
  };
  const announceStoppedRef = useLatest(announceStopped);

  // The user can end the share from the browser's own UI, which fires no event we can subscribe to.
  useEffect(() => {
    const checkScreenSharing = () => {
      const isSharing = isScreenSharingActive();
      const wasSharing = wasSharingRef.current;
      const currentMessageId = screenShareMessageIdRef.current;
      if (isSharing !== wasSharing) {
        wasSharingRef.current = isSharing;
        setIsScreenSharing(isSharing);
        onScreenSharingChangeRef.current?.(isSharing);
      }
      if (wasSharing && !isSharing && currentMessageId) {
        announceStoppedRef.current(currentMessageId);
      }
    };
    checkScreenSharing();
    const interval = setInterval(checkScreenSharing, 1000);
    return () => clearInterval(interval);
  }, []);

  // Transcript-derived, not component state: the request card survives an unmount/remount (tab switch,
  // panel close) because it is persisted, so the resolving state has to be too, or the buttons stay live
  // on a request neither Allow nor Deny can reach anymore.
  const openRequest =
    messages[lastIndexWhere(messages, msg => !!msg.isScreenAccessRequest && !msg.screenShareStatus)] ?? null;

  const requestScreenAccess = (mode: InstructionType, content: string) => {
    if (openRequest) return;
    onAddMessage(createScreenAccessRequestMessage(mode, content));
  };

  const flushPendingMessage = () => {
    if (!openRequest?.pendingContent) return;
    onSendMessage(openRequest.pendingContent, openRequest.mode, true);
  };

  const resolveAccessRequest = (screenShareStatus: 'allowed' | 'denied') => {
    if (!openRequest) return;
    onUpdateMessage(openRequest.id, { screenShareStatus });
  };

  const beginScreenShare = async () => {
    try {
      const stream = await startScreenShare();
      setIsScreenSharing(true);
      onScreenSharingChange?.(true);
      resolveAccessRequest('allowed');
      onAddMessage(createSystemMessage('Started screenshare', 'show', 'user', 'started-screenshare'));
      const screenshareMessage = createScreenshareMessage(stream, 'show');
      setScreenShareMessageId(screenshareMessage.id);
      onAddMessage(screenshareMessage);
    } catch (error) {
      console.error('Failed to start screen sharing:', error);
      setIsScreenSharing(false);
      onScreenSharingChange?.(false);
      resolveAccessRequest('denied');
    }
    flushPendingMessage();
  };

  const handleScreenAccessRequestAllow = beginScreenShare;

  const handleScreenAccessRequestDeny = () => {
    resolveAccessRequest('denied');
    flushPendingMessage();
  };

  const handleScreenAccessDialogAllow = async () => {
    setShowScreenAccessDialog(false);
    await beginScreenShare();
  };

  const handleScreenAccessDialogDismiss = () => {
    setShowScreenAccessDialog(false);
  };

  const stopScreenSharing = () => {
    stopScreenShare();
    setIsScreenSharing(false);
    onScreenSharingChange?.(false);
    announceStopped(screenShareMessageId);
  };

  useImperativeHandle(toggleScreenShareRef, () => () => {
    if (isScreenSharing) stopScreenSharing();
    else setShowScreenAccessDialog(true);
  });

  return {
    isScreenSharing,
    isAwaitingScreenAccess: openRequest !== null,
    showScreenAccessDialog,
    handleScreenAccessDialogAllow,
    handleScreenAccessDialogDismiss,
    handleScreenAccessRequestAllow,
    handleScreenAccessRequestDeny,
    requestScreenAccess,
  };
}
