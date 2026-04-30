import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Segment<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  segments: Segment<T>[];
  size?: 'sm' | 'md';
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  segments,
  size = 'md',
  className,
}: SegmentedControlProps<T>) {
  const sz = size === 'sm' ? 'h-8 text-xs px-3' : 'h-9 text-sm px-3.5';
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex rounded-md border border-border-subtle bg-bg-subtle p-0.5 gap-0.5',
        className,
      )}
    >
      {segments.map((s) => {
        const active = s.value === value;
        return (
          <button
            key={s.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(s.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded font-medium transition-colors whitespace-nowrap',
              sz,
              active
                ? 'bg-surface text-text-primary shadow-sm'
                : 'text-text-tertiary hover:text-text-primary',
            )}
          >
            {s.label}
            {s.count != null && (
              <span className={cn(
                'tabular text-[11px] rounded px-1.5 py-0.5',
                active ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-text-tertiary',
              )}>
                {s.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
