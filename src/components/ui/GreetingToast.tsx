import React from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { NotificationToast } from '../blocks/NotificationToast';

interface GreetingToastProps {
  greeting: string;
  body?: string;
  onClose: () => void;
  autoCloseMs?: number;
}

export const GreetingToast: React.FC<GreetingToastProps> = ({ greeting, body, onClose }) => {
  return (
    <NotificationToast
      tone='info'
      icon={MarketrixIcon}
      title={greeting}
      body={body}
      onDismiss={onClose}
      position='bottom-center'
    />
  );
};
