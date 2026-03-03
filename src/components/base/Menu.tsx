import { createContext, useCallback, useContext, useId, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

interface MenuContextValue {
  contentId: string;
  open: boolean;
  setOpen: (next: boolean) => void;
}

interface MenuProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}

interface MenuTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

interface MenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const MenuContext = createContext<MenuContextValue | null>(null);

function useMenuContext(name: string): MenuContextValue {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error(`${name} must be used within Menu`);
  }
  return context;
}

export function Menu({ children, defaultOpen = false, onOpenChange, open }: MenuProps) {
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

  const value = useMemo<MenuContextValue>(
    () => ({
      contentId,
      open: resolvedOpen,
      setOpen,
    }),
    [contentId, resolvedOpen, setOpen],
  );

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export function MenuTrigger({ children, className, onClick, ...props }: MenuTriggerProps) {
  const context = useMenuContext('MenuTrigger');

  return (
    <button
      {...props}
      aria-controls={context.contentId}
      aria-expanded={context.open}
      aria-haspopup='menu'
      className={cn('base-menu-trigger', className)}
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

export function MenuContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const context = useMenuContext('MenuContent');
  if (!context.open) {
    return null;
  }

  return (
    <div
      {...props}
      className={cn('base-menu-content', className)}
      data-state='open'
      id={context.contentId}
      role='menu'
    />
  );
}

export function MenuItem({ children, className, onClick, ...props }: MenuItemProps) {
  const context = useMenuContext('MenuItem');

  return (
    <button
      {...props}
      className={cn('base-menu-item', className)}
      onClick={event => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          context.setOpen(false);
        }
      }}
      role='menuitem'
      type='button'
    >
      {children}
    </button>
  );
}
