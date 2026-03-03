import { forwardRef, useId } from 'react';

import { cn } from '@/lib/utils';

type ValidationState = 'default' | 'valid' | 'invalid';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  errorMessage?: string;
  validationState?: ValidationState;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, errorMessage, id, validationState = 'default', ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hasError = validationState === 'invalid' || Boolean(errorMessage);
  const describedById = hasError && errorMessage ? `${inputId}-error` : undefined;

  return (
    <>
      <input
        {...props}
        ref={ref}
        aria-describedby={describedById}
        aria-invalid={hasError || undefined}
        className={cn('base-input', className)}
        data-validation-state={validationState}
        id={inputId}
      />
      {errorMessage ? (
        <span className='base-input-error' data-validation-state={validationState} id={describedById}>
          {errorMessage}
        </span>
      ) : null}
    </>
  );
});
