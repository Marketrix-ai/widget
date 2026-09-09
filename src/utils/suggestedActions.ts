/**
 * The suggested-action chips the home view offers a visitor: one per tenant-configured `widget_chips`
 * entry, or the built-in `DEFAULT_CHIPS` when the tenant configured none. `SuggestedActionItem` is what a
 * chip renders and dispatches as; `getSuggestedActionsFromConfig` maps a `MarketrixConfig`'s chips onto it.
 *
 * A chip's caption doubles as the instruction dispatched on click, so a `show`/`do` caption missing its
 * mode prefix is given one. The strip patterns demand whitespace after the mode word so re-prefixing
 * cannot eat letters from a caption that merely begins with it ("Download…" stays "Do Download…", not
 * "Do wnload…"). `tell` captions are free text and take no prefix. The id carries the chip's index
 * because two chips may share a caption and the slug alone would collide.
 */

import type { InstructionType, MarketrixConfig } from '../types';

export interface SuggestedActionItem {
  id: string;
  text: string;
  type: InstructionType;
}

const DEFAULT_CHIPS: SuggestedActionItem[] = [
  { id: 'show-add-product', text: 'Show me how to add a new product', type: 'show' },
  { id: 'show-login', text: 'Show me how to login', type: 'show' },
  { id: 'do-login', text: 'Do the login process for me', type: 'do' },
  { id: 'show-revenue', text: 'Show me the revenue metrics', type: 'show' },
  { id: 'tell-conversion-rate', text: 'What does my conversion rate mean and how can I improve it?', type: 'tell' },
];

export function getSuggestedActionsFromConfig(config: MarketrixConfig): SuggestedActionItem[] {
  const chips = config.widget_chips;
  if (!chips?.length) return DEFAULT_CHIPS;

  return chips.map((chip, index) => ({
    id: `chip-${chip.chip_text.replace(/\s+/g, '-').toLowerCase()}-${index}`,
    text:
      chip.chip_mode === 'show'
        ? `Show me ${chip.chip_text.replace(/^Show me\s+/i, '')}`
        : chip.chip_mode === 'do'
          ? `Do ${chip.chip_text.replace(/^Do\s+/i, '')}`
          : chip.chip_text,
    type: chip.chip_mode,
  }));
}
