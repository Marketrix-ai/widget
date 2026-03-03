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
        className={cn('base-textarea', className)}
        data-validation-state={validationState}
        id={textareaId}
      />
      {errorMessage ? (
        <span className='base-textarea-error' data-validation-state={validationState} id={describedById}>
          {errorMessage}
        </span>
      ) : null}
    </>
  );
});
