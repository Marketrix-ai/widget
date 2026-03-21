import { useCallback, useState } from 'react';

interface UseDisclosureProps {
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}

interface UseDisclosureResult {
  isOpen: boolean;
  setIsOpen: (next: boolean) => void;
}

export function useDisclosure({ defaultOpen = false, onOpenChange, open }: UseDisclosureProps): UseDisclosureResult {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolledOpen;

  const setIsOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  return { isOpen, setIsOpen };
}
