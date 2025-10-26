import React from 'react';

import type { WidgetSettingsData } from '../sdk';

interface IntegrationSettingsDebugProps {
  settings: WidgetSettingsData | null;
  isLoading: boolean;
  error: string | null;
}

export const IntegrationSettingsDebug: React.FC<IntegrationSettingsDebugProps> = ({
  settings,
  isLoading,
  error,
}) => {
  if (isLoading) {
    return (
      <div className='fixed top-4 left-4 z-50 bg-blue-500 text-white p-3 rounded-lg shadow-lg max-w-sm'>
        <div className='flex items-center gap-2'>
          <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
          <span>Loading integration settings...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='fixed top-4 left-4 z-50 bg-red-500 text-white p-3 rounded-lg shadow-lg max-w-sm'>
        <div className='font-semibold'>Settings Error:</div>
        <div className='text-sm'>{error}</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className='fixed top-4 left-4 z-50 bg-yellow-500 text-white p-3 rounded-lg shadow-lg max-w-sm'>
        <div className='font-semibold'>No Settings Found</div>
        <div className='text-sm'>Using default configuration</div>
      </div>
    );
  }

  return (
    <div className='fixed top-4 left-4 z-50 bg-green-500 text-white p-3 rounded-lg shadow-lg max-w-sm'>
      <div className='font-semibold mb-2'>✅ Integration Settings Loaded</div>
      <div className='text-sm space-y-1'>
        <div>
          <strong>Header:</strong> {settings.widget_header}
        </div>
        <div>
          <strong>Position:</strong> {settings.widget_position}
        </div>
        <div>
          <strong>Appearance:</strong> {settings.widget_appearance}
        </div>
        <div>
          <strong>Features:</strong>
          {settings.widget_feature_tell && ' Tell'}
          {settings.widget_feature_show && ' Show'}
          {settings.widget_feature_do && ' Do'}
        </div>
        <div>
          <strong>Colors:</strong>
          <span
            className='inline-block w-4 h-4 rounded border ml-1'
            style={{ backgroundColor: settings.widget_accent_color }}
            title={settings.widget_accent_color}
          ></span>
        </div>
      </div>
    </div>
  );
};
