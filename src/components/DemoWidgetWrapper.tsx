import React, { useEffect } from 'react';
import { MarketrixWidget } from './MarketrixWidget';
import { MarketrixConfig } from '../types';

interface DemoWidgetWrapperProps {
  config: MarketrixConfig;
  onActionsReady?: (actions: any) => void;
}

export const DemoWidgetWrapper: React.FC<DemoWidgetWrapperProps> = ({ 
  config, 
  onActionsReady 
}) => {
  // This component wraps the MarketrixWidget and exposes actions for demo functionality
  return <MarketrixWidget config={config} />;
};
