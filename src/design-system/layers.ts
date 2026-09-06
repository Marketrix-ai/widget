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
