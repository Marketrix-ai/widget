import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

type TextareaVariant = 'default' | 'chat';
type TextareaValidationState = 'default' | 'valid' | 'invalid';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  errorMessage?: string;
  validationState?: TextareaValidationState;
  variant?: TextareaVariant;
}

const variantStyles: Record<TextareaVariant, string> = {
  default:
    'block w-full px-3 py-2 text-sm leading-normal text-foreground bg-background border border-input-border rounded-lg transition-colors min-h-20 resize-y hover:border-muted-foreground focus:outline-none focus:border-ring focus:ring-3 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted',
  chat: 'block w-full px-3 text-sm text-foreground placeholder:text-foreground-faint bg-transparent border-none rounded-none transition-colors min-h-0 resize-none focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed',
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, errorMessage, id, validationState = 'default', variant = 'default', ...props },
  ref,
) {
  const errorId =
    validationState === 'invalid' && errorMessage ? `${id ?? props['aria-label'] ?? 'textarea'}-error` : undefined;

  return (
    <>
      <textarea
        {...props}
        aria-describedby={errorId}
        aria-invalid={validationState === 'invalid' ? 'true' : undefined}
        className={cn(variantStyles[variant], className)}
        data-validation-state={validationState}
        id={id}
        ref={ref}
      />
      {errorId != null && <span id={errorId}>{errorMessage}</span>}
    </>
  );
});
