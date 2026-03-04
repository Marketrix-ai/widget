export const DARK_THEME_CLASSES = {
  allowButton:
    'flex items-center justify-center text-sm font-medium transition-all duration-200 bg-gray-900 text-white shadow-lg border-2 border-transparent hover:bg-gray-800',
  allowButtonCompact:
    'px-5 py-1 bg-gray-900 text-white rounded-full transition-all duration-200 text-sm font-medium hover:bg-gray-800',
  denyButton:
    'flex items-center justify-center text-sm font-medium transition-all duration-200 bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-200',
  denyButtonCompact:
    'px-6 py-1 bg-gray-100 text-gray-800 rounded-full transition-all duration-200 text-sm font-medium hover:bg-gray-200 border border-gray-200',
  scrollbarTrack: 'scrollbar-track-gray-100',
  scrollbarThumb: 'scrollbar-thumb-gray-400',
} as const;

export const DARK_THEME_COLORS = {
  white: '#ffffff',
  black: '#000000',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
  white70: 'rgba(255, 255, 255, 0.7)',
  white95: 'rgba(255, 255, 255, 0.95)',
  white20: 'rgba(255, 255, 255, 0.2)',
  black10: 'rgba(0, 0, 0, 0.1)',
  black06: 'rgba(0, 0, 0, 0.06)',
  black15: 'rgba(0, 0, 0, 0.15)',
  liveBadgeShadow: 'rgba(31, 41, 55, 0.4)',
  videoGradient: 'linear-gradient(135deg, #111827 0%, #374151 100%)',
} as const;
