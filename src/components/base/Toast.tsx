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

const toneStyles: Record<ToastTone, string> = {
  info: 'border-l-4 border-l-primary',
  success: 'border-l-4 border-l-success',
  warning: 'border-l-4 border-l-warning',
  error: 'border-l-4 border-l-destructive',
};

const ToastContext = createContext<ToastContextValue>({});

export function Toast({ children, className, onDismiss, tone = 'info', ...props }: ToastProps) {
  const value = useMemo<ToastContextValue>(() => ({ onDismiss }), [onDismiss]);

  return (
    <ToastContext.Provider value={value}>
      <div
        {...props}
        aria-live='polite'
        className={cn(
          'flex items-start gap-3 w-full max-w-[400px] px-4 py-3 bg-card border border-border rounded-lg shadow-lg text-card-foreground animate-toast-in',
          toneStyles[tone],
          className,
        )}
        data-tone={tone}
        role='status'
      >
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
      className={cn(
        'flex items-center justify-center w-6 h-6 p-0 ml-auto -mt-1 -mb-1 bg-transparent border-none rounded-sm text-muted-foreground cursor-pointer transition-colors shrink-0 hover:bg-muted',
        className,
      )}
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
    <div
      {...props}
      aria-label='Notifications'
      className={cn(
        'fixed bottom-0 right-0 z-[var(--layer-toast)] flex flex-col gap-2 w-full max-w-[420px] p-4 pointer-events-none',
        className,
      )}
      role='region'
    >
      {children}
    </div>
  );
}

export function useToastState(initialOpen = false) {
  const [open, setOpen] = useState(initialOpen);
  return { open, setOpen };
}
