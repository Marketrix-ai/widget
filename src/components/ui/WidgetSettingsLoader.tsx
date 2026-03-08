import React, { useState } from 'react';

import { DARK_THEME_COLORS } from '../../constants/theme';

interface WidgetSettingsLoaderProps {
  message?: string;
}

const MARKETRIX_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 361 360">
  <rect x=".5" width="360" height="360" fill="#101828"/>
  <circle cx="83.37" cy="181.78" r="27.8" fill="#7cffa6"/>
  <path fill="#fff" d="M85.86,68.28l152.45,223.44h67.29l-70.62-113.77,68.13-109.67h-67.29l-41.12,65.31-41.54-65.31h-67.29Z"/>
  <path fill="#7cffa6" stroke="#7cffa6" stroke-width=".38" d="M176.61,249.83l-35.08-51-57.82,92.71h66.85l26.05-41.7Z"/>
</svg>`;

export const WidgetSettingsLoader: React.FC<WidgetSettingsLoaderProps> = ({
  message = 'Loading widget settings...',
}) => {
  const [dismissed, setDismissed] = useState(false);

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
        borderRadius: '999px',
        boxShadow: `0 2px 12px ${DARK_THEME_COLORS.black15}`,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px 8px 8px',
        border: `1px solid ${DARK_THEME_COLORS.white20}`,
        zIndex: 9999,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Marketrix Logo */}
      <div
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          overflow: 'hidden',
          flexShrink: 0,
        }}
        dangerouslySetInnerHTML={{ __html: MARKETRIX_ICON_SVG }}
      />

      {/* Message */}
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

      {/* Close Button */}
      <button
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
  );
};

export default WidgetSettingsLoader;
