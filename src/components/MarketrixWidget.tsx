import React from 'react';

import { useWidget } from '../hooks/useWidget';
import type { MarketrixConfig } from '../types';
import { isWidgetPosition } from '../utils/typeGuards';
import { ChatWindow } from './ChatWindow';
import { WidgetButton } from './widgetButton';

interface MarketrixWidgetProps {
  config: MarketrixConfig;
}

export const MarketrixWidget: React.FC<MarketrixWidgetProps> = ({ config }) => {
  const {
    state,
    actions,
    atmosphereConfig,
    marketrixConfig,
    shouldShow,
    getWidgetCustomize,
    getWidgetPosition,
    settings,
    isLoading: settingsLoading,
    error: settingsError,
  } = useWidget({ config });

  // Don't return null while settings are loading - show widget during loading
  // Only check visibility and enabled state after settings are loaded
  if (!settingsLoading) {
    // After settings are loaded, check if widget should be visible
    if (!shouldShow || !settings.widget_enabled) {
      return null;
    }
  }

  // Use atmosphere config if available, otherwise fall back to original config
  const effectiveConfig = marketrixConfig || config;
  const widgetCustomize = getWidgetCustomize();
  const widgetPosition = getWidgetPosition();

  // Apply settings to the effective config
  const finalConfig = {
    ...effectiveConfig,
    // Override with settings - convert underscore to hyphen for position
    position: (() => {
      const pos = settings.widget_position?.replace('_', '-');
      if (pos && isWidgetPosition(pos)) {
        return pos;
      }
      return effectiveConfig.position;
    })(),
    enabledModes: [
      ...(settings.widget_feature_show ? ['show' as const] : []),
      ...(settings.widget_feature_tell ? ['tell' as const] : []),
      ...(settings.widget_feature_do ? ['do' as const] : []),
    ],
  };

  // Apply custom styling from settings (settings already come from API or atmosphere)
  const customStyles = {
    '--widget-width': settings.widget_width || widgetCustomize.sizes?.width || '320px',
    '--widget-height': settings.widget_height || widgetCustomize.sizes?.height || '35rem',
    '--widget-border-radius':
      settings.widget_border_radius || widgetCustomize.sizes?.border_radius || '12px',
    '--widget-font-size': settings.widget_font_size || widgetCustomize.sizes?.font_size || '14px',
    '--widget-primary-color':
      settings.widget_accent_color || widgetCustomize.colors?.primary || '#1BB55B',
    '--widget-secondary-color':
      settings.widget_secondary_color || widgetCustomize.colors?.secondary || '#987ADD',
    '--widget-background':
      settings.widget_background_color ||
      widgetCustomize.colors?.background ||
      'linear-gradient(135deg, #1BB55B26 0%, #987ADD30 100%)',
    '--widget-text-color': settings.widget_text_color || widgetCustomize.colors?.text || '#333333',
    '--widget-border-color':
      settings.widget_border_color || widgetCustomize.colors?.border || 'rgba(255, 255, 255, 0.2)',
    '--widget-z-index': widgetPosition.z_index || 40,
    '--widget-shadow': settings.widget_shadow || '0 4px 20px rgba(0, 0, 0, 0.15)',
    '--widget-animation-duration': settings.widget_animation_duration || '0.3s',
    '--widget-fade-duration': settings.widget_fade_duration || '0.2s',
  } as React.CSSProperties;

  return (
    <div
      className='marketrix-widget'
      style={customStyles}
      data-widget-mode={atmosphereConfig?.widget_mode || 'ai'}
      data-avatar-status={atmosphereConfig?.avatar_status || 'online'}
      data-streaming-status={atmosphereConfig?.streaming_avatar_status || 'idle'}
    >
      {/* Widget Button */}
      <WidgetButton
        config={{
          ...finalConfig,
          position: finalConfig.position,
        }}
        onClick={actions.toggleWidget}
        isOpen={state.isOpen}
        _agentAvailable={state.agentAvailable}
      />

      {/* Chat Window */}
      <ChatWindow
        config={{
          ...finalConfig,
          position: finalConfig.position,
        }}
        isOpen={state.isOpen}
        isMinimized={state.isMinimized}
        isLoading={state.isLoading || settingsLoading}
        messages={state.messages}
        currentMode={state.currentMode}
        agentAvailable={state.agentAvailable}
        onClose={actions.closeWidget}
        onSendMessage={actions.sendMessage}
        onSetMode={actions.setMode}
      />

      {/* Error Display */}
      {(state.error || settingsError) && (
        <div className='fixed top-4 right-4 z-50 max-w-sm'>
          <div className='bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg'>
            <div className='flex items-center justify-between'>
              <span className='text-sm'>{state.error || settingsError}</span>
              <button
                onClick={() => {
                  actions.clearError();
                  // Note: settingsError doesn't have a clear function, but we can ignore it
                }}
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
      )}
    </div>
  );
};
