import React from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { NotificationToast } from '../blocks/NotificationToast';

interface ErrorDisplayProps {
  error: string;
  onClose: () => void;
  /** Optional retry for transient failures (explicit recovery per plan 7.4) */
  onRetry?: () => void;
  position?: 'bottom_left' | 'bottom_right' | 'top_left' | 'top_right';
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onClose, onRetry, position = 'bottom_left' }) => {
  const toastPosition = position.includes('top') ? 'above-fab' : 'above-fab';

  return (
    <NotificationToast
      tone='error'
      icon={MarketrixIcon}
      title={error}
      onDismiss={onClose}
      onRetry={onRetry}
      position={toastPosition}
    />
  );
};
