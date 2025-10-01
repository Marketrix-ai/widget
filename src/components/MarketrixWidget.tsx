import React, { useState } from 'react';
import { MarketrixConfig } from '../types';
import { useMarketrixWidget } from '../hooks/useMarketrixWidget';
import { useWidgetAtmosphere } from '../hooks/useWidgetAtmosphere';
import { useIntegrationSettings } from '../hooks/useIntegrationSettings';
import { WidgetButton } from './WidgetButton';
import { ChatWindow } from './ChatWindow';
import { IntegrationSettingsDebug } from './IntegrationSettingsDebug';

interface MarketrixWidgetProps {
  config: MarketrixConfig;
}

export const MarketrixWidget: React.FC<MarketrixWidgetProps> = ({ config }) => {
  const { state, actions } = useMarketrixWidget({ config });
  const { 
    atmosphereConfig, 
    marketrixConfig, 
    shouldShow, 
    getWidgetCustomize,
    getWidgetPosition,
    isLoading: configLoading 
  } = useWidgetAtmosphere(config);
  
  // Fetch integration settings from API
  const { 
    settings: integrationSettings, 
    isLoading: settingsLoading, 
    error: settingsError 
  } = useIntegrationSettings(config);

  // Track screen sharing state
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Don't render if widget should not be visible or if integration settings say it's disabled
  if (!shouldShow || (integrationSettings && !integrationSettings.widget_enabled)) {
    return null;
  }

  // Use atmosphere config if available, otherwise fall back to original config
  const effectiveConfig = marketrixConfig || config;
  const widgetCustomize = getWidgetCustomize();
  const widgetPosition = getWidgetPosition();

  // Apply integration settings to the effective config
  const finalConfig = integrationSettings ? {
    ...effectiveConfig,
    // Override with integration settings - convert underscore to hyphen for position
    position: integrationSettings.widget_position?.replace('_', '-') || effectiveConfig.position,
    enabledModes: [
      ...(integrationSettings.widget_feature_show ? ['show'] : []),
      ...(integrationSettings.widget_feature_tell ? ['tell'] : []),
      ...(integrationSettings.widget_feature_do ? ['do'] : []),
    ] as ('show' | 'tell' | 'do')[],
    agentName: integrationSettings.widget_header || effectiveConfig.agentName,
  } : effectiveConfig;

  // Apply custom styling from atmosphere config and integration settings
  const customStyles = {
    '--widget-width': integrationSettings?.widget_width || widgetCustomize.sizes?.width || '320px',
    '--widget-height': integrationSettings?.widget_height || widgetCustomize.sizes?.height || '35rem',
    '--widget-border-radius': integrationSettings?.widget_border_radius || widgetCustomize.sizes?.border_radius || '12px',
    '--widget-font-size': integrationSettings?.widget_font_size || widgetCustomize.sizes?.font_size || '14px',
    '--widget-primary-color': integrationSettings?.widget_accent_color || widgetCustomize.colors?.primary || '#1BB55B',
    '--widget-secondary-color': integrationSettings?.widget_secondary_color || widgetCustomize.colors?.secondary || '#987ADD',
    '--widget-background': integrationSettings?.widget_background_color || widgetCustomize.colors?.background || 'linear-gradient(135deg, #1BB55B26 0%, #987ADD30 100%)',
    '--widget-text-color': integrationSettings?.widget_text_color || widgetCustomize.colors?.text || '#333333',
    '--widget-border-color': integrationSettings?.widget_border_color || widgetCustomize.colors?.border || 'rgba(255, 255, 255, 0.2)',
    '--widget-z-index': widgetPosition.z_index || 40,
    '--widget-shadow': integrationSettings?.widget_shadow || '0 4px 20px rgba(0, 0, 0, 0.15)',
    '--widget-animation-duration': integrationSettings?.widget_animation_duration || '0.3s',
    '--widget-fade-duration': integrationSettings?.widget_fade_duration || '0.2s',
  } as React.CSSProperties;

  return (
    <div 
      className="marketrix-widget" 
      style={customStyles}
      data-widget-mode={atmosphereConfig?.widget_mode || 'ai'}
      data-avatar-status={atmosphereConfig?.avatar_status || 'online'}
      data-streaming-status={atmosphereConfig?.streaming_avatar_status || 'idle'}
    >
      {/* Widget Button */}
      <WidgetButton
        config={finalConfig}
        onClick={actions.toggleWidget}
        isOpen={state.isOpen}
        agentAvailable={state.agentAvailable}
        isScreenSharing={isScreenSharing}
        integrationSettings={integrationSettings}
      />

      {/* Chat Window */}
      <ChatWindow
        config={finalConfig}
        isOpen={state.isOpen}
        isMinimized={state.isMinimized}
        isLoading={state.isLoading || configLoading || settingsLoading}
        messages={state.messages}
        currentMode={state.currentMode}
        agentAvailable={state.agentAvailable}
        onClose={actions.closeWidget}
        onSendMessage={actions.sendMessage}
        onSetMode={actions.setMode}
        onScreenSharingChange={setIsScreenSharing}
        integrationSettings={integrationSettings}
      />

      {/* Integration Settings Debug */}
      <IntegrationSettingsDebug
        settings={integrationSettings}
        isLoading={settingsLoading}
        error={settingsError}
      />

      {/* Error Display */}
      {(state.error || settingsError) && (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          <div className="bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm">{state.error || settingsError}</span>
              <button
                onClick={() => {
                  actions.clearError();
                  // Note: settingsError doesn't have a clear function, but we can ignore it
                }}
                className="ml-4 text-white hover:text-red-100"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
