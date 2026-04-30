import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Card } from './Card';
import { Skeleton } from './Skeleton';
import { cn } from '@/lib/cn';

interface KpiTileProps {
  label: string;
  value: ReactNode;
  delta?: {
    /** signed direction; sign drives the arrow + color */
    direction: 'up' | 'down' | 'neutral';
    /** rendered next to the arrow — already formatted */
    text: string;
    /** when true, "up" is bad (e.g. failure rate). Inverts the color. */
    invert?: boolean;
  };
  /** small secondary line under the value (e.g. "3 running · 1 scheduled") */
  breakdown?: string;
  loading?: boolean;
  className?: string;
}

const colorFor = (direction: 'up' | 'down' | 'neutral', invert?: boolean) => {
  if (direction === 'neutral') return 'text-text-tertiary';
  const positive = invert ? direction === 'down' : direction === 'up';
  return positive ? 'text-success-700' : 'text-danger-700';
};

const arrowFor = (direction: 'up' | 'down' | 'neutral') => {
  if (direction === 'up') return ArrowUpRight;
  if (direction === 'down') return ArrowDownRight;
  return Minus;
};

export function KpiTile({ label, value, delta, breakdown, loading, className }: KpiTileProps) {
  if (loading) {
    return (
      <Card padding="md" className={className}>
        <Skeleton className="h-3 w-20 mb-3" />
        <Skeleton className="h-8 w-24 mb-3" />
        <Skeleton className="h-3 w-32" />
      </Card>
    );
  }

  const Arrow = delta ? arrowFor(delta.direction) : null;

  return (
    <Card padding="md" className={cn('flex flex-col gap-1', className)}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
        {label}
      </div>
      <div className="text-3xl font-semibold text-text-primary tabular leading-tight mt-1">
        {value}
      </div>
      {(delta || breakdown) && (
        <div className="mt-2 flex items-center gap-2 text-sm">
          {delta && Arrow && (
            <span className={cn('inline-flex items-center gap-0.5 font-medium', colorFor(delta.direction, delta.invert))}>
              <Arrow size={14} />
              <span className="tabular">{delta.text}</span>
            </span>
          )}
          {breakdown && (
            <span className="text-text-tertiary">{breakdown}</span>
          )}
        </div>
      )}
    </Card>
  );
}
