/**
 * `LAYER_TOKENS` — the widget's z-index ladder (screen-edge glow < panel < dialog < toast), based just
 * above the 2^31-ish ceiling most host pages use so the widget sits over everything without the values
 * overflowing a 32-bit int.
 */
export type LayerTokens = {
  screenEdgeGlow: number;
  panel: number;
  dialog: number;
  toast: number;
};

const WIDGET_LAYER_BASE = 2147483001;

export const LAYER_TOKENS: LayerTokens = {
  screenEdgeGlow: WIDGET_LAYER_BASE,
  panel: WIDGET_LAYER_BASE + 1,
  dialog: WIDGET_LAYER_BASE + 2,
  toast: WIDGET_LAYER_BASE + 3,
};
