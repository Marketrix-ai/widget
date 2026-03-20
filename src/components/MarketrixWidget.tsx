import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';

import { LAYER_TOKENS } from '../design-system/layers';
import { semanticTokensToCssCustomProperties } from '../design-system/semantic-tokens';
import { createSemanticTokens } from '../design-system/token-adapter';
import { useScrollLock } from '../hooks/useScrollLock';
import { useWidget } from '../hooks/useWidget';
import type { MarketrixConfig, WidgetPosition } from '../types';
import { addOpacity } from '../utils/format';
import { WidgetButton } from './layout/WidgetButton';
import { MessengerShell } from './navigation/MessengerShell';
import { ErrorDisplay } from './ui/ErrorDisplay';
import { GreetingToast } from './ui/GreetingToast';

// Lazy load the dev panel (only in development)
const DomTestPanel = lazy(() => import('./dev/DomTestPanel'));

interface MarketrixWidgetProps {
  config: MarketrixConfig;
}

// Error Boundary for MessengerShell
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
      return null; // Fail gracefully by rendering nothing instead of crashing
    }

    return this.props.children;
  }
}

export const MarketrixWidget: React.FC<MarketrixWidgetProps> = ({ config }) => {
  const [_isScreenSharing, setIsScreenSharing] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const isDevBuild = import.meta.env.DEV;
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

  // Show greeting toast after delay when widget is closed
  useEffect(() => {
    if (state.isOpen || isPreviewMode || settings.widget_appearance !== 'default') {
      setShowGreeting(false);
      return;
    }
    const timer = setTimeout(() => setShowGreeting(true), 2000);
    return () => clearTimeout(timer);
  }, [state.isOpen, isPreviewMode, settings.widget_appearance]);

  const handlePositionChange = (position: WidgetPosition) => {
    setWidgetPosition(position);
    if (!isPreviewMode && typeof localStorage !== 'undefined') {
      localStorage.setItem(positionStorageKey, position);
    }
  };

  if (!configValid) {
    return null;
  }

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
    // (not from API settings) so they propagate to child components like MessengerShell
    show_widget: config.show_widget,
    use_screenshare: config.use_screenshare,
  };
  const showProcessingFeedback = state.isLoading || state.isTaskRunning;
  const customStyles = {
    ...semanticTokenStyles,
    '--widget-z-index': effectiveWidgetZIndex,
  } as React.CSSProperties;

  const gradientPositionStyle = (() => {
    const size = 500;
    const base: React.CSSProperties = {
      position: 'fixed',
      width: `${size}px`,
      height: `${size}px`,
      pointerEvents: 'none',
      zIndex: LAYER_TOKENS.panel - 1,
      background: `radial-gradient(circle at ${widgetPosition.includes('right') ? '100%' : '0%'} ${widgetPosition.includes('bottom') ? '100%' : '0%'}, ${addOpacity(settings.widget_accent_color, 0.08)} 0%, transparent 70%)`,
    };
    if (widgetPosition.includes('top')) base.top = 0;
    else base.bottom = 0;
    if (widgetPosition.includes('right')) base.right = 0;
    else base.left = 0;
    return base;
  })();

  return (
    <div
      className='marketrix-widget relative'
      style={{ ...customStyles, ...(isPreviewMode && { width: '100%', height: '100%' }) }}
      data-widget-mode={settings?.widget_feature_human ? 'hybrid' : 'ai'}
    >
      {state.isOpen && <div className='animate-fade-in' style={gradientPositionStyle} aria-hidden />}
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

      <WidgetErrorBoundary>
        <MessengerShell
          config={effectiveConfig}
          isOpen={state.isOpen}
          isMinimized={state.isMinimized}
          messages={state.messages}
          currentMode={state.currentMode}
          isTaskRunning={state.isTaskRunning}
          taskProgress={state.taskProgress}
          activeView={state.activeView}
          onClose={actions.closeWidget}
          onSendMessage={actions.sendMessage}
          onSetMode={actions.setMode}
          onAddMessage={actions.addMessage}
          onUpdateMessage={actions.updateMessage}
          onRemoveMessage={actions.removeMessage}
          onStopTask={actions.stopTask}
          onClearChat={actions.clearChatHistory}
          onScreenSharingChange={setIsScreenSharing}
          setActiveView={actions.setActiveView}
        />
      </WidgetErrorBoundary>

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

      {state.error && (
        <ErrorDisplay
          error={state.error}
          onClose={() => actions.clearError()}
          onRetry={() => actions.clearError()}
          position={widgetPosition}
        />
      )}

      {showGreeting && !state.error && settings.widget_greeting && (
        <GreetingToast
          greeting={settings.widget_greeting}
          body={settings.widget_body}
          onClose={() => setShowGreeting(false)}
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
