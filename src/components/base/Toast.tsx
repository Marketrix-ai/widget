import { createContext, useContext, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

type ToastTone = 'info' | 'success' | 'warning' | 'error';

interface ToastContextValue {
  onDismiss?: () => void;
}

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  onDismiss?: () => void;
  tone?: ToastTone;
}

const ToastContext = createContext<ToastContextValue>({});

export function Toast({ children, className, onDismiss, tone = 'info', ...props }: ToastProps) {
  const value = useMemo<ToastContextValue>(() => ({ onDismiss }), [onDismiss]);

  return (
    <ToastContext.Provider value={value}>
      <div {...props} aria-live='polite' className={cn('base-toast', className)} data-tone={tone} role='status'>
        {children}
      </div>
    </ToastContext.Provider>
  );
}

export function ToastClose({
  children = 'Close',
  className,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const context = useContext(ToastContext);

  return (
    <button
      {...props}
      className={cn('base-toast-close', className)}
      onClick={event => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          context.onDismiss?.();
        }
      }}
      type='button'
    >
      {children}
    </button>
  );
}

interface ToastViewportProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ToastViewport({ children, className, ...props }: ToastViewportProps) {
  return (
    <div {...props} aria-label='Notifications' className={cn('base-toast-viewport', className)} role='region'>
      {children}
    </div>
  );
}

export function useToastState(initialOpen = false) {
  const [open, setOpen] = useState(initialOpen);
  return { open, setOpen };
}
