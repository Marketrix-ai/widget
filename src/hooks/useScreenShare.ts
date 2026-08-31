import { useEffect, useImperativeHandle, useRef, useState } from 'react';

import type { InstructionType } from '../sdk';
import {
  createScreenAccessRequestMessage,
  createScreenshareMessage,
  createSystemMessage,
} from '../services/ChatService';
import {
  isScreenSharing as isScreenSharingActive,
  startScreenShare,
  stopScreenShare,
} from '../services/ScreenShareService';
import type { ChatMessage } from '../types';

/** Keeps a value readable from a callback that must not be re-created (the polling interval, mounted once). */
function useLatest<T>(value: T): React.RefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

export interface PendingMessage {
  content: string;
  mode?: InstructionType;
  alreadyAdded?: boolean;
}

export interface UseScreenShareOptions {
  onScreenSharingChange?: (isSharing: boolean) => void;
  onStartScreenShareRef?: React.MutableRefObject<(() => void) | null>;
  onStopScreenShareRef?: React.MutableRefObject<(() => void) | null>;
  onAddMessage: (message: ChatMessage) => void;
  onUpdateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  onRemoveMessage?: (messageId: string) => void;
  onSendMessage: (message: string, mode?: InstructionType, skipUserMessage?: boolean) => void;
  pendingMessage: PendingMessage | null;
  setPendingMessage: (message: PendingMessage | null) => void;
}

export interface UseScreenShareReturn {
  isScreenSharing: boolean;
  showScreenAccessDialog: boolean;
  handleScreenAccessDialogAllow: () => Promise<void>;
  handleScreenAccessDialogDeny: () => void;
  handleScreenAccessAllow: () => Promise<void>;
  handleScreenAccessDeny: () => void;
  requestScreenAccess: (mode: InstructionType) => void;
}

export function useScreenShare({
  onScreenSharingChange,
  onStartScreenShareRef,
  onStopScreenShareRef,
  onAddMessage,
  onUpdateMessage,
  onRemoveMessage,
  onSendMessage,
  pendingMessage,
  setPendingMessage,
}: UseScreenShareOptions): UseScreenShareReturn {
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareMessageId, setScreenShareMessageId] = useState<string | null>(null);
  const [screenAccessRequestMessageId, setScreenAccessRequestMessageId] = useState<string | null>(null);
  const [showScreenAccessDialog, setShowScreenAccessDialog] = useState(false);

  const wasSharingRef = useLatest(isScreenSharing);
  const screenShareMessageIdRef = useLatest(screenShareMessageId);
  const onAddMessageRef = useLatest(onAddMessage);
  const onRemoveMessageRef = useLatest(onRemoveMessage);
  const onScreenSharingChangeRef = useLatest(onScreenSharingChange);

  const announceStopped = (messageId: string | null) => {
    if (messageId) onRemoveMessageRef.current?.(messageId);
    onAddMessageRef.current(createSystemMessage('Stopped screenshare', 'show', 'user', 'stopped-sharing'));
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

  const requestScreenAccess = (mode: InstructionType) => {
    if (screenAccessRequestMessageId) return;
    const screenAccessRequestMessage = createScreenAccessRequestMessage(mode);
    setScreenAccessRequestMessageId(screenAccessRequestMessage.id);
    onAddMessage(screenAccessRequestMessage);
  };

  const handleStartScreenShare = () => {
    setShowScreenAccessDialog(true);
  };

  const flushPendingMessage = () => {
    if (!pendingMessage) return;
    const message = pendingMessage;
    setPendingMessage(null);
    onSendMessage(message.content, message.mode, message.alreadyAdded);
  };

  const resolveAccessRequest = (screenShareStatus: 'allowed' | 'denied') => {
    if (!screenAccessRequestMessageId) return;
    onUpdateMessage(screenAccessRequestMessageId, { screenShareStatus });
    setScreenAccessRequestMessageId(null);
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

  const handleScreenAccessAllow = beginScreenShare;

  const handleScreenAccessDialogAllow = async () => {
    setShowScreenAccessDialog(false);
    await beginScreenShare();
  };

  const handleScreenAccessDialogDeny = () => {
    setShowScreenAccessDialog(false);
  };

  const handleScreenAccessDeny = () => {
    resolveAccessRequest('denied');
    flushPendingMessage();
  };

  const stopScreenSharing = () => {
    stopScreenShare();
    setIsScreenSharing(false);
    onScreenSharingChange?.(false);
    announceStopped(screenShareMessageId);
  };

  useImperativeHandle(onStartScreenShareRef, () => handleStartScreenShare);
  useImperativeHandle(onStopScreenShareRef, () => stopScreenSharing);

  return {
    isScreenSharing,
    showScreenAccessDialog,
    handleScreenAccessDialogAllow,
    handleScreenAccessDialogDeny,
    handleScreenAccessAllow,
    handleScreenAccessDeny,
    requestScreenAccess,
  };
}
