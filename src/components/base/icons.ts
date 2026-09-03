export interface IconPath {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number | string;
  strokeLinecap?: 'butt' | 'round' | 'square';
  strokeLinejoin?: 'miter' | 'round' | 'bevel';
  strokeMiterlimit?: number | string;
  fillRule?: 'nonzero' | 'evenodd';
  clipRule?: 'nonzero' | 'evenodd';
}

export interface IconData {
  viewBox: string;
  paths: IconPath[];
}

/** Icon.tsx resolves an absent `fill` to 'none' whenever a stroke is set, so a stroked path omits it. */
const stroked = (d: string, strokeWidth = 2): IconPath => ({
  d,
  stroke: 'currentColor',
  strokeWidth,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
});

export const icons = {
  checkCircle: {
    viewBox: '0 0 512 512',
    paths: [
      {
        d: 'M504 256c0 136.967-111.033 248-248 248S8 392.967 8 256 119.033 8 256 8s248 111.033 248 248zM227.314 387.314l184-184c6.248-6.248 6.248-16.379 0-22.627l-22.627-22.627c-6.248-6.249-16.379-6.249-22.628 0L216 308.118l-70.059-70.059c-6.248-6.248-16.379-6.248-22.628 0l-22.627 22.627c-6.248 6.248-6.248 16.379 0 22.627l104 104c6.249 6.249 16.379 6.249 22.628.001z',
        fill: 'currentColor',
      },
    ],
  },

  circle: {
    viewBox: '0 0 512 512',
    paths: [
      {
        d: 'M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8z',
        fill: 'currentColor',
      },
    ],
  },

  exclamationCircle: {
    viewBox: '0 0 512 512',
    paths: [
      {
        d: 'M504 256c0 136.997-111.043 248-248 248S8 392.997 8 256C8 119.083 119.043 8 256 8s248 111.083 248 248zm-248 50c-25.405 0-46 20.595-46 46s20.595 46 46 46 46-20.595 46-46-20.595-46-46-46zm-43.673-165.346l7.418 136c.347 6.364 5.609 11.346 11.982 11.346h48.546c6.373 0 11.635-4.982 11.982-11.346l7.418-136c.375-6.874-5.098-12.654-11.982-12.654h-63.383c-6.884 0-12.356 5.78-11.981 12.654z',
        fill: 'currentColor',
      },
    ],
  },

  arrowUp: {
    viewBox: '0 0 448 512',
    paths: [
      {
        d: 'M34.9 289.5l-22.2-22.2c-9.4-9.4-9.4-24.6 0-33.9L207 39c9.4-9.4 24.6-9.4 33.9 0l194.3 194.3c9.4 9.4 9.4 24.6 0 33.9L413 289.4c-9.5 9.5-25 9.3-34.3-.4L264 168.6V456c0 13.3-10.7 24-24 24h-32c-13.3 0-24-10.7-24-24V168.6L69.2 289.1c-9.3 9.8-24.8 10-34.3.4z',
        fill: 'currentColor',
      },
    ],
  },

  arrowDown: {
    viewBox: '0 0 448 512',
    paths: [
      {
        d: 'M413.1 222.5l22.2 22.2c9.4 9.4 9.4 24.6 0 33.9L241 473c-9.4 9.4-24.6 9.4-33.9 0L12.7 278.6c-9.4-9.4-9.4-24.6 0-33.9l22.2-22.2c9.5-9.5 25-9.3 34.3.4L184 343.4V56c0-13.3 10.7-24 24-24h32c13.3 0 24 10.7 24 24v287.4l114.8-120.5c9.3-9.8 24.8-10 34.3-.4z',
        fill: 'currentColor',
      },
    ],
  },

  chatBubble: {
    viewBox: '0 0 512 512',
    paths: [
      {
        d: 'M87.48 380c1.2-4.38-1.43-10.47-3.94-14.86a42.63 42.63 0 0 0-2.54-3.8 199.81 199.81 0 0 1-33-110C47.64 139.09 140.72 48 255.82 48 356.2 48 440 117.54 459.57 209.85a199 199 0 0 1 4.43 41.64c0 112.41-89.49 204.93-204.59 204.93-18.31 0-43-4.6-56.47-8.37s-26.92-8.77-30.39-10.11a31.14 31.14 0 0 0-11.13-2.07 30.7 30.7 0 0 0-12.08 2.43L81.5 462.78a15.92 15.92 0 0 1-4.66 1.22 9.61 9.61 0 0 1-9.58-9.74 15.85 15.85 0 0 1 .6-3.29z',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 32,
        strokeLinecap: 'round',
      },
      { d: 'M160 256 m-32 0 a32 32 0 1 1 64 0 a32 32 0 1 1 -64 0', fill: 'currentColor' },
      { d: 'M256 256 m-32 0 a32 32 0 1 1 64 0 a32 32 0 1 1 -64 0', fill: 'currentColor' },
      { d: 'M352 256 m-32 0 a32 32 0 1 1 64 0 a32 32 0 1 1 -64 0', fill: 'currentColor' },
    ],
  },

  stop: {
    viewBox: '0 0 512 512',
    paths: [
      {
        d: 'M392 432H120a40 40 0 0 1-40-40V120a40 40 0 0 1 40-40h272a40 40 0 0 1 40 40v272a40 40 0 0 1-40 40z',
        fill: 'currentColor',
      },
    ],
  },

  mousePointerClick: {
    viewBox: '0 0 24 24',
    paths: [
      stroked('M14 4.1 12 6'),
      stroked('m5.1 8-2.9-.8'),
      stroked('m6 12-1.9 2'),
      stroked('M7.2 2.2 8 5.1'),
      stroked(
        'M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z',
      ),
    ],
  },

  ticktick: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M12 0C5.383 0 0 5.383 0 12s5.383 12 12 12 12-5.383 12-12h-2.7c0 5.128-4.172 9.3-9.3 9.3-5.128 0-9.3-4.172-9.3-9.3 0-5.128 4.172-9.3 9.3-9.3V0Zm7.4 2.583-7.505 9.371L8.388 9.08l-2.002 2.436 4.741 3.888a1.573 1.573 0 0 0 2.231-.233l8.504-10.617L19.4 2.583Z',
        fill: 'currentColor',
      },
    ],
  },

  home: {
    viewBox: '0 0 24 24',
    paths: [
      stroked(
        'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      ),
    ],
  },

  chat: {
    viewBox: '0 0 24 24',
    paths: [
      stroked(
        'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      ),
    ],
  },

  send: {
    viewBox: '0 0 24 24',
    paths: [stroked('M5 12h14m-7-7l7 7-7 7')],
  },

  closeSmall: {
    viewBox: '0 0 12 12',
    paths: [stroked('M9 3L3 9M3 3l6 6', 1.5)],
  },

  close: {
    viewBox: '0 0 20 20',
    paths: [
      {
        d: 'M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z',
        fill: 'currentColor',
        fillRule: 'evenodd',
        clipRule: 'evenodd',
      },
    ],
  },

  chevronDown: {
    viewBox: '0 0 24 24',
    paths: [stroked('M19 9l-7 7-7-7', 2.5)],
  },

  screenShare: {
    viewBox: '0 0 24 24',
    paths: [
      stroked(
        'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
      ),
    ],
  },

  alertCircle: {
    viewBox: '0 0 24 24',
    paths: [stroked('M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z')],
  },
} as const satisfies Record<string, IconData>;

export type IconName = keyof typeof icons;
