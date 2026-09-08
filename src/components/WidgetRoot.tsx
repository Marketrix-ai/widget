/**
 * The widget's root component: the one place the raw config prop is touched — position and z-index are
 * layered onto it and the result published through `WidgetConfigContext` — and the one place the root
 * element is published through `PortalContainerContext`. Everything below reads those from context:
 * `MessengerShell` (inside an `ErrorBoundary`, so a panel crash still leaves the launcher and toasts
 * alive), `WidgetFab`, `WidgetNotifications`, and the fixed screen-edge glow shown while a reply or a
 * task is in flight.
 *
 * A mount-time effect restores the drag-pinned corner, narrowing the stored string with
 * `isWidgetPosition` and falling back to the configured corner; `handlePositionChange` commits a drag,
 * moving the launcher and persisting the corner under `marketrix_widget_position_<tenant>`. That key is
 * written ONLY by a drag — seeding it with `config.widget_position` would pin the dashboard's setting at
 * whatever it was on a visitor's first load — and preview mode neither reads nor writes it, so the
 * dashboard always shows the configured corner. A second effect arms the greeting toast 2s after mount
 * and tears it down whenever the panel opens; it never fires in preview or with `widget_greeting_toast`
 * off.
 *
 * Why the rest is shaped as it is:
 * - Preview mode overrides the hidden check: `show_widget: false` / `widget_appearance: 'hidden'` suppress
 *   the widget on a host page, but the dashboard preview must still render. The `null` return sits below
 *   every hook, so hook order is stable either way.
 * - The published z-index is `max(tenant value, LAYER_TOKENS.panel)` — a tenant's low setting must not sink
 *   the widget under the host page's own stacking context.
 * - The root `Surface` IS the `[data-marketrix-widget]` element carrying every tenant token as an inline
 *   style, which is why it, and not the shadow root, is the portal container: a portal landing outside it
 *   falls back to `index.css`'s hardcoded palette. In preview it is sized 100%/100% to fill the dashboard's
 *   box instead of pinning to a viewport corner.
 * - Toasts offset 90px from the bottom to clear the launcher when the widget is pinned bottom, 20px when it
 *   is pinned top.
 * - The glow is `pointerEvents: 'none'`: it covers the whole viewport and must never eat a host-page click.
 * - `onRetry` is spread in only when `StreamClient.canReconnect()`, so a terminal failure (an auth
 *   `chat/error`, or the attempt cap) offers no Retry button rather than one that does nothing.
 */
import React, { useEffect, useState } from 'react';

import { PortalContainerContext } from '../context/WidgetProviders';
import { LAYER_TOKENS } from '../design-system/layers';
import { createSemanticTokens, semanticTokensToCssCustomProperties } from '../design-system/semantic-tokens';
import { useScrollLock } from '../hooks/useScrollLock';
import { useWidget, WidgetConfigContext } from '../hooks/useWidget';
import { readLocal, tenantScope, writeLocal } from '../services/StorageService';
import { StreamClient } from '../services/StreamClient';
import type { ValidWidgetConfig, WidgetPosition } from '../types';
import { addOpacity } from '../utils/color';
import { getCorner, isWidgetPosition } from '../utils/widgetPositioning';
import { ErrorBoundary } from './base/ErrorBoundary';
import { Surface } from './base/Surface';
import { NotificationProvider, WidgetNotifications } from './blocks/Notifications';
import { WidgetFab } from './blocks/WidgetFab';
import { MessengerShell } from './navigation/MessengerShell';

interface WidgetRootProps {
  config: ValidWidgetConfig;
}

export const WidgetRoot: React.FC<WidgetRootProps> = ({ config }) => {
  const [showGreeting, setShowGreeting] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const { state, actions } = useWidget();
  const streamClient = StreamClient.getInstance();
  const isPreviewMode = config.isPreviewMode ?? false;

  useScrollLock(state.isOpen);

  const [widgetPosition, setWidgetPosition] = useState<WidgetPosition>(config.widget_position ?? 'bottom_right');

  const positionStorageKey = `marketrix_widget_position_${tenantScope(config)}`;

  useEffect(() => {
    const stored = isPreviewMode ? null : readLocal(positionStorageKey);
    if (isWidgetPosition(stored)) {
      setWidgetPosition(stored);
      return;
    }
    setWidgetPosition(config.widget_position ?? 'bottom_right');
  }, [isPreviewMode, positionStorageKey, config.widget_position]);

  useEffect(() => {
    if (state.isOpen || isPreviewMode || !config.widget_greeting_toast) {
      setShowGreeting(false);
      return;
    }
    const timer = setTimeout(() => setShowGreeting(true), 2000);
    return () => clearTimeout(timer);
  }, [state.isOpen, isPreviewMode, config.widget_greeting_toast]);

  const handlePositionChange = (position: WidgetPosition) => {
    setWidgetPosition(position);
    if (!isPreviewMode) writeLocal(positionStorageKey, position);
  };

  const hiddenByConfig = config.show_widget === false || config.widget_appearance === 'hidden';
  if (!isPreviewMode && hiddenByConfig) {
    return null;
  }

  const effectiveWidgetZIndex = Math.max(config.widget_position_z_index ?? 0, LAYER_TOKENS.panel);

  const effectiveConfig = {
    ...config,
    widget_position: widgetPosition,
    widget_position_z_index: effectiveWidgetZIndex,
  };

  const showProcessingFeedback = state.isAwaitingReply || state.isTaskRunning;
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
          <NotificationProvider
            container={portalContainer}
            offsetBottom={getCorner(widgetPosition).vertical === 'top' ? 20 : 90}
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

            <ErrorBoundary label='Widget'>
              <MessengerShell />
            </ErrorBoundary>

            <WidgetFab onPositionCommit={handlePositionChange} />

            <WidgetNotifications
              error={state.error}
              onClearError={() => actions.setError(undefined)}
              {...(streamClient.canReconnect() && {
                onRetry: () => {
                  actions.setError(undefined);
                  streamClient.reconnectNow();
                },
              })}
              greeting={showGreeting && !state.error ? config.widget_greeting : undefined}
              greetingBody={config.widget_body}
              onGreetingDismiss={() => setShowGreeting(false)}
            />
          </NotificationProvider>
        </PortalContainerContext>
      </Surface>
    </WidgetConfigContext>
  );
};
