import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Tab<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

interface TabsProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  tabs: Tab<T>[];
  className?: string;
  variant?: 'underline' | 'pill';
}

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  className,
  variant = 'underline',
}: TabsProps<T>) {
  if (variant === 'pill') {
    return (
      <div
        role="tablist"
        className={cn(
          'inline-flex rounded-md border border-border-subtle bg-bg-subtle p-0.5 gap-0.5',
          className,
        )}
      >
        {tabs.map((t) => {
          const active = t.value === value;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t.value)}
              className={cn(
                'h-8 px-3 rounded text-sm font-medium transition-colors inline-flex items-center gap-1.5 whitespace-nowrap',
                active
                  ? 'bg-surface text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-primary',
              )}
            >
              {t.label}
              {t.count != null && <Counter active={active}>{t.count}</Counter>}
            </button>
          );
        })}
      </div>
    );
  }

  // underline (default)
  return (
    <div
      role="tablist"
      className={cn('flex items-center gap-1 border-b border-border-subtle', className)}
    >
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              'relative px-3 py-2.5 text-sm font-medium transition-colors inline-flex items-center gap-1.5 whitespace-nowrap',
              '-mb-px border-b-2',
              active
                ? 'text-brand-700 border-brand-500'
                : 'text-text-tertiary border-transparent hover:text-text-primary',
            )}
          >
            {t.label}
            {t.count != null && <Counter active={active}>{t.count}</Counter>}
          </button>
        );
      })}
    </div>
  );
}

function Counter({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span className={cn(
      'tabular text-[11px] rounded px-1.5 py-0.5',
      active ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-text-tertiary',
    )}>
      {children}
    </span>
  );
}
