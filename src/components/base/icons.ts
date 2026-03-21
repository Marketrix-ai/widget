// SVG icon registry — single source of truth for all icons used in the widget.
//
// Stroke-based families (Feather/fi, Lucide/lu, Heroicons/hi2, Tabler/tb):
//   stroke: 'currentColor', fill: 'none', varying strokeWidth
// Fill-based families (FontAwesome/fa, Material/md, SimpleIcons/si):
//   fill: 'currentColor'
// Mixed (Ionicons/io5): per-icon attributes

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

export const icons = {
  // ─── FontAwesome (fa) — fill-based, viewBox varies ───────────────────────

  /** FaSpinner */
  spinner: {
    viewBox: '0 0 512 512',
    paths: [
      {
        d: 'M304 48c0 26.51-21.49 48-48 48s-48-21.49-48-48 21.49-48 48-48 48 21.49 48 48zm-48 368c-26.51 0-48 21.49-48 48s21.49 48 48 48 48-21.49 48-48-21.49-48-48-48zm208-208c-26.51 0-48 21.49-48 48s21.49 48 48 48 48-21.49 48-48-21.49-48-48-48zM96 256c0-26.51-21.49-48-48-48S0 229.49 0 256s21.49 48 48 48 48-21.49 48-48zm12.922 99.078c-26.51 0-48 21.49-48 48s21.49 48 48 48 48-21.49 48-48c0-26.509-21.491-48-48-48zm294.156 0c-26.51 0-48 21.49-48 48s21.49 48 48 48 48-21.49 48-48c0-26.509-21.49-48-48-48zM108.922 60.922c-26.51 0-48 21.49-48 48s21.49 48 48 48 48-21.49 48-48-21.491-48-48-48z',
        fill: 'currentColor',
      },
    ],
  },

  /** FaCheckCircle */
  checkCircle: {
    viewBox: '0 0 512 512',
    paths: [
      {
        d: 'M504 256c0 136.967-111.033 248-248 248S8 392.967 8 256 119.033 8 256 8s248 111.033 248 248zM227.314 387.314l184-184c6.248-6.248 6.248-16.379 0-22.627l-22.627-22.627c-6.248-6.249-16.379-6.249-22.628 0L216 308.118l-70.059-70.059c-6.248-6.248-16.379-6.248-22.628 0l-22.627 22.627c-6.248 6.248-6.248 16.379 0 22.627l104 104c6.249 6.249 16.379 6.249 22.628.001z',
        fill: 'currentColor',
      },
    ],
  },

  /** FaCircle */
  circle: {
    viewBox: '0 0 512 512',
    paths: [
      {
        d: 'M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8z',
        fill: 'currentColor',
      },
    ],
  },

  /** FaExclamationCircle */
  exclamationCircle: {
    viewBox: '0 0 512 512',
    paths: [
      {
        d: 'M504 256c0 136.997-111.043 248-248 248S8 392.997 8 256C8 119.083 119.043 8 256 8s248 111.083 248 248zm-248 50c-25.405 0-46 20.595-46 46s20.595 46 46 46 46-20.595 46-46-20.595-46-46-46zm-43.673-165.346l7.418 136c.347 6.364 5.609 11.346 11.982 11.346h48.546c6.373 0 11.635-4.982 11.982-11.346l7.418-136c.375-6.874-5.098-12.654-11.982-12.654h-63.383c-6.884 0-12.356 5.78-11.981 12.654z',
        fill: 'currentColor',
      },
    ],
  },

  /** FaTimesCircle */
  timesCircle: {
    viewBox: '0 0 512 512',
    paths: [
      {
        d: 'M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm121.6 313.1c4.7 4.7 4.7 12.3 0 17L338 377.6c-4.7 4.7-12.3 4.7-17 0L256 312l-65.1 65.6c-4.7 4.7-12.3 4.7-17 0L134.4 338c-4.7-4.7-4.7-12.3 0-17l65.6-65-65.6-65.1c-4.7-4.7-4.7-12.3 0-17l39.6-39.6c4.7-4.7 12.3-4.7 17 0l65 65.7 65.1-65.6c4.7-4.7 12.3-4.7 17 0l39.6 39.6c4.7 4.7 4.7 12.3 0 17L312 256l65.6 65.1z',
        fill: 'currentColor',
      },
    ],
  },

  /** FaBan */
  ban: {
    viewBox: '0 0 512 512',
    paths: [
      {
        d: 'M256 8C119.034 8 8 119.033 8 256s111.034 248 248 248 248-111.034 248-248S392.967 8 256 8zm130.108 117.892c65.448 65.448 70 165.481 20.677 235.637L150.47 105.216c70.204-49.356 170.226-44.735 235.638 20.676zM125.892 386.108c-65.448-65.448-70-165.481-20.677-235.637L361.53 406.784c-70.203 49.356-170.226 44.736-235.638-20.676z',
        fill: 'currentColor',
      },
    ],
  },

  /** FaArrowUp */
  arrowUp: {
    viewBox: '0 0 448 512',
    paths: [
      {
        d: 'M34.9 289.5l-22.2-22.2c-9.4-9.4-9.4-24.6 0-33.9L207 39c9.4-9.4 24.6-9.4 33.9 0l194.3 194.3c9.4 9.4 9.4 24.6 0 33.9L413 289.4c-9.5 9.5-25 9.3-34.3-.4L264 168.6V456c0 13.3-10.7 24-24 24h-32c-13.3 0-24-10.7-24-24V168.6L69.2 289.1c-9.3 9.8-24.8 10-34.3.4z',
        fill: 'currentColor',
      },
    ],
  },

  /** FaArrowDown */
  arrowDown: {
    viewBox: '0 0 448 512',
    paths: [
      {
        d: 'M413.1 222.5l22.2 22.2c9.4 9.4 9.4 24.6 0 33.9L241 473c-9.4 9.4-24.6 9.4-33.9 0L12.7 278.6c-9.4-9.4-9.4-24.6 0-33.9l22.2-22.2c9.5-9.5 25-9.3 34.3.4L184 343.4V56c0-13.3 10.7-24 24-24h32c13.3 0 24 10.7 24 24v287.4l114.8-120.5c9.3-9.8 24.8-10 34.3-.4z',
        fill: 'currentColor',
      },
    ],
  },

  // ─── Feather (fi) — stroke-based, 0 0 24 24 ──────────────────────────────

  /** FiInfo — circle + two lines rendered via path-equivalent description.
   *  The original uses <circle> and <line> child elements; represented here
   *  as separate path entries with equivalent geometry. */
  info: {
    viewBox: '0 0 24 24',
    paths: [
      // circle cx=12 cy=12 r=10  (approximated as a closed circular arc path)
      // We keep the raw SVG structure; the Icon component must handle non-path children.
      // For maximum fidelity we store the path-equivalent circle:
      {
        d: 'M 12 2 A 10 10 0 1 1 11.9999 2 Z',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
      // line x1=12 y1=16 x2=12 y2=12
      {
        d: 'M12 16L12 12',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
      // line x1=12 y1=8 x2=12.01 y2=8
      {
        d: 'M12 8L12.01 8',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
    ],
  },

  /** FiTrash2 */
  trash: {
    viewBox: '0 0 24 24',
    paths: [
      // polyline 3 6 5 6 21 6
      {
        d: 'M3 6L5 6L21 6',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
      {
        d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
      {
        d: 'M10 11L10 17',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
      {
        d: 'M14 11L14 17',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
    ],
  },

  /** FiX */
  x: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M18 6L6 18',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
      {
        d: 'M6 6L18 18',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
    ],
  },

  // ─── Ionicons 5 (io5) — mixed, 0 0 512 512 ───────────────────────────────

  /** IoChatbubbleEllipsesOutline */
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
      // circle cx=160 cy=256 r=32
      { d: 'M160 256 m-32 0 a32 32 0 1 1 64 0 a32 32 0 1 1 -64 0', fill: 'currentColor' },
      // circle cx=256 cy=256 r=32
      { d: 'M256 256 m-32 0 a32 32 0 1 1 64 0 a32 32 0 1 1 -64 0', fill: 'currentColor' },
      // circle cx=352 cy=256 r=32
      { d: 'M352 256 m-32 0 a32 32 0 1 1 64 0 a32 32 0 1 1 -64 0', fill: 'currentColor' },
    ],
  },

  /** IoStop */
  stop: {
    viewBox: '0 0 512 512',
    paths: [
      {
        d: 'M392 432H120a40 40 0 0 1-40-40V120a40 40 0 0 1 40-40h272a40 40 0 0 1 40 40v272a40 40 0 0 1-40 40z',
        fill: 'currentColor',
      },
    ],
  },

  // ─── Lucide (lu) — stroke-based, 0 0 24 24 ───────────────────────────────

  /** LuMousePointerClick */
  mousePointerClick: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M14 4.1 12 6',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
      {
        d: 'm5.1 8-2.9-.8',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
      {
        d: 'm6 12-1.9 2',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
      {
        d: 'M7.2 2.2 8 5.1',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
      {
        d: 'M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
    ],
  },

  /** LuScroll */
  scroll: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M19 17V5a2 2 0 0 0-2-2H4',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
      {
        d: 'M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
    ],
  },

  // ─── Simple Icons (si) — fill-based, 0 0 24 24 ───────────────────────────

  /** SiTicktick */
  ticktick: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M12 0C5.383 0 0 5.383 0 12s5.383 12 12 12 12-5.383 12-12h-2.7c0 5.128-4.172 9.3-9.3 9.3-5.128 0-9.3-4.172-9.3-9.3 0-5.128 4.172-9.3 9.3-9.3V0Zm7.4 2.583-7.505 9.371L8.388 9.08l-2.002 2.436 4.741 3.888a1.573 1.573 0 0 0 2.231-.233l8.504-10.617L19.4 2.583Z',
        fill: 'currentColor',
      },
    ],
  },

  // ─── Heroicons Outline (hi2) — stroke-based, 0 0 24 24, strokeWidth 1.5 ──

  /** HiOutlineArrowRight */
  arrowRight: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
    ],
  },

  /** HiOutlineDocumentText */
  documentText: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
    ],
  },

  /** HiOutlineGlobeAlt */
  globe: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
    ],
  },

  /** HiOutlineMagnifyingGlass */
  magnifyingGlass: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'm21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
    ],
  },

  /** HiOutlineXMark */
  xMark: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M6 18 18 6M6 6l12 12',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
    ],
  },

  // ─── Material Design Outline (md) — fill-based, 0 0 24 24 ────────────────

  /** MdOutlineKeyboard */
  keyboard: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M20 7v10H4V7h16m0-2H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2zm0 3h2v2h-2zM8 8h2v2H8zm0 3h2v2H8zm-3 0h2v2H5zm0-3h2v2H5zm3 6h8v2H8zm6-3h2v2h-2zm0-3h2v2h-2zm3 3h2v2h-2zm0-3h2v2h-2z',
        fill: 'currentColor',
      },
    ],
  },

  /** MdOutlineSelectAll */
  selectAll: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M3 5h2V3c-1.1 0-2 .9-2 2zm0 8h2v-2H3v2zm4 8h2v-2H7v2zM3 9h2V7H3v2zm10-6h-2v2h2V3zm6 0v2h2c0-1.1-.9-2-2-2zM5 21v-2H3c0 1.1.9 2 2 2zm-2-4h2v-2H3v2zM9 3H7v2h2V3zm2 18h2v-2h-2v2zm8-8h2v-2h-2v2zm0 8c1.1 0 2-.9 2-2h-2v2zm0-12h2V7h-2v2zm0 8h2v-2h-2v2zm-4 4h2v-2h-2v2zm0-16h2V3h-2v2zM7 17h10V7H7v10zm2-8h6v6H9V9z',
        fill: 'currentColor',
      },
    ],
  },

  // ─── Tabler (tb) — stroke-based, 0 0 24 24 ───────────────────────────────

  /** TbArrowDown */
  tablerArrowDown: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M12 5l0 14',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
      {
        d: 'M18 13l-6 6',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
      {
        d: 'M6 13l6 6',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
    ],
  },

  /** TbFileUpload */
  fileUpload: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M14 3v4a1 1 0 0 0 1 1h4',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
      {
        d: 'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
      {
        d: 'M12 11v6',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
      {
        d: 'M9.5 13.5l2.5 -2.5l2.5 2.5',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
    ],
  },

  // ─── Inline SVG icons (from component files) ─────────────────────────────

  /** Home icon — from MessengerShell TAB_ICONS.home, viewBox 0 0 24 24 */
  home: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
    ],
  },

  /** Chat bubble dots icon — from MessengerShell TAB_ICONS.chat and HomeView CTA */
  chat: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
    ],
  },

  /** Help / question mark circle — from MessengerShell TAB_ICONS.help */
  help: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
    ],
  },

  /** Send / arrow right — from MessageInput send button */
  send: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M5 12h14m-7-7l7 7-7 7',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
    ],
  },

  /** Close X (small) — 12×12 viewBox used in NotificationToast, WidgetSettingsLoader */
  closeSmall: {
    viewBox: '0 0 12 12',
    paths: [
      {
        d: 'M9 3L3 9M3 3l6 6',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
    ],
  },

  /** Close X (fill) — 20×20 fill variant used in MessengerShell header/minimized state */
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

  /** Chevron down — from WidgetButton open/close toggle */
  chevronDown: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M19 9l-7 7-7-7',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
    ],
  },

  /** Screen share / video camera — from MessengerShell header screen share button */
  screenShare: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
    ],
  },

  /** More vertical (three dots) — from MessengerShell more options menu */
  moreVertical: {
    viewBox: '0 0 20 20',
    paths: [
      {
        d: 'M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z',
        fill: 'currentColor',
      },
    ],
  },

  /** Chevron right — from HomeView "Ask a question" CTA */
  chevronRight: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M9 5l7 7-7 7',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
    ],
  },

  /** Alert circle / error — from VideoStreamDisplay stream error state */
  alertCircle: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
    ],
  },
} as const satisfies Record<string, IconData>;

export type IconName = keyof typeof icons;
