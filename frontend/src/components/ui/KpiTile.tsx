import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Card } from './Card';
import { Skeleton } from './Skeleton';
import { cn } from '@/lib/cn';

type Tone = 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'neutral';

interface KpiTileProps {
  label: string;
  value: ReactNode;
  /** Optional icon shown in a coloured pill at the top right of the tile. */
  icon?: ReactNode;
  /** Color the icon pill. Defaults to 'brand'. */
  tone?: Tone;
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

const TONE_PILL: Record<Tone, string> = {
  brand:   'bg-brand-50 text-brand-700',
  info:    'bg-blue-50 text-blue-700',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger:  'bg-danger-50 text-danger-700',
  neutral: 'bg-slate-100 text-text-secondary',
};

export function KpiTile({
  label,
  value,
  icon,
  tone = 'brand',
  delta,
  breakdown,
  loading,
  className,
}: KpiTileProps) {
  if (loading) {
    return (
      <Card padding="md" className={className}>
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
        <Skeleton className="h-8 w-24 mt-3 mb-3" />
        <Skeleton className="h-3 w-32" />
      </Card>
    );
  }

  const Arrow = delta ? arrowFor(delta.direction) : null;

  return (
    <Card padding="md" className={cn('relative flex flex-col gap-1 transition-all', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
          {label}
        </div>
        {icon && (
          <span className={cn(
            'h-7 w-7 rounded-md flex items-center justify-center shrink-0',
            TONE_PILL[tone],
          )}>
            {icon}
          </span>
        )}
      </div>
      <div className="text-[1.625rem] font-semibold text-text-primary tabular leading-snug mt-1 break-words">
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
            <span className="text-text-tertiary truncate">{breakdown}</span>
          )}
        </div>
      )}
    </Card>
  );
}
