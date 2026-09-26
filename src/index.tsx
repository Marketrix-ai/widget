/**
 * Public entry point of `@marketrix.ai/widget` (README is its customer-facing surface): the lifecycle API from
 * `mount.tsx`, `mountWidget` (preview or live by whether settings or credentials were passed) and the
 * `MarketrixWidgetPreview` component. Auto-init runs on import, deferred a tick and guarded so the package stays
 * importable during a server render.
 */
import React, { useEffect, useMemo, useRef } from 'react';

import {
  autoInitializeWidget,
  getCurrentConfig,
  initWidget,
  mountPreview,
  previewConfig,
  renderWidget,
  unmountWidget,
  updateMarketrixConfig,
} from './mount';
import type { AddWidgetConfig, MarketrixWidgetPreviewProps } from './types';

export const MarketrixWidgetPreview: React.FC<MarketrixWidgetPreviewProps> = ({ settings, container }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const config = useMemo(() => previewConfig(settings), [settings]);

  useEffect(() => renderWidget(config, container ?? containerRef.current ?? document.body), [config, container]);

  if (container) return null;
  return <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }} />;
};

export const mountWidget = async (config: AddWidgetConfig): Promise<void> => {
  if (config.settings !== undefined) {
    const { settings, container, ...clientConfig } = config;
    mountPreview(previewConfig(settings, clientConfig), container);
  } else if (config.mtxId !== undefined && config.mtxKey !== undefined && config.mtxApiHost !== undefined) {
    const { container, ...clientConfig } = config;
    await initWidget(clientConfig, container);
  } else {
    throw new Error('Invalid configuration: provide either settings (preview) or mtxId+mtxKey+mtxApiHost (production)');
  }
};

if (typeof window !== 'undefined') {
  setTimeout(autoInitializeWidget, 0);
}

export { getCurrentConfig, initWidget, unmountWidget, updateMarketrixConfig };

export type {
  AddWidgetConfig,
  ClientOwnedConfig,
  InstructionType,
  MarketrixConfig,
  MarketrixWidgetPreviewProps,
  WidgetSettingsData,
} from './types';
