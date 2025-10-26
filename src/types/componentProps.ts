/**
 * Standardized Component Props
 *
 * This file provides consistent prop type definitions for all widget components.
 * It ensures uniform prop patterns and eliminates prop drilling issues.
 */

import type { MarketrixConfig, WidgetAtmosphereConfig, WidgetSettingsData } from './index';
import type { WidgetEvents, WidgetHookReturn, WidgetState } from './widget';

// Base component props that all widget components should extend
export interface BaseComponentProps {
  className?: string;
  style?: React.CSSProperties;
  testId?: string;
}

// Configuration props - always use MarketrixConfig
export interface ConfigProps {
  config: MarketrixConfig;
}

// Settings props - always use WidgetSettingsData from SDK
export interface SettingsProps {
  settings?: WidgetSettingsData;
}

// Atmosphere props - for components that need atmosphere config
export interface AtmosphereProps {
  atmosphere?: WidgetAtmosphereConfig;
}

// Widget state props
export interface WidgetStateProps {
  state?: WidgetState;
}

// Widget event props
export interface WidgetEventProps {
  events?: WidgetEvents;
}

// Loading and error states
export interface LoadingProps {
  isLoading?: boolean;
  error?: string | null;
}

// Visibility props
export interface VisibilityProps {
  isVisible?: boolean;
  isOpen?: boolean;
  isMinimized?: boolean;
}

// Size and position props
export interface SizeProps {
  width?: string | number;
  height?: string | number;
  minWidth?: string | number;
  minHeight?: string | number;
  maxWidth?: string | number;
  maxHeight?: string | number;
}

export interface PositionProps {
  position?: 'absolute' | 'relative' | 'fixed' | 'static';
  top?: string | number;
  right?: string | number;
  bottom?: string | number;
  left?: string | number;
  zIndex?: number;
}

// Chat-specific props
export interface ChatProps {
  messages?: Array<{
    id: string;
    content: string;
    sender: 'user' | 'bot' | 'agent';
    timestamp: Date;
    type?: 'text' | 'image' | 'file';
  }>;
  onSendMessage?: (message: string) => void;
  onTyping?: (isTyping: boolean) => void;
}

// Avatar-specific props
export interface AvatarProps {
  avatarUrl?: string;
  avatarName?: string;
  avatarStatus?: 'online' | 'offline' | 'busy' | 'away';
  showStatus?: boolean;
  size?: 'small' | 'medium' | 'large';
}

// Button-specific props
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}

// Input-specific props
export interface InputProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyPress?: (key: string) => void;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
}

// Modal-specific props
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

// Form-specific props
export interface FormProps {
  onSubmit?: (data: Record<string, any>) => void;
  onReset?: () => void;
  validation?: Record<string, (value: any) => string | null>;
  initialValues?: Record<string, any>;
}

// List-specific props
export interface ListProps<T = any> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor?: (item: T, index: number) => string;
  emptyMessage?: string;
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

// Combined prop types for common component patterns
export interface WidgetComponentProps
  extends BaseComponentProps,
    ConfigProps,
    SettingsProps,
    LoadingProps,
    VisibilityProps,
    WidgetEventProps {}

export interface ChatComponentProps
  extends BaseComponentProps,
    ConfigProps,
    SettingsProps,
    ChatProps,
    LoadingProps,
    VisibilityProps {}

export interface AvatarComponentProps extends BaseComponentProps, AvatarProps, VisibilityProps {}

export interface ButtonComponentProps extends BaseComponentProps, ButtonProps {}

export interface InputComponentProps extends BaseComponentProps, InputProps {}

export interface ModalComponentProps
  extends BaseComponentProps,
    ModalProps,
    SizeProps,
    PositionProps {}

export interface FormComponentProps extends BaseComponentProps, FormProps {}

export interface ListComponentProps<T = any> extends BaseComponentProps, ListProps<T>, SizeProps {}

// Hook return types
export interface UseWidgetReturn extends WidgetHookReturn<WidgetState> {
  config: MarketrixConfig;
  settings: WidgetSettingsData | null;
  atmosphere: WidgetAtmosphereConfig | null;
  actions: {
    open: () => void;
    close: () => void;
    minimize: () => void;
    maximize: () => void;
    sendMessage: (message: string) => void;
    updateSettings: (settings: Partial<WidgetSettingsData>) => void;
    updateAtmosphere: (atmosphere: Partial<WidgetAtmosphereConfig>) => void;
  };
}

export interface UseChatReturn extends WidgetHookReturn {
  messages: ChatProps['messages'];
  isTyping: boolean;
  actions: {
    sendMessage: (message: string) => void;
    clearMessages: () => void;
    startTyping: () => void;
    stopTyping: () => void;
  };
}

export interface UseAvatarReturn extends WidgetHookReturn {
  avatar: {
    url: string;
    name: string;
    status: AvatarProps['avatarStatus'];
  };
  actions: {
    updateStatus: (status: AvatarProps['avatarStatus']) => void;
    updateAvatar: (url: string, name: string) => void;
  };
}

// Utility types for prop validation
export type RequiredProps<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type OptionalProps<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type PartialProps<T> = Partial<T>;
export type PickProps<T, K extends keyof T> = Pick<T, K>;
export type OmitProps<T, K extends keyof T> = Omit<T, K>;
