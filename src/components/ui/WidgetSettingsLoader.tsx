import React from 'react';

import { DARK_THEME_COLORS } from '../../constants/theme';

interface WidgetSettingsLoaderProps {
  message?: string;
}

/**
 * WidgetSettingsLoader
 *
 * Displays a loading state with default widget settings when
 * marketrix_id or marketrix_key are not available
 */
export const WidgetSettingsLoader: React.FC<WidgetSettingsLoaderProps> = ({
  message = 'Loading widget settings...',
}) => {
  return (
    <div
      className='marketrix-widget-loader'
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '320px',
        height: '200px',
        backgroundColor: DARK_THEME_COLORS.white95,
        borderRadius: '12px',
        boxShadow: `0 4px 20px ${DARK_THEME_COLORS.black15}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        border: `1px solid ${DARK_THEME_COLORS.white20}`,
        zIndex: 9999,
      }}
    >
      {/* Loading Spinner */}
      <div
        className='spinner'
        style={{
          width: '48px',
          height: '48px',
          border: `4px solid ${DARK_THEME_COLORS.gray200}`,
          borderTop: `4px solid ${DARK_THEME_COLORS.gray700}`,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>

      {/* Loading Message */}
      <p
        style={{
          marginTop: '16px',
          fontSize: '14px',
          color: DARK_THEME_COLORS.gray800,
          textAlign: 'center',
          fontWeight: 500,
        }}
      >
        {message}
      </p>

      {/* Additional Info - only show if message indicates missing credentials */}
      {message?.includes('marketrix_id') || message?.includes('marketrix_key') ? (
        <p
          style={{
            marginTop: '8px',
            fontSize: '12px',
            color: DARK_THEME_COLORS.gray500,
            textAlign: 'center',
          }}
        >
          Please configure marketrix_id and marketrix_key
        </p>
      ) : null}
    </div>
  );
};

export default WidgetSettingsLoader;
