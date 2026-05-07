import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode;
  helper?: ReactNode;
  size?: 'sm' | 'md';
}

const SIZES = {
  // Using literal class names so Tailwind's JIT can pick them up.
  sm: {
    track: 'h-4 w-7',
    thumb: 'h-3 w-3 peer-checked:translate-x-3',
  },
  md: {
    track: 'h-5 w-9',
    thumb: 'h-4 w-4 peer-checked:translate-x-4',
  },
};

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, helper, size = 'md', id, disabled, ...props }, ref) => {
    const s = SIZES[size];
    return (
      <label
        htmlFor={id}
        className={cn(
          'inline-flex items-start gap-2.5 cursor-pointer select-none',
          disabled && 'cursor-not-allowed opacity-60',
          className,
        )}
      >
        <span className={cn('relative inline-flex items-center shrink-0 mt-0.5', s.track)}>
          <input
            id={id}
            ref={ref}
            type="checkbox"
            disabled={disabled}
            className="peer sr-only"
            {...props}
          />
          <span
            className={cn(
              'absolute inset-0 rounded-full transition-colors',
              'bg-slate-300 peer-checked:bg-brand-500',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/40 peer-focus-visible:ring-offset-1',
            )}
          />
          <span
            className={cn(
              'absolute left-0.5 top-1/2 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform pointer-events-none',
              s.thumb,
            )}
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
Switch.displayName = 'Switch';
