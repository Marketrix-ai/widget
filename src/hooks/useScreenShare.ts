/**
 * Screen-share lifecycle for the widget chat: the in-transcript permission card, the browser picker,
 * the live share message, and ending a share.
 *
 * `useLatest` keeps a value readable from a callback that must not be re-created (the polling interval
 * below, mounted once). `UseScreenShareOptions`/`UseScreenShareReturn` are the hook's props and surface.
 * `useScreenShare` owns the sharing state and returns `requestScreenAccess` — which posts a request card
 * carrying the turn the composer just queued, and no-ops while one is already open — plus that card's
 * Allow/Deny handlers and the toolbar dialog's Allow/Dismiss handlers; `toggleScreenShareRef` receives a
 * toggle that stops a live share or opens that dialog. Internally: `beginScreenShare` opens the stream
 * and posts the started/live messages, `stopScreenSharing` and `announceStopped` tear the share down
 * (dropping the live video message for a system line), `resolveAccessRequest` stamps the open card
 * allowed or denied, and `flushPendingMessage` sends whatever that card was holding.
 *
 * - The user can end the share from the browser's own UI, which fires no event we can subscribe to, so a
 *   1s interval reconciles `isScreenSharingActive()` against local state and announces the stop.
 * - `openRequest` is transcript-derived, not component state: the request card survives an
 *   unmount/remount (tab switch, panel close) because it is persisted, so the resolving state has to be
 *   too, or the buttons stay live on a request neither Allow nor Deny can reach anymore.
 * - Every outcome flushes the pending content — allowed, denied, or a rejected picker, where a user
 *   cancel is indistinguishable from a real failure and so resolves `denied` — leaving no queued turn
 *   stranded. It goes out with `skipUserMessage` because ChatView writes the user's bubble before it
 *   asks for access.
 */
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
    onAddMessage(createSystemMessage('Stopped screenshare', 'stopped-sharing'));
    setScreenShareMessageId(null);
  };
  const announceStoppedRef = useLatest(announceStopped);

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
      onAddMessage(createSystemMessage('Started screenshare', 'started-screenshare'));
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
