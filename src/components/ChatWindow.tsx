import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, MarketrixConfig, ChatMode } from '../types';
import { getPositionClasses } from '../utils/positioning';
import { useWidgetAtmosphere } from '../hooks/useWidgetAtmosphere';
import { ModeSelector } from './ModeSelector';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ScreenSharePreview } from './ScreenSharePreview';
import { IntegrationSettings } from '../services/integrationService';

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
  onScreenSharingChange?: (isSharing: boolean) => void;
  integrationSettings?: IntegrationSettings | null;
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
  onScreenSharingChange,
  integrationSettings,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isScreenAccessActive, setIsScreenAccessActive] = useState(false);
  const [triggerScreenAccessModal, setTriggerScreenAccessModal] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [showScreenPreview, setShowScreenPreview] = useState(false);
  const [isStepGuideRunning, setIsStepGuideRunning] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Get atmosphere configuration
  const { 
    getWidgetCustomize, 
    getWidgetPosition,
    getWidgetSettings
  } = useWidgetAtmosphere(config);
  
  const widgetCustomize = getWidgetCustomize();
  const widgetPosition = getWidgetPosition();
  const atmosphereSettings = getWidgetSettings();
  
  // Use integration settings if available, otherwise fall back to atmosphere settings
  const effectiveSettings = integrationSettings || atmosphereSettings;

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
      // Check if this is a step guide request
      const message = inputValue.toLowerCase();
      const isStepGuideRequest = message.includes('show me how to') || 
                                message.includes('step by step') ||
                                message.includes('guide me through') ||
                                message.includes('walk me through') ||
                                message.includes('tutorial') ||
                                message.includes('add a new product') ||
                                message.includes('bulk import') ||
                                message.includes('setup widget') ||
                                message.includes('login') ||
                                message.includes('sign in');
      
      if (isStepGuideRequest && currentMode === 'show') {
        setIsStepGuideRunning(true);
      }
      
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
    } else {
      console.log('Screen access denied');
    }
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

      // Create a minimal status indicator without overlay
      const statusIndicator = document.createElement('div');
      statusIndicator.id = 'marketrix-screen-status';
      statusIndicator.style.position = 'fixed';
      statusIndicator.style.top = '20px';
      statusIndicator.style.left = '20px';
      statusIndicator.style.zIndex = '9999';
      statusIndicator.style.display = 'flex';
      statusIndicator.style.alignItems = 'center';
      statusIndicator.style.gap = '8px';
      statusIndicator.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
      statusIndicator.style.padding = '8px 16px';
      statusIndicator.style.borderRadius = '20px';
      statusIndicator.style.fontSize = '14px';
      statusIndicator.style.fontWeight = '500';
      statusIndicator.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
      statusIndicator.style.border = '1px solid rgba(0, 0, 0, 0.1)';
      statusIndicator.innerHTML = `
        <div style="width: 8px; height: 8px; background-color: #ef4444; border-radius: 50%; animation: pulse 2s infinite;"></div>
        Marketrix is monitoring your screen
        <button id="marketrix-stop-btn" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 12px; cursor: pointer; font-size: 12px; margin-left: 8px;">Stop</button>
      `;

      // Add pulse animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `;
      document.head.appendChild(style);

      // Add the status indicator to the page
      document.body.appendChild(statusIndicator);

      // Add click handler for stop button
      const stopBtn = document.getElementById('marketrix-stop-btn');
      if (stopBtn) {
        stopBtn.onclick = () => {
          stopScreenCapture();
          setIsScreenAccessActive(false);
        };
      }

      // Handle when user stops sharing
      stream.getVideoTracks()[0].onended = () => {
        stopScreenCapture();
        setIsScreenAccessActive(false);
      };

      // Store references for cleanup
      (window as any).screenCaptureStream = stream;
      (window as any).screenCaptureOverlay = statusIndicator;

      // Set screen stream and show preview
      setScreenStream(stream);
      setShowScreenPreview(true);
      setIsScreenAccessActive(true);
      
      // Notify parent component about screen sharing state
      onScreenSharingChange?.(true);

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

    // Remove status indicator
    const statusIndicator = document.getElementById('marketrix-screen-status');
    if (statusIndicator) {
      document.body.removeChild(statusIndicator);
    }

    // Clear references and state
    (window as any).screenCaptureStream = null;
    (window as any).screenCaptureOverlay = null;
    setScreenStream(null);
    setShowScreenPreview(false);
    
    // Notify parent component about screen sharing state
    onScreenSharingChange?.(false);
  };

  const handleScreenAccessRequest = (_mode: ChatMode) => {
    // Trigger the screen access modal in MessageInput
    setTriggerScreenAccessModal(true);
  };

  const handleTriggerReset = () => {
    setTriggerScreenAccessModal(false);
  };

  const handleStopStepGuide = () => {
    // Import the demo API service to stop the step guide
    import('../services/demo-api').then(({ default: DemoApiService }) => {
      // Create a temporary instance to access the stop method
      const demoApi = new DemoApiService(config);
      demoApi.stopStepGuide();
      setIsStepGuideRunning(false);
    });
  };



  // Get widget settings for positioning
  // Convert underscore to hyphen for position (API returns bottom_right, but CSS expects bottom-right)
  const rawPosition = effectiveSettings.widget_position || 'bottom-right';
  const effectivePosition = rawPosition.replace('_', '-') as 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  const positionClasses = getPositionClasses(effectivePosition);

  if (!isOpen) return null;

  // Apply custom styling from integration settings or atmosphere settings
  const customStyles = {
    width: effectiveSettings.widget_width || widgetCustomize.sizes?.width || '320px',
    height: isMinimized ? '48px' : (effectiveSettings.widget_height || widgetCustomize.sizes?.height || '35rem'),
    borderRadius: effectiveSettings.widget_border_radius || widgetCustomize.sizes?.border_radius || '12px',
    fontSize: effectiveSettings.widget_font_size || widgetCustomize.sizes?.font_size || '14px',
    background: effectiveSettings.widget_background_color || widgetCustomize.colors?.background || 'white',
    color: effectiveSettings.widget_text_color || widgetCustomize.colors?.text || '#333333',
    borderColor: effectiveSettings.widget_border_color || widgetCustomize.colors?.border || 'rgba(255, 255, 255, 0.2)',
    boxShadow: effectiveSettings.widget_shadow || '0 10px 25px rgba(0, 0, 0, 0.1)',
    zIndex: widgetPosition.z_index || 40,
  } as React.CSSProperties;

  return (
    <div className={`fixed bg-white rounded-xl ${positionClasses}`} style={{ zIndex: widgetPosition.z_index || 40 }}>
      <div 
        className={`
          bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700
          w-[360px] max-w-sm
          ${isMinimized ? 'h-12' : 'h-[35rem]'} 
          transition-all duration-300 ease-in-out flex flex-col
          ${isOpen ? 'animate-slide-up' : 'animate-slide-down'}
          transform-gpu
          shadow-2xl
          backdrop-blur-sm
          scrollbar-thin scrollbar-track-[#f6f6f6] scrollbar-thumb-[#b6b6b6]
        `}
        style={{
          ...customStyles,
          scrollbarColor: '#f6f6f6 #b6b6b6',
          scrollbarWidth: 'thin'
        }}
      >
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
                config={config}
                onStepGuideStart={() => setIsStepGuideRunning(true)}
                integrationSettings={integrationSettings}
              />
            </div>

            {/* Screen Access Status Indicator */}
            {isScreenAccessActive && (
              <div className="flex items-center gap-2 px-2 mx-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-[#667085] font-inter">
                    Marketrix is looking at your screen
                  </span>
                </div>
                <button
                  onClick={() => {
                    stopScreenCapture();
                    setIsScreenAccessActive(false);
                  }}
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
                config={config}
                onScreenAccessResponse={handleScreenAccessResponse}
                triggerScreenAccessModal={triggerScreenAccessModal}
                onTriggerReset={handleTriggerReset}
                isStepGuideRunning={isStepGuideRunning}
                onStopStepGuide={handleStopStepGuide}
              />

              {/* Mode Selector */}
              <ModeSelector
                currentMode={currentMode}
                enabledModes={config.enabledModes || ['tell', 'show', 'do']}
                onModeChange={onSetMode}
                onScreenAccessRequest={handleScreenAccessRequest}
              />
            </div>
          </>
        )}
      </div>

      {/* Screen Share Preview */}
      <ScreenSharePreview
        stream={screenStream}
        isVisible={showScreenPreview}
        onClose={() => {
          stopScreenCapture();
          setIsScreenAccessActive(false);
        }}
      />
    </div>
  );
};
