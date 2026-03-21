import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      {...props}
      ref={ref}
      className={cn(
        'block w-full px-3 py-2 text-sm leading-normal text-foreground bg-background border border-input rounded-lg transition-colors min-h-20 resize-y hover:border-muted-foreground focus:outline-none focus:border-ring focus:ring-3 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted',
        className,
      )}
    />
  );
});
