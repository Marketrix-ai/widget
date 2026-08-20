import { useEffect, useRef, useState } from 'react';

import type { InstructionType } from '../sdk';
import {
  createScreenAccessRequestMessage,
  createScreenshareMessage,
  createStartedScreenshareMessage,
  createSystemMessage,
} from '../services/ChatService';
import {
  isScreenSharing as isScreenSharingActive,
  startScreenShare,
  stopScreenShare,
} from '../services/ScreenShareService';
import type { ChatMessage } from '../types';

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
  screenStream: MediaStream | null;
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
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [screenShareMessageId, setScreenShareMessageId] = useState<string | null>(null);
  const [screenAccessRequestMessageId, setScreenAccessRequestMessageId] = useState<string | null>(null);
  const [showScreenAccessDialog, setShowScreenAccessDialog] = useState(false);

  const wasSharingRef = useRef(isScreenSharing);
  const screenShareMessageIdRef = useRef(screenShareMessageId);
  const onAddMessageRef = useRef(onAddMessage);
  const onRemoveMessageRef = useRef(onRemoveMessage);
  const onScreenSharingChangeRef = useRef(onScreenSharingChange);

  useEffect(() => {
    wasSharingRef.current = isScreenSharing;
  }, [isScreenSharing]);

  useEffect(() => {
    screenShareMessageIdRef.current = screenShareMessageId;
  }, [screenShareMessageId]);

  useEffect(() => {
    onAddMessageRef.current = onAddMessage;
  }, [onAddMessage]);

  useEffect(() => {
    onRemoveMessageRef.current = onRemoveMessage;
  }, [onRemoveMessage]);

  useEffect(() => {
    onScreenSharingChangeRef.current = onScreenSharingChange;
  }, [onScreenSharingChange]);

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
        onRemoveMessageRef.current?.(currentMessageId);
        const stoppedMessage = createSystemMessage('Stopped screenshare', 'show', 'user', 'stopped-sharing');
        onAddMessageRef.current(stoppedMessage);
        setScreenShareMessageId(null);
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

  const handleScreenAccessDialogAllow = async () => {
    setShowScreenAccessDialog(false);
    try {
      const stream = await startScreenShare();
      setIsScreenSharing(true);
      setScreenStream(stream);
      onScreenSharingChange?.(true);
      const startedMessage = createStartedScreenshareMessage('show');
      onAddMessage(startedMessage);
      const screenshareMessage = createScreenshareMessage(stream, 'show');
      setScreenShareMessageId(screenshareMessage.id);
      onAddMessage(screenshareMessage);
    } catch (error) {
      console.error('Failed to start screen sharing:', error);
      setIsScreenSharing(false);
      setScreenStream(null);
      onScreenSharingChange?.(false);
    }
  };

  const handleScreenAccessDialogDeny = () => {
    setShowScreenAccessDialog(false);
  };

  const handleScreenAccessAllow = async () => {
    try {
      const stream = await startScreenShare();
      setIsScreenSharing(true);
      setScreenStream(stream);
      onScreenSharingChange?.(true);
      if (screenAccessRequestMessageId) {
        onUpdateMessage(screenAccessRequestMessageId, { screenShareStatus: 'allowed' });
        setScreenAccessRequestMessageId(null);
      }
      const startedMessage = createStartedScreenshareMessage('show');
      onAddMessage(startedMessage);
      const screenshareMessage = createScreenshareMessage(stream, 'show');
      setScreenShareMessageId(screenshareMessage.id);
      onAddMessage(screenshareMessage);
      if (pendingMessage) {
        const message = pendingMessage;
        setPendingMessage(null);
        onSendMessage(message.content, message.mode, message.alreadyAdded);
      }
    } catch (error) {
      console.error('Failed to start screen sharing:', error);
      setIsScreenSharing(false);
      setScreenStream(null);
      onScreenSharingChange?.(false);
      if (screenAccessRequestMessageId) {
        onUpdateMessage(screenAccessRequestMessageId, { screenShareStatus: 'denied' });
        setScreenAccessRequestMessageId(null);
      }
      if (pendingMessage) {
        const message = pendingMessage;
        setPendingMessage(null);
        onSendMessage(message.content, message.mode, message.alreadyAdded);
      }
    }
  };

  const handleScreenAccessDeny = () => {
    if (screenAccessRequestMessageId) {
      onUpdateMessage(screenAccessRequestMessageId, { screenShareStatus: 'denied' });
      setScreenAccessRequestMessageId(null);
    }
    if (pendingMessage) {
      const message = pendingMessage;
      setPendingMessage(null);
      onSendMessage(message.content, message.mode, message.alreadyAdded);
    }
  };

  const stopScreenSharing = () => {
    stopScreenShare();
    setIsScreenSharing(false);
    setScreenStream(null);
    onScreenSharingChange?.(false);
    if (screenShareMessageId && onRemoveMessage) {
      onRemoveMessage(screenShareMessageId);
    }
    const stoppedMessage = createSystemMessage('Stopped screenshare', 'show', 'user', 'stopped-sharing');
    onAddMessage(stoppedMessage);
    setScreenShareMessageId(null);
  };

  useEffect(() => {
    if (onStartScreenShareRef) onStartScreenShareRef.current = handleStartScreenShare;
    if (onStopScreenShareRef) onStopScreenShareRef.current = stopScreenSharing;
    return () => {
      if (onStartScreenShareRef) onStartScreenShareRef.current = null;
      if (onStopScreenShareRef) onStopScreenShareRef.current = null;
    };
  });

  return {
    isScreenSharing,
    screenStream,
    showScreenAccessDialog,
    handleScreenAccessDialogAllow,
    handleScreenAccessDialogDeny,
    handleScreenAccessAllow,
    handleScreenAccessDeny,
    requestScreenAccess,
  };
}
