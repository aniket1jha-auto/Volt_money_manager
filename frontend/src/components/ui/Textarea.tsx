import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, rows = 3, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          'w-full rounded-md border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
          'transition-colors resize-y',
          error
            ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20'
            : 'border-border-medium',
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';
