import React from 'react';

import { Button } from '../base/Button';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import type { IconName } from '../base/icons';
import { Stack } from '../base/Stack';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';

export interface ToolItem {
  id: string;
  name: string;
  description: string;
  icon: IconName;
}

export interface ToolCategory {
  id: string;
  label: string;
  tools: ToolItem[];
}

export interface ToolPanelProps {
  categories: ToolCategory[];
  activeCategory: string;
  onCategoryChange: (id: string) => void;
  onToolSelect: (tool: ToolItem) => void;
  selectedTool?: string;
}

interface ToolCardProps {
  tool: ToolItem;
  selected: boolean;
  onSelect: (tool: ToolItem) => void;
}

const ToolCard: React.FC<ToolCardProps> = ({ tool, selected, onSelect }) => (
  <Button
    type='button'
    variant='ghost'
    onClick={() => onSelect(tool)}
    className={`w-full flex items-start gap-2 p-2 rounded-lg text-left transition-colors border ${
      selected ? 'border-border bg-secondary-bg' : 'border-border/40 bg-card hover:bg-secondary-bg hover:border-border'
    }`}
  >
    <Flex className='shrink-0 items-center justify-center w-8 h-8 rounded bg-secondary-bg text-foreground-faint'>
      <Icon name={tool.icon} size={16} />
    </Flex>
    <Stack className='flex-1 min-w-0 text-left'>
      <Text as='div' size='sm' weight='medium' truncate>
        {tool.name}
      </Text>
      <Text as='div' size='xs' variant='muted' truncate>
        {tool.description}
      </Text>
    </Stack>
  </Button>
);

export const ToolPanel: React.FC<ToolPanelProps> = ({
  categories,
  activeCategory,
  onCategoryChange,
  onToolSelect,
  selectedTool,
}) => {
  const activeTools = categories.find(c => c.id === activeCategory)?.tools ?? [];
  const activeCategoryLabel = categories.find(c => c.id === activeCategory)?.label ?? '';

  return (
    <Surface className='border border-border rounded-lg overflow-hidden flex flex-col'>
      {/* Category tabs */}
      <Flex className='border-b border-border bg-secondary-bg/50'>
        {categories.map(cat => {
          const isActive = cat.id === activeCategory;
          return (
            <Button
              key={cat.id}
              type='button'
              variant='ghost'
              onClick={() => onCategoryChange(cat.id)}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors border-b-2 rounded-none ${
                isActive
                  ? 'border-foreground text-foreground bg-card'
                  : 'border-transparent text-foreground-faint hover:text-foreground hover:bg-card/50'
              }`}
            >
              {cat.label}
            </Button>
          );
        })}
      </Flex>

      {/* Tools list */}
      <div className='flex-1 overflow-y-auto p-2' style={{ maxHeight: '300px' }}>
        <Stack className='gap-1.5'>
          {activeTools.map(tool => (
            <ToolCard key={tool.id} tool={tool} selected={selectedTool === tool.id} onSelect={onToolSelect} />
          ))}
        </Stack>
      </div>

      {/* Footer */}
      <Flex className='px-3 py-2 border-t border-border bg-secondary-bg/50'>
        <Text size='xs' variant='muted'>
          {activeTools.length} tool{activeTools.length !== 1 ? 's' : ''} in {activeCategoryLabel}
        </Text>
      </Flex>
    </Surface>
  );
};
