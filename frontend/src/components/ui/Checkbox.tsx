import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  helper?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, helper, id, ...props }, ref) => {
    return (
      <label
        htmlFor={id}
        className={cn(
          'inline-flex items-start gap-2.5 cursor-pointer select-none',
          props.disabled && 'cursor-not-allowed opacity-60',
          className,
        )}
      >
        <span className="relative flex items-center justify-center mt-0.5 shrink-0">
          <input
            id={id}
            ref={ref}
            type="checkbox"
            className="peer h-4 w-4 appearance-none rounded border border-border-strong bg-surface checked:bg-brand-500 checked:border-brand-500 focus-visible:ring-2 focus-visible:ring-blue-500/40 transition-colors"
            {...props}
          />
          <Check
            size={11}
            strokeWidth={3}
            className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none"
          />
        </span>
        {(label || helper) && (
          <span className="flex flex-col">
            {label && <span className="text-sm text-text-primary leading-snug">{label}</span>}
            {helper && <span className="text-xs text-text-tertiary mt-0.5">{helper}</span>}
          </span>
        )}
      </label>
    );
  },
);
Checkbox.displayName = 'Checkbox';
