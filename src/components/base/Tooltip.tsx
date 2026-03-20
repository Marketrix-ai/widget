import { createContext, useCallback, useContext, useId, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

interface TooltipContextValue {
  contentId: string;
  open: boolean;
  setOpen: (next: boolean) => void;
}

interface TooltipProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}

interface TooltipTriggerProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'button' | 'span' | 'div';
  children: React.ReactNode;
}

const TooltipContext = createContext<TooltipContextValue | null>(null);

function useTooltipContext(name: string): TooltipContextValue {
  const context = useContext(TooltipContext);
  if (!context) {
    throw new Error(`${name} must be used within Tooltip`);
  }
  return context;
}

export function Tooltip({ children, defaultOpen = false, onOpenChange, open }: TooltipProps) {
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

  const value = useMemo<TooltipContextValue>(
    () => ({
      contentId,
      open: resolvedOpen,
      setOpen,
    }),
    [contentId, resolvedOpen, setOpen],
  );

  return <TooltipContext.Provider value={value}>{children}</TooltipContext.Provider>;
}

export function TooltipTrigger({
  as = 'button',
  children,
  className,
  onBlur,
  onFocus,
  onMouseEnter,
  onMouseLeave,
  ...props
}: TooltipTriggerProps) {
  const context = useTooltipContext('TooltipTrigger');

  const sharedProps = {
    ...props,
    'aria-describedby': context.open ? context.contentId : undefined,
    className: cn('cursor-help', className),
    'data-state': context.open ? 'open' : 'closed',
    onBlur: (event: React.FocusEvent<HTMLElement>) => {
      onBlur?.(event);
      if (!event.defaultPrevented) {
        context.setOpen(false);
      }
    },
    onFocus: (event: React.FocusEvent<HTMLElement>) => {
      onFocus?.(event);
      if (!event.defaultPrevented) {
        context.setOpen(true);
      }
    },
    onMouseEnter: (event: React.MouseEvent<HTMLElement>) => {
      onMouseEnter?.(event);
      if (!event.defaultPrevented) {
        context.setOpen(true);
      }
    },
    onMouseLeave: (event: React.MouseEvent<HTMLElement>) => {
      onMouseLeave?.(event);
      if (!event.defaultPrevented) {
        context.setOpen(false);
      }
    },
  };

  if (as === 'button') {
    return (
      <button {...sharedProps} type='button'>
        {children}
      </button>
    );
  }

  if (as === 'span') {
    return <span {...sharedProps}>{children}</span>;
  }

  return <div {...sharedProps}>{children}</div>;
}

export function TooltipContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const context = useTooltipContext('TooltipContent');
  if (!context.open) {
    return null;
  }

  return (
    <div
      {...props}
      className={cn(
        'absolute z-[var(--layer-tooltip)] max-w-[250px] overflow-hidden bg-foreground text-background rounded-md px-2.5 py-1.5 text-xs leading-snug animate-tooltip-in',
        className,
      )}
      data-state='open'
      id={context.contentId}
      role='tooltip'
    />
  );
}
