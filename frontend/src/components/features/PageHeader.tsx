import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  filters?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, filters, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-4 mb-8', className)}>
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-text-tertiary">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {filters}
          {actions}
        </div>
      </div>
    </header>
  );
}
