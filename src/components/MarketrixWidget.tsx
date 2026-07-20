import React, { useEffect, useMemo, useState } from 'react';

import { LAYER_TOKENS } from '../design-system/layers';
import { semanticTokensToCssCustomProperties } from '../design-system/semantic-tokens';
import { createSemanticTokens } from '../design-system/token-adapter';
import { useScrollLock } from '../hooks/useScrollLock';
import { useWidget } from '../hooks/useWidget';
import type { MarketrixConfig, WidgetPosition } from '../types';
import { addOpacity, darkenColor, getContrastingColor } from '../utils/color';
import { Surface } from './base/Surface';
import { NotificationToast } from './blocks/NotificationToast';
import { WidgetFab } from './blocks/WidgetFab';
import { MessengerShell } from './navigation/MessengerShell';

interface MarketrixWidgetProps {
  config: MarketrixConfig;
}

class WidgetErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Widget Error Boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      {
        console.error('Widget render error', this.state.error);
      }
      return null; // render nothing rather than crash the host page
    }

    return this.props.children;
  }
}

export const MarketrixWidget: React.FC<MarketrixWidgetProps> = ({ config }) => {
  const [showGreeting, setShowGreeting] = useState(false);

  const {
    state,
    actions,
    config: settings,
    shouldShow,
    isPreviewMode,
    configValid,
  } = useWidget({
    config,
  });

  useScrollLock(state.isOpen);

  const [widgetPosition, setWidgetPosition] = useState<WidgetPosition>(
    (config.widget_position as WidgetPosition | undefined) ?? 'bottom_right',
  );

  const positionStorageKey = useMemo(() => {
    const scopedId = config.mtxId ?? (config.mtxApp != null ? String(config.mtxApp) : 'default');
    return `marketrix_widget_position_${scopedId}`;
  }, [config.mtxApp, config.mtxId]);

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

  useEffect(() => {
    if (state.isOpen || isPreviewMode || settings.widget_appearance !== 'default' || !settings.widget_greeting_toast) {
      setShowGreeting(false);
      return;
    }
    const timer = setTimeout(() => setShowGreeting(true), 2000);
    return () => clearTimeout(timer);
  }, [state.isOpen, isPreviewMode, settings.widget_appearance, settings.widget_greeting_toast]);

  const handlePositionChange = (position: WidgetPosition) => {
    setWidgetPosition(position);
    if (!isPreviewMode && typeof localStorage !== 'undefined') {
      localStorage.setItem(positionStorageKey, position);
    }
  };

  if (!configValid) {
    return null;
  }

  const shouldRender =
    isPreviewMode ||
    (shouldShow && settings.widget_enabled && config.show_widget !== false && settings.widget_appearance !== 'hidden');

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
    // These come from script-tag attrs / init config, not API settings — pass through so children see them
    show_widget: config.show_widget,
    use_screenshare: config.use_screenshare,
  };
  const showProcessingFeedback = state.isLoading || state.isTaskRunning;
  const customStyles = {
    ...semanticTokenStyles,
    '--widget-z-index': effectiveWidgetZIndex,
  } as React.CSSProperties;

  return (
    <Surface
      data-marketrix-widget
      position='relative'
      style={{ ...customStyles, ...(isPreviewMode && { width: '100%', height: '100%' }) }}
      data-widget-mode={settings?.widget_feature_human ? 'hybrid' : 'ai'}
    >
      {showProcessingFeedback && (
        <Surface
          data-screen-edge-glow
          position='fixed'
          inset='0'
          style={{
            boxShadow: `inset 0 0 22px 2px ${addOpacity(settings.widget_accent_color, 0.72)}, inset 0 0 46px 10px ${addOpacity(settings.widget_accent_color, 0.28)}`,
            pointerEvents: 'none',
            zIndex: LAYER_TOKENS.overlay,
          }}
        />
      )}

      <WidgetErrorBoundary>
        <MessengerShell
          config={effectiveConfig}
          isOpen={state.isOpen}
          isMinimized={state.isMinimized}
          messages={state.messages}
          currentMode={state.currentMode}
          isTaskRunning={state.isTaskRunning}
          activeView={state.activeView}
          onClose={actions.closeWidget}
          onSendMessage={actions.messageDispatch}
          onSetMode={actions.setMode}
          onAddMessage={actions.addMessage}
          onUpdateMessage={actions.updateMessage}
          onRemoveMessage={actions.removeMessage}
          onStopTask={actions.stopTask}
          onClearChat={actions.clearChatHistory}
          setActiveView={actions.setActiveView}
        />
      </WidgetErrorBoundary>

      <WidgetFab
        open={state.isOpen}
        processing={state.isLoading}
        error={!!state.error}
        taskRunning={state.isTaskRunning}
        onClick={actions.toggleWidget}
        onStop={actions.stopTask}
        accentColor={effectiveConfig.widget_accent_color}
        backgroundColor={effectiveConfig.widget_background_color}
        borderRadius={effectiveConfig.widget_border_radius}
        tooltipBgColor={darkenColor(effectiveConfig.widget_accent_color, 0.3)}
        tooltipTextColor={getContrastingColor(darkenColor(effectiveConfig.widget_accent_color, 0.3))}
        zIndex={effectiveConfig.widget_position_z_index ?? 50}
        position={widgetPosition}
        onDrag={handlePositionChange}
        isPreviewMode={isPreviewMode}
      />

      {state.error && (
        <NotificationToast
          tone='error'
          title={state.error}
          onDismiss={() => actions.clearError()}
          onRetry={() => actions.clearError()}
          position={widgetPosition.includes('top') ? 'bottom-center' : 'above-fab'}
        />
      )}

      {showGreeting && !state.error && settings.widget_greeting && (
        <NotificationToast
          tone='info'
          title={settings.widget_greeting}
          body={settings.widget_body}
          onDismiss={() => setShowGreeting(false)}
          position='bottom-center'
        />
      )}
    </Surface>
  );
};
