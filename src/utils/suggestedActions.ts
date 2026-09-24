/**
 * The suggested-action chips the home view offers a visitor, one per tenant-configured `widget_chips` entry.
 * `SuggestedActionItem` is what a chip renders and dispatches as; `getSuggestedActionsFromConfig` maps a
 * config's chips onto it, prefixing a `show`/`do` caption with its mode since the caption is the instruction,
 * and drops a chip whose mode the tenant disabled.
 * `PREVIEW_CHIPS` fills an empty list only in the settings preview: a live tenant must never be offered
 * another product's demo actions.
 */

import type { InstructionType, ValidWidgetConfig } from '../types';
import { enabledModes } from './chat';

export interface SuggestedActionItem {
  id: string;
  text: string;
  type: InstructionType;
}

const PREVIEW_CHIPS: SuggestedActionItem[] = [
  { id: 'show-add-product', text: 'Show me how to add a new product', type: 'show' },
  { id: 'show-login', text: 'Show me how to login', type: 'show' },
  { id: 'do-login', text: 'Do the login process for me', type: 'do' },
  { id: 'show-revenue', text: 'Show me the revenue metrics', type: 'show' },
  { id: 'tell-conversion-rate', text: 'What does my conversion rate mean and how can I improve it?', type: 'tell' },
];

export function getSuggestedActionsFromConfig(config: ValidWidgetConfig): SuggestedActionItem[] {
  const modes = enabledModes(config);
  const chips = config.widget_chips;
  if (!chips.length) return config.isPreviewMode ? PREVIEW_CHIPS.filter(chip => modes.includes(chip.type)) : [];

  return chips.flatMap((chip, index) =>
    modes.includes(chip.chip_mode)
      ? [
          {
            id: `chip-${chip.chip_text.replace(/\s+/g, '-').toLowerCase()}-${index}`,
            text:
              chip.chip_mode === 'show'
                ? `Show me ${chip.chip_text.replace(/^Show me\s+/i, '')}`
                : chip.chip_mode === 'do'
                  ? `Do ${chip.chip_text.replace(/^Do\s+/i, '')}`
                  : chip.chip_text,
            type: chip.chip_mode,
          },
        ]
      : [],
  );
}
