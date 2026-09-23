/**
 * Public entry point of `@marketrix.ai/widget`: the imperative lifecycle API from `mount.tsx`, the
 * `MarketrixWidgetPreview` dashboard component, `mountWidget`, and the script-tag auto-init hook.
 * `README.md` is the customer-facing surface these exports make up.
 *
 * `mountWidget` picks the preview or live path by whether settings or credentials were passed. Auto-init
 * runs on import, deferred a tick and guarded so the package stays importable during a server render.
 */
import React, { useEffect, useRef } from 'react';

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

  useEffect(() => {
    const config = previewConfig(settings);
    if (!config) return;
    return renderWidget(config, container ?? containerRef.current ?? document.body);
  }, [settings, container]);

  if (container) return null;
  return <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }} />;
};

export const mountWidget = async (config: AddWidgetConfig): Promise<void> => {
  if (config.settings !== undefined) {
    const { settings, container, ...clientConfig } = config;
    const previewed = previewConfig(settings, clientConfig);
    if (previewed) mountPreview(previewed, container);
  } else if (config.mtxId !== undefined && config.mtxKey !== undefined) {
    const { container, ...clientConfig } = config;
    await initWidget(clientConfig, container);
  } else {
    throw new Error('Invalid configuration: provide either settings (preview) or mtxId+mtxKey (production)');
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
