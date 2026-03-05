import React from 'react';
import { IoChatbubbleEllipsesOutline } from 'react-icons/io5';
import { LuMousePointerClick } from 'react-icons/lu';
import { SiTicktick } from 'react-icons/si';

import type { MarketrixConfig } from '../types';

type ChipData = {
  chip_mode?: 'show' | 'tell' | 'do' | string;
  chip_text?: string;
  type?: 'show' | 'tell' | 'do' | string;
  question?: string;
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
    icon: <LuMousePointerClick className='w-6 h-6' />,
    type: 'show',
    isShow: true,
  },
  {
    id: 'show-login',
    text: 'Show me how to login',
    icon: <LuMousePointerClick className='w-6 h-6' />,
    type: 'show',
    isShow: true,
  },
  {
    id: 'do-login',
    text: 'Do the login process for me',
    icon: <SiTicktick className='w-4 h-4' />,
    type: 'do',
    isShow: false,
  },
  {
    id: 'show-revenue',
    text: 'Show me the revenue metrics',
    icon: <LuMousePointerClick className='w-6 h-6' />,
    type: 'show',
    isShow: true,
  },
  {
    id: 'tell-conversion-rate',
    text: 'What does my conversion rate mean and how can I improve it?',
    icon: <IoChatbubbleEllipsesOutline className='w-5 h-5' />,
    type: 'tell',
    isShow: false,
  },
];

function getIconForMode(mode: 'show' | 'tell' | 'do') {
  switch (mode) {
    case 'do':
      return (
        <SiTicktick className='w-3 h-3 text-xs' style={{ fontSize: '0.75rem', width: '0.75rem', height: '0.75rem' }} />
      );
    case 'show':
      return (
        <LuMousePointerClick
          className='w-3 h-3 text-xs'
          style={{ fontSize: '0.75rem', width: '0.75rem', height: '0.75rem' }}
        />
      );
    case 'tell':
    default:
      return (
        <IoChatbubbleEllipsesOutline
          className='w-3 h-3 text-xs'
          style={{ fontSize: '0.75rem', width: '0.75rem', height: '0.75rem' }}
        />
      );
  }
}

export function getSuggestedActionsFromConfig(config: MarketrixConfig): SuggestedActionItem[] {
  const chips = config.widget_chips as ChipData[] | undefined;
  if (chips && Array.isArray(chips) && chips.length > 0) {
    const seen = new Set<string>();
    return chips.map((chip: ChipData, index: number) => {
      const chipText = chip.chip_text || chip.question || '';
      const chipMode = chip.chip_mode || chip.type || 'tell';
      const mode: 'show' | 'tell' | 'do' =
        chipMode === 'show' || chipMode === 'tell' || chipMode === 'do' ? chipMode : 'tell';
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
