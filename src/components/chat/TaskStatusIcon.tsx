import React from 'react';

import { useWidgetConfig } from '../../hooks/useWidget';
import type { ChatMessage } from '../../types';
import { addOpacity } from '../../utils/color';
import { Icon } from '../base/Icon';
import type { IconName } from '../base/icons';

const STATUS_ICONS: Record<NonNullable<ChatMessage['taskStatus']>, { name: IconName; opacity: number }> = {
  done: { name: 'checkCircle', opacity: 1 },
  failed: { name: 'exclamationCircle', opacity: 0.75 },
  stopped: { name: 'circle', opacity: 0.5 },
};

export const TaskStatusIcon: React.FC<{ status: NonNullable<ChatMessage['taskStatus']> }> = ({ status }) => {
  const { name, opacity } = STATUS_ICONS[status];
  return (
    <Icon
      name={name}
      size={14}
      style={{ color: addOpacity(useWidgetConfig().widget_accent_color, opacity), flexShrink: 0 }}
    />
  );
};
