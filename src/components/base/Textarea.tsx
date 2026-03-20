import { forwardRef, useId } from 'react';

import { cn } from '@/lib/utils';

type ValidationState = 'default' | 'valid' | 'invalid';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  errorMessage?: string;
  validationState?: ValidationState;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, errorMessage, id, validationState = 'default', ...props },
  ref,
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const hasError = validationState === 'invalid' || Boolean(errorMessage);
  const describedById = hasError && errorMessage ? `${textareaId}-error` : undefined;

  return (
    <>
      <textarea
        {...props}
        ref={ref}
        aria-describedby={describedById}
        aria-invalid={hasError || undefined}
        className={cn(
          'block w-full px-3 py-2 text-sm leading-normal text-foreground bg-background border border-input rounded-lg transition-colors min-h-20 resize-y hover:border-muted-foreground focus:outline-none focus:border-ring focus:ring-3 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted',
          validationState === 'invalid' && 'border-destructive focus:border-destructive focus:ring-destructive',
          validationState === 'valid' && 'border-success focus:border-success focus:ring-success',
          className,
        )}
        data-validation-state={validationState}
        id={textareaId}
      />
      {errorMessage ? (
        <span
          className={cn('block mt-1 text-xs text-destructive', validationState === 'valid' && 'text-success')}
          data-validation-state={validationState}
          id={describedById}
        >
          {errorMessage}
        </span>
      ) : null}
    </>
  );
});
