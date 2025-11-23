import React, { useState } from 'react';

import { useWidget } from '../hooks/useWidget';
import type { MarketrixConfig } from '../types';
import { ChatWindow } from './chat/ChatWindow';
import { WidgetButton } from './layout/WidgetButton';
import { ErrorDisplay } from './ui/ErrorDisplay';

interface MarketrixWidgetProps {
  config: MarketrixConfig;
}

// Error Boundary for ChatWindow
class WidgetErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Widget Error Boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return null; // Fail gracefully by rendering nothing instead of crashing
    }

    return this.props.children;
  }
}

export const MarketrixWidget: React.FC<MarketrixWidgetProps> = ({ config }) => {
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const { state, actions, marketrixConfig, shouldShow, getWidgetPosition, settings } = useWidget({
    config,
  });

  if (!shouldShow || !settings.widget_enabled) {
    return null;
  }

  const effectiveConfig = marketrixConfig || config;
  const widgetPosition = getWidgetPosition();
  const customStyles = {
    '--widget-width': settings.widget_width,
    '--widget-height': settings.widget_height,
    '--widget-border-radius': settings.widget_border_radius,
    '--widget-font-size': settings.widget_font_size,
    '--widget-primary-color': settings.widget_accent_color,
    '--widget-secondary-color': settings.widget_secondary_color,
    '--widget-background': settings.widget_background_color,
    '--widget-text-color': settings.widget_text_color,
    '--widget-border-color': settings.widget_border_color,
    '--widget-z-index': widgetPosition.z_index ?? 40,
    '--widget-shadow': settings.widget_shadow,
    '--widget-animation-duration': settings.widget_animation_duration,
    '--widget-fade-duration': settings.widget_fade_duration,
  } as React.CSSProperties;

  return (
    <div
      className='marketrix-widget relative'
      style={customStyles}
      data-widget-mode={settings?.widget_feature_human ? 'hybrid' : 'ai'}
    >
      <WidgetButton
        config={effectiveConfig}
        onClick={actions.toggleWidget}
        isOpen={state.isOpen}
        isMinimized={state.isMinimized}
        isScreenSharing={isScreenSharing}
      />

      <WidgetErrorBoundary>
        <ChatWindow
          config={effectiveConfig}
          isOpen={state.isOpen}
          isMinimized={state.isMinimized}
          isLoading={state.isLoading}
          messages={state.messages}
          currentMode={state.currentMode}
          agentAvailable={state.agentAvailable}
          isTaskRunning={state.isTaskRunning}
          taskProgress={state.taskProgress}
          onClose={actions.closeWidget}
          onSendMessage={actions.sendMessage}
          onSetMode={actions.setMode}
          onAddMessage={actions.addMessage}
          onUpdateMessage={actions.updateMessage}
          onRemoveMessage={actions.removeMessage}
          onStopTask={actions.stopTask}
          onClearChat={actions.clearChatHistory}
          onScreenSharingChange={setIsScreenSharing}
        />
      </WidgetErrorBoundary>

      {state.error && (
        <ErrorDisplay
          error={state.error}
          onClose={() => actions.clearError()}
          position={
            widgetPosition.position as
              | 'bottom_left'
              | 'bottom_right'
              | 'top_left'
              | 'top_right'
              | undefined
          }
        />
      )}
    </div>
  );
};
