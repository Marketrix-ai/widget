import { forwardRef } from 'react';

import { Flex, type FlexProps } from './Flex';

export type StackProps = Omit<FlexProps, 'direction'>;

export const Stack = forwardRef<HTMLElement, StackProps>(function Stack(props, ref) {
  return <Flex {...props} ref={ref} direction='column' />;
});
