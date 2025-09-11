import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, MarketrixConfig, ChatMode } from '../types';
import { getChatWindowClasses, getPositionClasses } from '../utils/positioning';
import { ModeSelector } from './ModeSelector';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import MarketrixLogo from '../assets/marketrix-logo.png';

interface ChatWindowProps {
  config: MarketrixConfig;
  isOpen: boolean;
  isMinimized: boolean;
  isLoading: boolean;
  messages: ChatMessage[];
  currentMode: ChatMode;
  agentAvailable: boolean;
  onClose: () => void;
  onSendMessage: (message: string, mode?: ChatMode) => void;
  onSetMode: (mode: ChatMode) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  config,
  isOpen,
  isMinimized,
  isLoading,
  messages,
  currentMode,
  onClose,
  onSendMessage,
  onSetMode,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isScreenAccessActive, setIsScreenAccessActive] = useState(false);
  const [triggerScreenAccessModal, setTriggerScreenAccessModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const theme = config.theme || 'light';

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup screen capture when component unmounts
  useEffect(() => {
    return () => {
      stopScreenCapture();
    };
  }, []);

  const handleSendMessage = () => {
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue, currentMode);
      setInputValue('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleScreenAccessResponse = async (allowed: boolean) => {
    if (allowed) {
      await startScreenCapture();
    }
  };

  const handleScreenAccessRequest = (mode: ChatMode) => {
    // Trigger the screen access modal in MessageInput
    setTriggerScreenAccessModal(true);
  };

  const handleTriggerReset = () => {
    setTriggerScreenAccessModal(false);
  };

  const handleStopScreenAccess = () => {
    setIsScreenAccessActive(false);
    stopScreenCapture();
  };

  const startScreenCapture = async () => {
    try {
      // Request screen capture permission
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      // Create overlay container
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.zIndex = '9998';
      overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      overlay.style.display = 'flex';
      overlay.style.flexDirection = 'column';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';

      // Create video element to display the screen
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.style.width = '80%';
      video.style.height = '80%';
      video.style.objectFit = 'contain';
      video.style.borderRadius = '8px';
      video.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.5)';

      // Create control bar
      const controlBar = document.createElement('div');
      controlBar.style.position = 'absolute';
      controlBar.style.top = '20px';
      controlBar.style.right = '20px';
      controlBar.style.display = 'flex';
      controlBar.style.gap = '10px';
      controlBar.style.alignItems = 'center';

      // Create status indicator
      const statusIndicator = document.createElement('div');
      statusIndicator.style.display = 'flex';
      statusIndicator.style.alignItems = 'center';
      statusIndicator.style.gap = '8px';
      statusIndicator.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
      statusIndicator.style.padding = '8px 16px';
      statusIndicator.style.borderRadius = '20px';
      statusIndicator.style.fontSize = '14px';
      statusIndicator.style.fontWeight = '500';
      statusIndicator.innerHTML = `
        <div style="width: 8px; height: 8px; background-color: #ef4444; border-radius: 50%; animation: pulse 2s infinite;"></div>
        Marketrix is monitoring your screen
      `;

      // Create stop button
      const stopButton = document.createElement('button');
      stopButton.textContent = 'Stop Monitoring';
      stopButton.style.backgroundColor = '#ef4444';
      stopButton.style.color = 'white';
      stopButton.style.border = 'none';
      stopButton.style.padding = '8px 16px';
      stopButton.style.borderRadius = '20px';
      stopButton.style.cursor = 'pointer';
      stopButton.style.fontSize = '14px';
      stopButton.style.fontWeight = '500';
      stopButton.onclick = handleStopScreenAccess;

      // Add pulse animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `;
      document.head.appendChild(style);

      // Assemble the overlay
      controlBar.appendChild(statusIndicator);
      controlBar.appendChild(stopButton);
      overlay.appendChild(video);
      overlay.appendChild(controlBar);
      document.body.appendChild(overlay);

      // Handle when user stops sharing
      stream.getVideoTracks()[0].onended = () => {
        handleStopScreenAccess();
      };

      // Store references for cleanup
      (window as any).screenCaptureStream = stream;
      (window as any).screenCaptureOverlay = overlay;

      // Only show status indicator AFTER screen is successfully shared
      setIsScreenAccessActive(true);

    } catch (error) {
      console.error('Error accessing screen:', error);
      setIsScreenAccessActive(false);
      // Show error message to user
      alert('Unable to access screen. Please check your permissions.');
    }
  };

  const stopScreenCapture = () => {
    // Stop all video tracks
    if ((window as any).screenCaptureStream) {
      (window as any).screenCaptureStream.getTracks().forEach((track: MediaStreamTrack) => {
        track.stop();
      });
    }

    // Remove overlay
    if ((window as any).screenCaptureOverlay) {
      document.body.removeChild((window as any).screenCaptureOverlay);
    }

    // Clear references
    (window as any).screenCaptureStream = null;
    (window as any).screenCaptureOverlay = null;
  };

  if (!isOpen) return null;

  const positionClasses = getPositionClasses(config.position || 'bottom-right');
  const chatWindowClasses = getChatWindowClasses(config.position || 'bottom-right');

  return (
    <div className={`fixed ${positionClasses} z-40`}>
      <div className={`
        ${chatWindowClasses} 
        ${isMinimized ? 'h-12' : 'h-[35rem]'} 
        transition-all duration-300 ease-in-out flex flex-col
        ${isOpen ? 'animate-slide-up' : 'animate-slide-down'}
        transform-gpu
        bg-gradient-to-br from-[#1BB55B26] to-[#987ADD30]
        shadow-2xl
        rounded-lg
        border border-white/20
        backdrop-blur-sm
      `}>
        {/* Header with Marketrix branding */}
        <div className={`
          flex justify-end p-2 mb-5
                  `}>

          <div className="flex items-center space-x-1 bg-white rounded-full p-0.5 absolute top-2 right-2">
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-white shadow-sm"
              aria-label="Close chat"
            >
              <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Chat Content */}
        {!isMinimized && (
          <>
            {/* Chat Messages Area */}
            <div className="flex-1 overflow-hidden">
              <MessageList
                messages={messages}
                isLoading={isLoading}
                messagesEndRef={messagesEndRef}
                onSendMessage={onSendMessage}
                onSetMode={onSetMode}
              />
            </div>

            {/* Screen Access Status Indicator */}
            {isScreenAccessActive && (
              <div className="flex items-center gap-2 px-2 mx-3 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-[#667085] font-inter">
                    Marketrix is looking at your screen
                  </span>
                </div>
                <button
                  onClick={handleStopScreenAccess}
                  className="text-xs text-[#667085] font-bold"
                >
                  Stop
                </button>
              </div>
            )}


            {/* Controls Section */}
            <div className="flex-shrink-0 rounded-lg bg-white m-3">
              {/* Input */}
              <MessageInput
                value={inputValue}
                onChange={setInputValue}
                onKeyPress={handleKeyPress}
                onSend={handleSendMessage}
                isLoading={isLoading}
                theme={theme}
                placeholder="How can I help you?"
                currentMode={currentMode}
                onScreenAccessResponse={handleScreenAccessResponse}
                triggerScreenAccessModal={triggerScreenAccessModal}
                onTriggerReset={handleTriggerReset}
              />

              {/* Mode Selector */}
              <ModeSelector
                currentMode={currentMode}
                enabledModes={config.enabledModes || ['tell', 'show', 'do']}
                onModeChange={onSetMode}
                onScreenAccessRequest={handleScreenAccessRequest}
                theme={theme}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
