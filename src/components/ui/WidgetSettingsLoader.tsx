import React, { useState } from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { DARK_THEME_COLORS } from '../../constants/theme';

interface WidgetSettingsLoaderProps {
  message?: string;
}

export const WidgetSettingsLoader: React.FC<WidgetSettingsLoaderProps> = ({
  message = 'Loading widget settings...',
}) => {
  const [dismissed, setDismissed] = useState(false);
  const showCredentialHint = message?.includes('marketrix_id') || message?.includes('marketrix_key');

  if (dismissed) return null;

  return (
    <div
      className='marketrix-widget-loader'
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '420px',
        backgroundColor: DARK_THEME_COLORS.white95,
        borderRadius: showCredentialHint ? '18px' : '999px',
        boxShadow: `0 2px 12px ${DARK_THEME_COLORS.black15}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '8px',
        padding: '10px 12px',
        border: `1px solid ${DARK_THEME_COLORS.white20}`,
        zIndex: 9999,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <img
          src={MarketrixIcon}
          alt=''
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        />

        <span
          style={{
            fontSize: '13px',
            color: DARK_THEME_COLORS.gray800,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
            minWidth: 0,
          }}
        >
          {message}
        </span>

        <button
          type='button'
          onClick={() => setDismissed(true)}
          aria-label='Dismiss'
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: DARK_THEME_COLORS.gray500,
            borderRadius: '50%',
            width: '20px',
            height: '20px',
          }}
        >
          <svg width='12' height='12' viewBox='0 0 12 12' fill='none'>
            <path
              d='M9 3L3 9M3 3l6 6'
              stroke='currentColor'
              strokeWidth='1.5'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
        </button>
      </div>

      {showCredentialHint ? (
        <p
          style={{
            fontSize: '12px',
            color: DARK_THEME_COLORS.gray500,
            textAlign: 'left',
            margin: 0,
          }}
        >
          Please configure marketrix_id and marketrix_key
        </p>
      ) : null}
    </div>
  );
};

export default WidgetSettingsLoader;
