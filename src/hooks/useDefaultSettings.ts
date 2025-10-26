/**
 * useDefaultSettings Hook
 *
 * This hook provides centralized access to default widget settings
 * and configuration. It eliminates the need for inline defaults
 * throughout the application.
 */

import { useMemo } from 'react';

import {
  DEFAULT_ADVANCED_SETTINGS,
  DEFAULT_AVATAR,
  DEFAULT_DEVICE_VISIBILITY,
  DEFAULT_LIVE_FORM,
  DEFAULT_RESPONSIVE_BREAKPOINTS,
  DEFAULT_THEMES,
  DEFAULT_WIDGET_ATMOSPHERE,
  DEFAULT_WIDGET_CUSTOMIZE,
  DEFAULT_WIDGET_POSITION,
  DEFAULT_WIDGET_SETTINGS,
} from '../constants';
import type { WidgetAtmosphereConfig, WidgetSettingsData } from '../types';

export interface UseDefaultSettingsReturn {
  widgetSettings: WidgetSettingsData;
  atmosphereConfig: WidgetAtmosphereConfig;
  customizeConfig: typeof DEFAULT_WIDGET_CUSTOMIZE;
  avatarConfig: typeof DEFAULT_AVATAR;
  positionConfig: typeof DEFAULT_WIDGET_POSITION;
  deviceVisibility: typeof DEFAULT_DEVICE_VISIBILITY;
  liveFormConfig: typeof DEFAULT_LIVE_FORM;
  advancedSettings: typeof DEFAULT_ADVANCED_SETTINGS;
  themes: typeof DEFAULT_THEMES;
  responsiveBreakpoints: typeof DEFAULT_RESPONSIVE_BREAKPOINTS;
}

/**
 * Hook to get all default widget settings and configurations
 */
export const useDefaultSettings = (): UseDefaultSettingsReturn => {
  return useMemo(
    () => ({
      widgetSettings: { ...DEFAULT_WIDGET_SETTINGS } as WidgetSettingsData,
      atmosphereConfig: { ...DEFAULT_WIDGET_ATMOSPHERE } as WidgetAtmosphereConfig,
      customizeConfig: { ...DEFAULT_WIDGET_CUSTOMIZE },
      avatarConfig: { ...DEFAULT_AVATAR },
      positionConfig: { ...DEFAULT_WIDGET_POSITION },
      deviceVisibility: { ...DEFAULT_DEVICE_VISIBILITY },
      liveFormConfig: { ...DEFAULT_LIVE_FORM },
      advancedSettings: { ...DEFAULT_ADVANCED_SETTINGS },
      themes: { ...DEFAULT_THEMES },
      responsiveBreakpoints: { ...DEFAULT_RESPONSIVE_BREAKPOINTS },
    }),
    []
  );
};

/**
 * Hook to get default widget settings only
 */
export const useDefaultWidgetSettings = (): WidgetSettingsData => {
  return useMemo(() => ({ ...DEFAULT_WIDGET_SETTINGS }) as WidgetSettingsData, []);
};

/**
 * Hook to get default atmosphere configuration only
 */
export const useDefaultAtmosphereConfig = (): WidgetAtmosphereConfig => {
  return useMemo(() => ({ ...DEFAULT_WIDGET_ATMOSPHERE }) as WidgetAtmosphereConfig, []);
};

/**
 * Hook to get default customize configuration only
 */
export const useDefaultCustomizeConfig = () => {
  return useMemo(() => ({ ...DEFAULT_WIDGET_CUSTOMIZE }), []);
};

/**
 * Hook to get default avatar configuration only
 */
export const useDefaultAvatarConfig = () => {
  return useMemo(() => ({ ...DEFAULT_AVATAR }), []);
};

/**
 * Hook to get default position configuration only
 */
export const useDefaultPositionConfig = () => {
  return useMemo(() => ({ ...DEFAULT_WIDGET_POSITION }), []);
};

/**
 * Hook to get default device visibility configuration only
 */
export const useDefaultDeviceVisibility = () => {
  return useMemo(() => ({ ...DEFAULT_DEVICE_VISIBILITY }), []);
};

/**
 * Hook to get default live form configuration only
 */
export const useDefaultLiveFormConfig = () => {
  return useMemo(() => ({ ...DEFAULT_LIVE_FORM }), []);
};

/**
 * Hook to get default advanced settings only
 */
export const useDefaultAdvancedSettings = () => {
  return useMemo(() => ({ ...DEFAULT_ADVANCED_SETTINGS }), []);
};

/**
 * Hook to get default themes only
 */
export const useDefaultThemes = () => {
  return useMemo(() => ({ ...DEFAULT_THEMES }), []);
};

/**
 * Hook to get default responsive breakpoints only
 */
export const useDefaultResponsiveBreakpoints = () => {
  return useMemo(() => ({ ...DEFAULT_RESPONSIVE_BREAKPOINTS }), []);
};

export default useDefaultSettings;
