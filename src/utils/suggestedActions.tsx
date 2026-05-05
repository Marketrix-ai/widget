import React from 'react';

import { Icon } from '../components/base';
import type { MarketrixConfig } from '../types';

type ChipData = {
  chip_mode: 'show' | 'tell' | 'do';
  chip_text: string;
};

export interface SuggestedActionItem {
  id: string;
  text: string;
  icon: React.ReactElement;
  type: 'tell' | 'show' | 'do';
  isShow: boolean;
}

const DEFAULT_CHIPS: SuggestedActionItem[] = [
  {
    id: 'show-add-product',
    text: 'Show me how to add a new product',
    icon: <Icon name='mousePointerClick' size={24} />,
    type: 'show',
    isShow: true,
  },
  {
    id: 'show-login',
    text: 'Show me how to login',
    icon: <Icon name='mousePointerClick' size={24} />,
    type: 'show',
    isShow: true,
  },
  {
    id: 'do-login',
    text: 'Do the login process for me',
    icon: <Icon name='ticktick' size={16} />,
    type: 'do',
    isShow: false,
  },
  {
    id: 'show-revenue',
    text: 'Show me the revenue metrics',
    icon: <Icon name='mousePointerClick' size={24} />,
    type: 'show',
    isShow: true,
  },
  {
    id: 'tell-conversion-rate',
    text: 'What does my conversion rate mean and how can I improve it?',
    icon: <Icon name='chatBubble' size={20} />,
    type: 'tell',
    isShow: false,
  },
];

function getIconForMode(mode: 'show' | 'tell' | 'do') {
  switch (mode) {
    case 'do':
      return <Icon name='ticktick' size={12} />;
    case 'show':
      return <Icon name='mousePointerClick' size={12} />;
    case 'tell':
    default:
      return <Icon name='chatBubble' size={12} />;
  }
}

export function getSuggestedActionsFromConfig(config: MarketrixConfig): SuggestedActionItem[] {
  const chips = config.widget_chips as ChipData[] | undefined;
  if (chips && Array.isArray(chips) && chips.length > 0) {
    const seen = new Set<string>();
    return chips.map((chip: ChipData, index: number) => {
      const chipText = chip.chip_text;
      const mode = chip.chip_mode;
      const uniqueId = `chip-${chipText.replace(/\s+/g, '-').toLowerCase()}-${index}`;
      let id = uniqueId;
      let c = 0;
      while (seen.has(id)) {
        c++;
        id = `${uniqueId}-${c}`;
      }
      seen.add(id);
      return {
        id,
        text: chipText,
        icon: getIconForMode(mode),
        type: mode,
        isShow: mode === 'show',
      };
    });
  }
  return DEFAULT_CHIPS;
}
