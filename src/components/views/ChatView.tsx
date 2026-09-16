/**
 * The messenger panel's chat view: the scrolling transcript, the composer, and the screen-access
 * dialog that gates Show/Do.
 *
 * `ChatViewProps` are the shell's three wires — a screen-sharing flag lifted to the header, a ref the
 * shell's toolbar button fills with a share toggle, and the composer textarea ref. `MODES` pairs the
 * mode chips' display order with the tenant setting enabling each, so the composer offers only what
 * the workspace turned on. `ChatView` owns the draft text; `handleSendMessage` posts the turn and
 * `handleModeChange` announces a mode switch in the transcript before flipping state.
 *
 * The composer is locked both while a reply is outstanding and while a screen-access request is open,
 * since a second turn queued behind an unanswered permission card has nowhere to land. `use_screenshare`
 * absent means enabled; only an explicit `false` skips the ask — Show and Do request screen access first
 * unless a share is already live, and `useScreenShare` flushes the held turn on every outcome. This view
 * writes the user's bubble itself, so every dispatch from here is `skipUserMessage`. Stop tears down
 * `showModeService` before `stopTask`, since an in-flight highlight owns listeners, a watchdog and
 * injected nodes that outlive the task otherwise. `WidgetDialog` gets an explicit `finalFocusRef`
 * since Base UI's focus restore resolves to the host page inside a closed shadow root otherwise. The
 * transcript sits under its own `ErrorBoundary` so one unrenderable message can't take the composer down.
 *
 * `useScreenShare` (this file's only other consumer) owns the screen-share lifecycle: the in-transcript
 * permission card, the browser picker, the live share message, and ending a share. `useLatest` keeps a
 * value readable from a callback that must not be re-created (the polling interval below, mounted once);
 * its refs are listed in that effect's deps for the linter, but since `useRef` identity never changes,
 * listing them cannot re-arm the interval. The same idiom stabilizes `handleScreenAccessRequestAllow`/
 * `handleScreenAccessRequestDeny`: both are handed to every `MessageItem` through `MessageList`, and a
 * fresh closure each render (the naive `beginScreenShare`/inline-arrow form) defeats `MessageItem`'s
 * `React.memo` for the whole transcript on every SSE token, not just the streaming row.
 * The hook returns `requestScreenAccess` — posting a request card carrying the queued turn, no-oping if
 * one is already open — plus that card's Allow/Deny handlers, the toolbar dialog's Allow/Dismiss
 * handlers, and `toggleScreenShareRef`, a toggle stopping a live share or opening that dialog.
 * `beginScreenShare` opens the stream and posts the started/live messages; `stopScreenSharing`/
 * `announceStopped` tear it down (video message → a system line); `resolveAccessRequest` stamps
 * allowed/denied; `flushPendingMessage` sends the hold. The user can end the share from the browser's
 * own UI, which fires no subscribable event, so a 1s interval reconciles `isScreenSharingActive()`
 * against local state and announces the stop. `openRequest` is transcript-derived, not component state,
 * since the request card survives an unmount/remount because it is persisted — the resolving state must
 * be too, or the buttons stay live on a request neither Allow nor Deny can reach. Every outcome flushes
 * the pending content (a cancel resolves `denied` like a real failure), leaving no queued turn stranded.
 * `useScreenShare` is exported so `ChatView.test.tsx`'s `renderHook` cases can drive it directly.
 */
import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { useWidget, useWidgetConfig } from '../../hooks/useWidget';
import type { InstructionType } from '../../sdk';
import {
  isScreenSharing as isScreenSharingActive,
  startScreenShare,
  stopScreenShare,
} from '../../services/ScreenShareService';
import { showModeService } from '../../services/ShowModeService';
import type { ChatMessage, MarketrixConfig } from '../../types';
import {
  createScreenAccessRequestMessage,
  createScreenshareMessage,
  createSystemMessage,
  createUserMessage,
  getModeDisplayName,
  lastIndexWhere,
  SCREEN_ACCESS_PROMPT,
} from '../../utils/chat';
import { ErrorBoundary } from '../base/ErrorBoundary';
import { Stack } from '../base/Flex';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';
import { ChatInput, type ChatInputMode } from '../blocks/ChatInput';
import { WidgetDialog } from '../blocks/WidgetDialog';
import { MessageList } from '../chat/MessageList';

interface ChatViewProps {
  onScreenSharingChange: (isSharing: boolean) => void;
  toggleScreenShareRef: React.MutableRefObject<(() => void) | null>;
  messageInputRef: React.RefObject<HTMLTextAreaElement | null>;
}

const MODES: Array<{ id: InstructionType; icon: ChatInputMode['icon']; flag: keyof MarketrixConfig }> = [
  { id: 'tell', icon: 'chatBubble', flag: 'widget_feature_tell' },
  { id: 'show', icon: 'mousePointerClick', flag: 'widget_feature_show' },
  { id: 'do', icon: 'ticktick', flag: 'widget_feature_do' },
];

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

interface UseScreenShareReturn {
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

  const applySharing = (sharing: boolean) => {
    setIsScreenSharing(sharing);
    onScreenSharingChange?.(sharing);
  };

  const announceStopped = (messageId: string | null) => {
    if (messageId) onRemoveMessage?.(messageId);
    onAddMessage(createSystemMessage('Screen sharing stopped', 'stopped-sharing'));
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
  }, [announceStoppedRef, onScreenSharingChangeRef, screenShareMessageIdRef, wasSharingRef]);

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
      applySharing(true);
      resolveAccessRequest('allowed');
      onAddMessage(createSystemMessage('Screen sharing started', 'started-screenshare'));
      const screenshareMessage = createScreenshareMessage(stream, 'show');
      setScreenShareMessageId(screenshareMessage.id);
      onAddMessage(screenshareMessage);
    } catch (error) {
      console.error('Failed to start screen sharing:', error);
      applySharing(false);
      resolveAccessRequest('denied');
    }
    flushPendingMessage();
  };

  const beginScreenShareRef = useLatest(beginScreenShare);
  const handleScreenAccessRequestAllow = useCallback(() => beginScreenShareRef.current(), [beginScreenShareRef]);

  const denyScreenAccessRequest = () => {
    resolveAccessRequest('denied');
    flushPendingMessage();
  };
  const denyScreenAccessRequestRef = useLatest(denyScreenAccessRequest);
  const handleScreenAccessRequestDeny = useCallback(
    () => denyScreenAccessRequestRef.current(),
    [denyScreenAccessRequestRef],
  );

  const handleScreenAccessDialogAllow = async () => {
    setShowScreenAccessDialog(false);
    await beginScreenShare();
  };

  const handleScreenAccessDialogDismiss = () => {
    setShowScreenAccessDialog(false);
  };

  const stopScreenSharing = () => {
    stopScreenShare();
    applySharing(false);
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

export const ChatView: React.FC<ChatViewProps> = ({ onScreenSharingChange, toggleScreenShareRef, messageInputRef }) => {
  const config = useWidgetConfig();
  const { state, actions } = useWidget();
  const { currentMode, isTaskRunning, isAwaitingReply } = state;

  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    isScreenSharing,
    isAwaitingScreenAccess,
    showScreenAccessDialog,
    handleScreenAccessDialogAllow,
    handleScreenAccessDialogDismiss,
    handleScreenAccessRequestAllow,
    handleScreenAccessRequestDeny,
    requestScreenAccess,
  } = useScreenShare({
    onScreenSharingChange,
    toggleScreenShareRef,
    onAddMessage: actions.addMessage,
    onUpdateMessage: actions.updateMessage,
    onRemoveMessage: actions.removeMessage,
    onSendMessage: actions.messageDispatch,
    messages: state.messages,
  });

  const composerLocked = isAwaitingScreenAccess || isAwaitingReply;

  const handleSendMessage = () => {
    if (!inputValue.trim() || composerLocked) return;
    const messageContent = inputValue.trim();
    setInputValue('');
    actions.addMessage(createUserMessage(messageContent, currentMode));
    if (config.use_screenshare !== false && (currentMode === 'show' || currentMode === 'do') && !isScreenSharing) {
      requestScreenAccess(currentMode, messageContent);
    } else {
      void actions.messageDispatch(messageContent, currentMode, true);
    }
  };

  const handleModeChange = (mode: InstructionType) => {
    if (mode === currentMode) return;
    actions.addMessage(createSystemMessage(`Switched to ${getModeDisplayName(mode)} mode`, 'mode-change'));
    actions.setMode(mode);
  };

  return (
    <Stack height='full'>
      {showScreenAccessDialog && (
        <WidgetDialog
          open={showScreenAccessDialog}
          onClose={handleScreenAccessDialogDismiss}
          title={SCREEN_ACCESS_PROMPT}
          description='By allowing screen access, Marketrix can understand your current context to guide you better and complete tasks on your behalf.'
          onConfirm={handleScreenAccessDialogAllow}
          confirmLabel='Yes'
          cancelLabel='No'
          finalFocusRef={messageInputRef}
        />
      )}

      <Stack grow overflow='hidden' paddingY='2xs' minHeight='0'>
        <ErrorBoundary
          label='Chat'
          fallback={
            <Text as='div' size='xs' align='center' variant='muted' style={{ padding: '16px' }}>
              Something went wrong displaying messages. Please refresh.
            </Text>
          }
        >
          <MessageList
            messagesEndRef={messagesEndRef}
            onScreenAccessAllow={handleScreenAccessRequestAllow}
            onScreenAccessDeny={handleScreenAccessRequestDeny}
          />
        </ErrorBoundary>
      </Stack>

      <Surface variant='floatingCard' style={{ marginTop: 'auto' }}>
        <ChatInput
          ref={messageInputRef}
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSendMessage}
          modes={MODES.filter(({ flag }) => config[flag]).map(({ id, icon }) => ({
            id,
            icon,
            label: getModeDisplayName(id),
          }))}
          activeMode={currentMode}
          onModeChange={handleModeChange}
          disabled={composerLocked}
          taskRunning={isTaskRunning}
          onStop={() => {
            showModeService.cleanup();
            void actions.stopTask();
          }}
        />
      </Surface>
    </Stack>
  );
};
