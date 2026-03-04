import { createContext, useCallback, useContext, useId, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

interface PopoverContextValue {
  contentId: string;
  open: boolean;
  setOpen: (next: boolean) => void;
}

interface PopoverProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}

interface PopoverTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const PopoverContext = createContext<PopoverContextValue | null>(null);

function usePopoverContext(name: string): PopoverContextValue {
  const context = useContext(PopoverContext);
  if (!context) {
    throw new Error(`${name} must be used within Popover`);
  }
  return context;
}

export function Popover({ children, defaultOpen = false, onOpenChange, open }: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const resolvedOpen = isControlled ? open : uncontrolledOpen;
  const contentId = useId();

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const value = useMemo<PopoverContextValue>(
    () => ({
      contentId,
      open: resolvedOpen,
      setOpen,
    }),
    [contentId, resolvedOpen, setOpen],
  );

  return <PopoverContext.Provider value={value}>{children}</PopoverContext.Provider>;
}

export function PopoverTrigger({ children, className, onClick, ...props }: PopoverTriggerProps) {
  const context = usePopoverContext('PopoverTrigger');

  return (
    <button
      {...props}
      aria-controls={context.contentId}
      aria-expanded={context.open}
      className={cn('cursor-pointer', className)}
      data-state={context.open ? 'open' : 'closed'}
      onClick={event => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          context.setOpen(!context.open);
        }
      }}
      type='button'
    >
      {children}
    </button>
  );
}

export function PopoverContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const context = usePopoverContext('PopoverContent');
  if (!context.open) {
    return null;
  }

  return (
    <div
      {...props}
      className={cn(
        'absolute z-[var(--layer-popover)] w-full max-w-[300px] overflow-hidden bg-popover border border-border rounded-lg shadow-lg px-4 py-3 animate-popover-in',
        className,
      )}
      data-state='open'
      id={context.contentId}
      role='dialog'
      tabIndex={-1}
    />
  );
}
