import React, { useEffect, useState } from 'react';

import { LAYER_TOKENS } from '../design-system/layers';
import { createSemanticTokens, semanticTokensToCssCustomProperties } from '../design-system/semantic-tokens';
import { useScrollLock } from '../hooks/useScrollLock';
import { useWidget, type ValidWidgetConfig, WidgetConfigContext } from '../hooks/useWidget';
import { WidgetSettingsDataSchema } from '../sdk';
import { readLocal, storageService, writeLocal } from '../services/StorageService';
import { tenantScope } from '../services/WidgetService';
import type { MarketrixConfig, WidgetPosition } from '../types';
import { addOpacity } from '../utils/color';
import { getCorner, isWidgetPosition } from '../utils/widgetPositioning';
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
    // Render nothing rather than crash the host page; componentDidCatch already logged it.
    if (this.state.hasError) return null;

    return this.props.children;
  }
}

export const MarketrixWidget: React.FC<MarketrixWidgetProps> = ({ config }) => {
  const [showGreeting, setShowGreeting] = useState(false);
  const { state, actions } = useWidget();
  const isPreviewMode = config.isPreviewMode ?? false;
  const configValid = WidgetSettingsDataSchema.safeParse(config).success;

  useScrollLock(state.isOpen);

  const [widgetPosition, setWidgetPosition] = useState<WidgetPosition>(config.widget_position ?? 'bottom_right');

  const positionStorageKey = `marketrix_widget_position_${tenantScope(config)}`;

  useEffect(() => {
    if (configValid) storageService.setConfig(config);
  }, [config, configValid]);

  useEffect(() => {
    const stored = isPreviewMode ? null : readLocal(positionStorageKey);
    if (isWidgetPosition(stored)) {
      setWidgetPosition(stored);
      return;
    }
    const fallback = config.widget_position ?? 'bottom_right';
    setWidgetPosition(fallback);
    if (!isPreviewMode) writeLocal(positionStorageKey, fallback);
  }, [isPreviewMode, positionStorageKey, config.widget_position]);

  useEffect(() => {
    if (state.isOpen || isPreviewMode || config.widget_appearance !== 'default' || !config.widget_greeting_toast) {
      setShowGreeting(false);
      return;
    }
    const timer = setTimeout(() => setShowGreeting(true), 2000);
    return () => clearTimeout(timer);
  }, [state.isOpen, isPreviewMode, config.widget_appearance, config.widget_greeting_toast]);

  const handlePositionChange = (position: WidgetPosition) => {
    setWidgetPosition(position);
    if (!isPreviewMode) writeLocal(positionStorageKey, position);
  };

  if (!configValid) {
    return null;
  }

  const hiddenByConfig =
    !config.widget_enabled || config.show_widget === false || config.widget_appearance === 'hidden';
  if (!isPreviewMode && hiddenByConfig) {
    return null;
  }

  const effectiveWidgetZIndex = Math.max(config.widget_position_z_index ?? 0, LAYER_TOKENS.panel);

  const effectiveConfig = {
    ...config,
    widget_position: widgetPosition,
    widget_position_z_index: effectiveWidgetZIndex,
  } as ValidWidgetConfig;

  const showProcessingFeedback = state.isLoading || state.isTaskRunning;
  const customStyles = {
    ...semanticTokensToCssCustomProperties(createSemanticTokens(config)),
    '--widget-z-index': effectiveWidgetZIndex,
  } as React.CSSProperties;

  return (
    <WidgetConfigContext value={effectiveConfig}>
      <Surface
        data-marketrix-widget
        position='relative'
        style={{ ...customStyles, ...(isPreviewMode && { width: '100%', height: '100%' }) }}
        data-widget-mode={config.widget_feature_human ? 'hybrid' : 'ai'}
      >
        {showProcessingFeedback && (
          <Surface
            data-screen-edge-glow
            position='fixed'
            inset='0'
            style={{
              boxShadow: `inset 0 0 22px 2px ${addOpacity(effectiveConfig.widget_accent_color, 0.72)}, inset 0 0 46px 10px ${addOpacity(effectiveConfig.widget_accent_color, 0.28)}`,
              pointerEvents: 'none',
              zIndex: LAYER_TOKENS.overlay,
            }}
          />
        )}

        <WidgetErrorBoundary>
          <MessengerShell />
        </WidgetErrorBoundary>

        <WidgetFab onDrag={handlePositionChange} />

        {state.error && (
          <NotificationToast
            tone='error'
            title={state.error}
            onDismiss={() => actions.setError(undefined)}
            onRetry={() => actions.setError(undefined)}
            position={getCorner(widgetPosition).vertical === 'top' ? 'bottom-center' : 'above-fab'}
          />
        )}

        {showGreeting && !state.error && config.widget_greeting && (
          <NotificationToast
            tone='info'
            title={config.widget_greeting}
            body={config.widget_body}
            onDismiss={() => setShowGreeting(false)}
            position='bottom-center'
          />
        )}
      </Surface>
    </WidgetConfigContext>
  );
};
