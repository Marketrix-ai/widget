import React from 'react';

import { useWidget } from '../hooks/useWidget';
import type { MarketrixConfig } from '../types';
import { ChatWindow } from './chatWindow';
import { WidgetButton } from './widgetButton';

interface MarketrixWidgetProps {
  config: MarketrixConfig;
}

export const MarketrixWidget: React.FC<MarketrixWidgetProps> = ({ config }) => {
  const [isScreenSharing, setIsScreenSharing] = React.useState(false);

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
      className='marketrix-widget'
      style={customStyles}
      data-widget-mode={settings?.widget_feature_human ? 'hybrid' : 'ai'}
    >
      <WidgetButton
        config={effectiveConfig}
        onClick={actions.toggleWidget}
        isOpen={state.isOpen}
        _agentAvailable={state.agentAvailable}
        isScreenSharing={isScreenSharing}
      />

      <ChatWindow
        config={effectiveConfig}
        isOpen={state.isOpen}
        isMinimized={state.isMinimized}
        isLoading={state.isLoading}
        messages={state.messages}
        currentMode={state.currentMode}
        agentAvailable={state.agentAvailable}
        onClose={actions.closeWidget}
        onSendMessage={actions.sendMessage}
        onSetMode={actions.setMode}
        onAddMessage={actions.addMessage!}
        onUpdateMessage={actions.updateMessage!}
        onScreenSharingChange={setIsScreenSharing}
      />

      {state.error ? (
        <div className='fixed top-4 right-4 z-50 max-w-sm'>
          <div className='bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg'>
            <div className='flex items-center justify-between'>
              <span className='text-sm'>{state.error}</span>
              <button
                onClick={() => actions.clearError()}
                className='ml-4 text-white hover:text-red-100'
              >
                <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
                  <path
                    fillRule='evenodd'
                    d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
                    clipRule='evenodd'
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
