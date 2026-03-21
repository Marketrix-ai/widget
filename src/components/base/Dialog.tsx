import { createContext, useContext, useEffect, useId, useMemo } from 'react';

import { cn } from '@/lib/utils';

import { useDisclosure } from './useDisclosure';

interface DialogContextValue {
  contentId: string;
  descriptionId: string;
  open: boolean;
  setOpen: (next: boolean) => void;
  titleId: string;
}

interface DialogProps {
  children: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
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

export function Dialog({ children, onOpenChange, open }: DialogProps) {
  const { isOpen: resolvedOpen, setIsOpen: setOpen } = useDisclosure({ onOpenChange, open });
  const contentId = useId();
  const titleId = useId();
  const descriptionId = useId();

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
      className={cn(
        'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[calc(var(--layer-dialog)+1)] flex flex-col w-full max-w-[500px] max-h-[85vh] overflow-auto bg-card rounded-lg shadow-xl p-6 animate-dialog-content-in',
        className,
      )}
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

  return (
    <h2 {...props} className={cn('text-lg font-semibold text-card-foreground mb-2', className)} id={context.titleId} />
  );
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  const context = useDialogContext('DialogDescription');

  return <p {...props} className={cn('text-sm text-muted-foreground mb-4', className)} id={context.descriptionId} />;
}

export function DialogClose({ children, className, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const context = useDialogContext('DialogClose');

  return (
    <button
      {...props}
      className={cn(
        'absolute top-4 right-4 flex items-center justify-center w-8 h-8 p-0 bg-transparent border-none rounded-lg text-muted-foreground cursor-pointer transition-colors hover:bg-muted',
        className,
      )}
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
