import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

interface DialogContextValue {
  contentId: string;
  descriptionId: string;
  open: boolean;
  setOpen: (next: boolean) => void;
  titleId: string;
}

interface DialogProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}

interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext(name: string): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error(`${name} must be used within Dialog`);
  }
  return context;
}

export function Dialog({ children, defaultOpen = false, onOpenChange, open }: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const resolvedOpen = isControlled ? open : uncontrolledOpen;
  const contentId = useId();
  const titleId = useId();
  const descriptionId = useId();

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const value = useMemo<DialogContextValue>(
    () => ({
      contentId,
      descriptionId,
      open: resolvedOpen,
      setOpen,
      titleId,
    }),
    [contentId, descriptionId, resolvedOpen, setOpen, titleId],
  );

  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
}

export function DialogTrigger({ children, className, onClick, ...props }: DialogTriggerProps) {
  const context = useDialogContext('DialogTrigger');

  return (
    <button
      {...props}
      aria-controls={context.contentId}
      aria-expanded={context.open}
      className={cn('base-dialog-trigger', className)}
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

export function DialogOverlay({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const context = useDialogContext('DialogOverlay');
  if (!context.open) {
    return null;
  }

  return <div {...props} aria-hidden='true' className={cn('base-dialog-overlay', className)} data-state='open' />;
}

export function DialogContent({ children, className, onKeyDown, ...props }: DialogContentProps) {
  const context = useDialogContext('DialogContent');

  useEffect(() => {
    if (!context.open) {
      return;
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        context.setOpen(false);
      }
    };
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('keydown', onEscape);
    };
  }, [context]);

  if (!context.open) {
    return null;
  }

  return (
    <div
      {...props}
      aria-describedby={context.descriptionId}
      aria-labelledby={context.titleId}
      aria-modal='true'
      className={cn('base-dialog-content', className)}
      data-state='open'
      id={context.contentId}
      onKeyDown={event => {
        onKeyDown?.(event);
        if (!event.defaultPrevented && event.key === 'Escape') {
          context.setOpen(false);
        }
      }}
      role='dialog'
      tabIndex={-1}
    >
      {children}
    </div>
  );
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const context = useDialogContext('DialogTitle');

  return <h2 {...props} className={cn('base-dialog-title', className)} id={context.titleId} />;
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  const context = useDialogContext('DialogDescription');

  return <p {...props} className={cn('base-dialog-description', className)} id={context.descriptionId} />;
}

export function DialogClose({ children, className, onClick, ...props }: DialogTriggerProps) {
  const context = useDialogContext('DialogClose');

  return (
    <button
      {...props}
      className={cn('base-dialog-close', className)}
      onClick={event => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          context.setOpen(false);
        }
      }}
      type='button'
    >
      {children}
    </button>
  );
}
