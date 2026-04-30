import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, leftIcon, rightIcon, error, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {leftIcon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-text-tertiary">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            'h-10 w-full rounded-md border bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
            'transition-colors',
            error
              ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20'
              : 'border-border-medium',
            leftIcon && 'pl-10',
            rightIcon && 'pr-10',
            className,
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-tertiary">
            {rightIcon}
          </div>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

interface LabelProps {
  htmlFor?: string;
  children: ReactNode;
  required?: boolean;
  className?: string;
}

export function Label({ htmlFor, children, required, className }: LabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn('block text-sm font-medium text-text-primary mb-1.5', className)}
    >
      {children}
      {required && <span className="text-danger-500 ml-0.5">*</span>}
    </label>
  );
}

export function HelperText({ children, error }: { children: ReactNode; error?: boolean }) {
  return (
    <p className={cn('mt-1.5 text-xs', error ? 'text-danger-700' : 'text-text-tertiary')}>
      {children}
    </p>
  );
}
