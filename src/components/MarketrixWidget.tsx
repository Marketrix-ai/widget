import React, { useEffect, useState } from 'react';

import { PortalContainerContext } from '../context/WidgetProviders';
import { LAYER_TOKENS } from '../design-system/layers';
import { createSemanticTokens, semanticTokensToCssCustomProperties } from '../design-system/semantic-tokens';
import { useScrollLock } from '../hooks/useScrollLock';
import { useWidget, type ValidWidgetConfig, WidgetConfigContext } from '../hooks/useWidget';
import { WidgetSettingsDataSchema } from '../sdk';
import { readLocal, storageService, writeLocal } from '../services/StorageService';
import { StreamClient } from '../services/StreamClient';
import { tenantScope } from '../services/WidgetService';
import type { MarketrixConfig, WidgetPosition } from '../types';
import { addOpacity } from '../utils/color';
import { getCorner, isWidgetPosition } from '../utils/widgetPositioning';
import { ErrorBoundary } from './base/ErrorBoundary';
import { Surface } from './base/Surface';
import { NotificationToast } from './blocks/NotificationToast';
import { WidgetFab } from './blocks/WidgetFab';
import { MessengerShell } from './navigation/MessengerShell';

interface MarketrixWidgetProps {
  config: MarketrixConfig;
}

export const MarketrixWidget: React.FC<MarketrixWidgetProps> = ({ config }) => {
  const [showGreeting, setShowGreeting] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const { state, actions } = useWidget();
  const streamClient = StreamClient.getInstance();
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
    // Only a drag writes the key: seeding it with the dashboard default would pin that value forever.
    setWidgetPosition(config.widget_position ?? 'bottom_right');
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
  const customStyles = semanticTokensToCssCustomProperties(createSemanticTokens(config)) as React.CSSProperties;

  return (
    <WidgetConfigContext value={effectiveConfig}>
      <Surface
        ref={setPortalContainer}
        data-marketrix-widget
        position='relative'
        style={{ ...customStyles, ...(isPreviewMode && { width: '100%', height: '100%' }) }}
      >
        <PortalContainerContext value={portalContainer}>
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

          <ErrorBoundary label='Widget'>
            <MessengerShell />
          </ErrorBoundary>

          <WidgetFab onDrag={handlePositionChange} />

          {state.error && (
            <NotificationToast
              tone='error'
              title={state.error}
              onDismiss={() => actions.setError(undefined)}
              // Offered only when it can achieve something, and it now reconnects — it used to be
              // byte-identical to onDismiss, so the one error where reconnecting IS the remedy showed a
              // Retry button that only hid the toast.
              {...(streamClient.canReconnect() && {
                onRetry: () => {
                  actions.setError(undefined);
                  streamClient.reconnectNow();
                },
              })}
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
        </PortalContainerContext>
      </Surface>
    </WidgetConfigContext>
  );
};
