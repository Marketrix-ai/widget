import { createContext, useContext, useEffect, useId, useMemo } from 'react';

import { cn } from '@/lib/utils';

import { getElevationStyle } from '../../design-system/component-tokens';
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
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'confirm' | 'info';
}

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext(name: string): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error(`${name} must be used within Dialog`);
  }
  return context;
}

export function Dialog({ children, defaultOpen, onOpenChange, open }: DialogProps) {
  const { isOpen: resolvedOpen, setIsOpen: setOpen } = useDisclosure({ defaultOpen, onOpenChange, open });
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

export function DialogTrigger({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const context = useDialogContext('DialogTrigger');

  return (
    <button
      {...props}
      aria-expanded={context.open ? 'true' : 'false'}
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

export function DialogContent({ children, className, onKeyDown, ...props }: DialogContentProps) {
  const context = useDialogContext('DialogContent');
  const { variant = 'default', style, ...domProps } = props;

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
      {...domProps}
      aria-describedby={context.descriptionId}
      aria-labelledby={context.titleId}
      aria-modal='true'
      className={cn(
        'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[calc(var(--layer-dialog)+1)] flex flex-col w-full max-h-[85vh] overflow-auto bg-card animate-dialog-content-in',
        variant === 'default' && 'max-w-[500px] rounded-lg p-6',
        variant === 'confirm' && 'max-w-sm rounded-lg p-4',
        variant === 'info' && 'w-64 rounded-md border border-border p-0',
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
      style={{ ...getElevationStyle(variant === 'info' ? 'section' : 'panel'), ...style }}
      tabIndex={-1}
    >
      {children}
    </div>
  );
}

interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  variant?: 'default' | 'confirm' | 'info';
}

export function DialogTitle({ className, variant = 'default', ...props }: DialogTitleProps) {
  const context = useDialogContext('DialogTitle');

  return (
    <h2
      {...props}
      className={cn(
        variant === 'default' && 'text-lg font-semibold text-card-foreground mb-2',
        variant === 'confirm' && 'text-base font-semibold text-foreground mb-1',
        variant === 'info' && 'text-xs font-semibold text-foreground flex-1 text-center mb-0',
        className,
      )}
      id={context.titleId}
    />
  );
}

interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  variant?: 'default' | 'confirm';
}

export function DialogDescription({ className, variant = 'default', ...props }: DialogDescriptionProps) {
  const context = useDialogContext('DialogDescription');

  return (
    <p
      {...props}
      className={cn(
        variant === 'default' && 'text-sm text-muted-foreground mb-4',
        variant === 'confirm' && 'text-sm text-muted-foreground mb-4 leading-relaxed',
        className,
      )}
      id={context.descriptionId}
    />
  );
}

interface DialogCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'info';
}

export function DialogClose({ children, className, onClick, variant = 'default', ...props }: DialogCloseProps) {
  const context = useDialogContext('DialogClose');

  return (
    <button
      {...props}
      className={cn(
        variant === 'default' &&
          'absolute top-4 right-4 flex items-center justify-center w-8 h-8 p-0 bg-transparent border-none rounded-lg text-muted-foreground cursor-pointer transition-colors hover:bg-muted',
        variant === 'info' &&
          'static -mr-1 flex h-5 w-5 items-center justify-center rounded-full border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-foreground',
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
