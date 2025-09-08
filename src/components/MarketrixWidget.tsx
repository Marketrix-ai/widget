import React from 'react';
import { MarketrixConfig } from '../types';
import { useMarketrixWidget } from '../hooks/useMarketrixWidget';
import { WidgetButton } from './WidgetButton';
import { ChatWindow } from './ChatWindow';

interface MarketrixWidgetProps {
  config: MarketrixConfig;
}

export const MarketrixWidget: React.FC<MarketrixWidgetProps> = ({ config }) => {
  const { state, actions } = useMarketrixWidget({ config });

  return (
    <div className="marketrix-widget">
      {/* Widget Button */}
      <WidgetButton
        config={config}
        onClick={actions.toggleWidget}
        isOpen={state.isOpen}
        agentAvailable={state.agentAvailable}
      />

      {/* Chat Window */}
      <ChatWindow
        config={config}
        isOpen={state.isOpen}
        isMinimized={state.isMinimized}
        isLoading={state.isLoading}
        messages={state.messages}
        currentMode={state.currentMode}
        agentAvailable={state.agentAvailable}
        onMinimize={actions.minimizeWidget}
        onClose={actions.closeWidget}
        onSendMessage={actions.sendMessage}
        onSetMode={actions.setMode}
      />

      {/* Error Display */}
      {state.error && (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          <div className="bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm">{state.error}</span>
              <button
                onClick={actions.clearError}
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
