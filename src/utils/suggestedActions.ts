import type { MarketrixConfig } from '../types';

export interface SuggestedActionItem {
  id: string;
  text: string;
  type: 'tell' | 'show' | 'do';
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
    text: chip.chip_text,
    type: chip.chip_mode,
  }));
}
