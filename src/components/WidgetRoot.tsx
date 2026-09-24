/**
 * The widget's root component: re-publishes the config with the visitor's dragged position and the
 * z-index floor, publishes the portal root, and renders the panel, launcher, notifications and busy glow.
 * A panel that crashes while rendering is reported through the error toast rather than vanishing.
 * A tenant's z-index setting can never sink the widget below the host page's own stacking context, and
 * preview mode always renders even when a setting would hide the widget.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { PortalContainerContext } from '../context/WidgetProviders';
import { LAYER_TOKENS } from '../design-system/component-tokens';
import { themeCssProperties } from '../design-system/semantic-tokens';
import { useWidget, useWidgetConfig, WidgetConfigContext } from '../hooks/useWidget';
import { WidgetSettingsDataSchema } from '../sdk/contracts/widgetSettings';
import { readLocalParsed, scopedKey, writeLocal } from '../services/StorageService';
import { streamClient } from '../services/StreamClient';
import type { WidgetPosition } from '../types';
import { addOpacity } from '../utils/color';
import { EDGE_OFFSET_PX, getCorner } from '../utils/widgetPositioning';
import { ErrorBoundary } from './base/ErrorBoundary';
import { Surface } from './base/Surface';
import { NotificationProvider, WidgetNotifications } from './blocks/Notifications';
import { WidgetFab } from './blocks/WidgetFab';
import { MessengerShell } from './navigation/MessengerShell';

const MOBILE_MAX_WIDTH = 767;
const PANEL_FAILED = 'Something went wrong displaying the chat. Please refresh the page.';

const PanelFailed: React.FC<{ onFail: (message: string) => void }> = ({ onFail }) => {
  useEffect(() => onFail(PANEL_FAILED), [onFail]);
  return null;
};

function useScrollLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const mql = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`);
    if (!mql.matches) return;

    const doc = document.documentElement;
    const body = document.body;
    const prevDocOverflow = doc.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    doc.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    return () => {
      doc.style.overflow = prevDocOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [enabled]);
}

export const WidgetRoot: React.FC = () => {
  const config = useWidgetConfig();
  const [showGreeting, setShowGreeting] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const { state, actions } = useWidget();
  const { isPreviewMode } = config;

  useScrollLock(state.isOpen);

  const positionStorageKey = scopedKey('marketrix_widget_position', config);

  const [widgetPosition, setWidgetPosition] = useState<WidgetPosition>(
    () =>
      (!isPreviewMode && readLocalParsed(positionStorageKey, WidgetSettingsDataSchema.shape.widget_position)) ||
      config.widget_position,
  );

  useEffect(() => {
    if (state.isOpen || isPreviewMode || !config.widget_greeting_toast) {
      setShowGreeting(false);
      return;
    }
    const timer = setTimeout(() => setShowGreeting(true), 2000);
    return () => clearTimeout(timer);
  }, [state.isOpen, isPreviewMode, config.widget_greeting_toast]);

  const effectiveConfig = useMemo(
    () => ({
      ...config,
      widget_position: widgetPosition,
      widget_position_z_index: Math.max(config.widget_position_z_index ?? 0, LAYER_TOKENS.panel),
    }),
    [config, widgetPosition],
  );
  const { setError } = actions;
  const clearError = useCallback(() => setError(undefined), [setError]);
  const retry = useCallback(() => {
    setError(undefined);
    streamClient.reconnectNow();
  }, [setError]);
  const dismissGreeting = useCallback(() => setShowGreeting(false), []);

  const handlePositionChange = (position: WidgetPosition) => {
    setWidgetPosition(position);
    if (!isPreviewMode) writeLocal(positionStorageKey, position);
  };

  const hiddenByConfig = config.show_widget === false || config.widget_appearance === 'hidden';
  if (!isPreviewMode && hiddenByConfig) {
    return null;
  }

  const showProcessingFeedback = state.isAwaitingReply || state.isTaskRunning;

  return (
    <WidgetConfigContext value={effectiveConfig}>
      <Surface
        ref={setPortalContainer}
        data-marketrix-widget
        position='relative'
        style={{ ...themeCssProperties(config), ...(isPreviewMode && { width: '100%', height: '100%' }) }}
      >
        <PortalContainerContext value={portalContainer}>
          <NotificationProvider
            container={portalContainer}
            offsetBottom={getCorner(widgetPosition).vertical === 'top' ? EDGE_OFFSET_PX : 90}
          >
            {showProcessingFeedback && (
              <Surface
                data-screen-edge-glow
                position='fixed'
                inset='0'
                style={{
                  boxShadow: `inset 0 0 22px 2px ${addOpacity(effectiveConfig.widget_accent_color, 0.72)}, inset 0 0 46px 10px ${addOpacity(effectiveConfig.widget_accent_color, 0.28)}`,
                  pointerEvents: 'none',
                  zIndex: LAYER_TOKENS.screenEdgeGlow,
                }}
              />
            )}

            <ErrorBoundary label='Widget' fallback={<PanelFailed onFail={actions.setError} />}>
              <MessengerShell />
            </ErrorBoundary>

            <WidgetFab onPositionCommit={handlePositionChange} />

            <WidgetNotifications
              error={state.error}
              onClearError={clearError}
              onRetry={state.canRetry ? retry : undefined}
              greeting={showGreeting && !state.error ? config.widget_greeting : undefined}
              greetingBody={config.widget_body}
              onGreetingDismiss={dismissGreeting}
            />
          </NotificationProvider>
        </PortalContainerContext>
      </Surface>
    </WidgetConfigContext>
  );
};
