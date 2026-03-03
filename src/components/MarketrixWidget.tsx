import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';

import { LAYER_TOKENS } from '../design-system/layers';
import { semanticTokensToCssCustomProperties } from '../design-system/semantic-tokens';
import { createSemanticTokens } from '../design-system/token-adapter';
import { useWidget } from '../hooks/useWidget';
import type { MarketrixConfig, WidgetPosition } from '../types';
import { addOpacity } from '../utils/format';
import { ChatWindow } from './chat/ChatWindow';
import { WidgetButton } from './layout/WidgetButton';
import { ErrorDisplay } from './ui/ErrorDisplay';

// Lazy load the dev panel (only in development)
const DomTestPanel = lazy(() => import('./dev/DomTestPanel'));

interface MarketrixWidgetProps {
  config: MarketrixConfig;
}

// Error Boundary for ChatWindow
class WidgetErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
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
  const [_isScreenSharing, setIsScreenSharing] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const isDevBuild = import.meta.env.DEV;

  const {
    state,
    actions,
    config: settings,
    shouldShow,
    isPreviewMode,
  } = useWidget({
    config,
  });
  const [widgetPosition, setWidgetPosition] = useState<WidgetPosition>(
    (config.widget_position as WidgetPosition | undefined) ?? 'bottom_right',
  );

  const positionStorageKey = useMemo(() => {
    const tenantScopedId = config.mtxId ?? (config.mtxApp != null ? String(config.mtxApp) : 'default');
    return `marketrix_widget_position_${tenantScopedId}`;
  }, [config.mtxApp, config.mtxId]);

  // Keyboard shortcut for dev panel (Ctrl+Shift+D)
  useEffect(() => {
    if (!isDevBuild) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setShowDevPanel(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDevBuild]);

  useEffect(() => {
    const fallback = (settings.widget_position as WidgetPosition | undefined) ?? 'bottom_right';
    setWidgetPosition(fallback);
  }, [settings.widget_position]);

  useEffect(() => {
    if (isPreviewMode || typeof localStorage === 'undefined') {
      return;
    }

    const fallback = (settings.widget_position as WidgetPosition | undefined) ?? 'bottom_right';
    const storedPosition = localStorage.getItem(positionStorageKey);
    if (
      storedPosition === 'bottom_left' ||
      storedPosition === 'bottom_right' ||
      storedPosition === 'top_left' ||
      storedPosition === 'top_right'
    ) {
      setWidgetPosition(storedPosition);
      return;
    }

    localStorage.setItem(positionStorageKey, fallback);
    setWidgetPosition(fallback);
  }, [isPreviewMode, positionStorageKey, settings.widget_position]);

  const handlePositionChange = (position: WidgetPosition) => {
    setWidgetPosition(position);
    if (!isPreviewMode && typeof localStorage !== 'undefined') {
      localStorage.setItem(positionStorageKey, position);
    }
  };

  // In preview mode, always show if widget_enabled is true in config
  const shouldRender = isPreviewMode
    ? (config.widget_enabled ?? settings.widget_enabled ?? false)
    : shouldShow && settings.widget_enabled && config.show_widget !== false;

  if (!shouldRender) {
    return null;
  }

  const semanticTokens = createSemanticTokens(settings);
  const semanticTokenStyles = semanticTokensToCssCustomProperties(semanticTokens);

  const effectiveWidgetZIndex = Math.max(settings.widget_position_z_index ?? 0, LAYER_TOKENS.panel);

  const effectiveConfig = {
    ...settings,
    widget_position: widgetPosition,
    widget_position_z_index: effectiveWidgetZIndex,
    // Preserve top-level config props that come from script tag attributes / init config
    // (not from API settings) so they propagate to child components like ChatWindow
    show_widget: config.show_widget,
    use_screenshare: config.use_screenshare,
  };
  const showProcessingFeedback = state.isLoading || state.isTaskRunning;
  const customStyles = {
    ...semanticTokenStyles,
    '--widget-width': settings.widget_width,
    '--widget-height': settings.widget_height,
    '--widget-border-radius': settings.widget_border_radius,
    '--widget-font-size': settings.widget_font_size,
    '--widget-primary-color': settings.widget_accent_color,
    '--widget-secondary-color': settings.widget_secondary_color,
    '--widget-background': settings.widget_background_color,
    '--widget-text-color': settings.widget_text_color,
    '--widget-border-color': settings.widget_border_color,
    '--widget-z-index': effectiveWidgetZIndex,
    '--widget-shadow': settings.widget_shadow,
    '--widget-animation-duration': settings.widget_animation_duration,
    '--widget-fade-duration': settings.widget_fade_duration,
  } as React.CSSProperties;

  return (
    <div
      className='marketrix-widget relative'
      style={{ ...customStyles, ...(isPreviewMode && { width: '100%', height: '100%' }) }}
      data-widget-mode={settings?.widget_feature_human ? 'hybrid' : 'ai'}
    >
      {showProcessingFeedback && (
        <div
          className='marketrix-screen-edge-glow fixed inset-0'
          style={{
            boxShadow: `inset 0 0 22px 2px ${addOpacity(settings.widget_accent_color, 0.72)}, inset 0 0 46px 10px ${addOpacity(settings.widget_accent_color, 0.28)}`,
            pointerEvents: 'none',
            zIndex: LAYER_TOKENS.overlay,
          }}
        />
      )}

      <WidgetButton
        config={effectiveConfig}
        onClick={actions.toggleWidget}
        onStopTask={actions.stopTask}
        isOpen={state.isOpen}
        isMinimized={state.isMinimized}
        isLoading={state.isLoading}
        isTaskRunning={state.isTaskRunning}
        hasError={!!state.error}
        position={widgetPosition}
        onPositionChange={handlePositionChange}
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
          onRetry={() => actions.clearError()}
          position={widgetPosition}
        />
      )}

      {/* Dev-only DOM Test Panel */}
      {isDevBuild && showDevPanel && (
        <Suspense fallback={null}>
          <DomTestPanel />
        </Suspense>
      )}
    </div>
  );
};
