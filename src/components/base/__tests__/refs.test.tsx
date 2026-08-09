import { render } from '@testing-library/react';
import { createRef, type RefObject } from 'react';
import { describe, expect, it } from 'vitest';

import { Button } from '../Button';
import { Flex } from '../Flex';
import { Icon } from '../Icon';
import { IconButton } from '../IconButton';
import { Spinner } from '../Spinner';
import { Stack } from '../Stack';
import { Surface } from '../Surface';
import { Text } from '../Text';

describe('base component refs', () => {
  it('resolve to their rendered host elements', () => {
    const button = createRef<HTMLButtonElement>();
    const flex = createRef<HTMLElement>();
    const icon = createRef<SVGSVGElement>();
    const iconButton = createRef<HTMLButtonElement>();
    const spinner = createRef<HTMLDivElement>();
    const stack = createRef<HTMLDivElement>();
    const surface = createRef<HTMLElement>();
    const text = createRef<HTMLElement>();

    render(
      <>
        <Button ref={button}>Button</Button>
        <Flex ref={flex}>Flex</Flex>
        <Icon ref={icon} name='send' />
        <IconButton ref={iconButton} label='Icon button' />
        <Spinner ref={spinner} />
        <Stack ref={stack}>Stack</Stack>
        <Surface ref={surface}>Surface</Surface>
        <Text ref={text}>Text</Text>
      </>,
    );

    const expectedTags: Array<[RefObject<Element | null>, string]> = [
      [button, 'BUTTON'],
      [flex, 'DIV'],
      [icon, 'svg'],
      [iconButton, 'BUTTON'],
      [spinner, 'DIV'],
      [stack, 'DIV'],
      [surface, 'DIV'],
      [text, 'SPAN'],
    ];
    expectedTags.forEach(([ref, tagName]) => expect(ref.current?.tagName).toBe(tagName));
  });
});
