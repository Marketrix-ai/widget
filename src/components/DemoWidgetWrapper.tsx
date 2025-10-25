import React from 'react';

import type { MarketrixConfig } from '../types';
import { MarketrixWidget } from './MarketrixWidget';

interface DemoWidgetWrapperProps {
  config: MarketrixConfig;
  onActionsReady?: (actions: any) => void;
}

export const DemoWidgetWrapper: React.FC<DemoWidgetWrapperProps> = ({ config, onActionsReady }) => {
  // This component wraps the MarketrixWidget and exposes actions for demo functionality
  return <MarketrixWidget config={config} />;
};
