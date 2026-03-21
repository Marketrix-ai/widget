import React from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { useWidget } from '../../hooks/useWidget';
import type { MarketrixConfig, WidgetPosition } from '../../types';
import { darkenColor, getContrastingColor } from '../../utils/format';
import { WidgetFab } from '../blocks/WidgetFab';

interface WidgetButtonProps {
  config: MarketrixConfig;
  onClick: () => void;
  onStopTask?: () => void;
  isOpen: boolean;
  isMinimized?: boolean;
  isLoading?: boolean;
  isTaskRunning?: boolean;
  hasError?: boolean;
  position: WidgetPosition;
  onPositionChange: (position: WidgetPosition) => void;
}

export const WidgetButton: React.FC<WidgetButtonProps> = ({
  config,
  onClick,
  onStopTask,
  isOpen,
  isLoading = false,
  isTaskRunning = false,
  hasError = false,
  position,
  onPositionChange,
}) => {
  const { config: widgetConfig, isPreviewMode } = useWidget({ config });

  const accentColor = widgetConfig.widget_accent_color;
  const bgColor = widgetConfig.widget_background_color;
  const borderRadius = widgetConfig.widget_border_radius;
  const tooltipBgColor = darkenColor(accentColor, 0.3);
  const tooltipTextColor = getContrastingColor(tooltipBgColor);
  const zIndex = widgetConfig.widget_position_z_index ?? 50;

  return (
    <WidgetFab
      logo={MarketrixIcon}
      open={isOpen}
      processing={isLoading}
      error={hasError}
      taskRunning={isTaskRunning}
      tooltip='Support Agent'
      onClick={onClick}
      onStop={onStopTask}
      accentColor={accentColor}
      backgroundColor={bgColor}
      borderRadius={borderRadius}
      tooltipBgColor={tooltipBgColor}
      tooltipTextColor={tooltipTextColor}
      zIndex={zIndex}
      position={position}
      onDrag={onPositionChange}
      isPreviewMode={isPreviewMode}
    />
  );
};
