import type { ReactNode } from 'react';
import { Skeleton } from './Skeleton';
import { cn } from '@/lib/cn';

export interface MiniBarItem {
  key: string;
  label: ReactNode;
  count: number;
  /** override the rendered numeric on the right */
  valueText?: string;
}

interface MiniBarListProps {
  items: MiniBarItem[];
  loading?: boolean;
  /** Tailwind color class for the bar fill */
  barColor?: string;
  onItemClick?: (key: string) => void;
  emptyText?: string;
}

export function MiniBarList({
  items,
  loading,
  barColor = 'bg-blue-500/80',
  onItemClick,
  emptyText = 'No data',
}: MiniBarListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2 flex-1 rounded-full" />
            <Skeleton className="h-3 w-8" />
          </div>
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return <p className="text-sm text-text-tertiary">{emptyText}</p>;
  }
  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const pct = (item.count / max) * 100;
        const Wrapper: 'button' | 'div' = onItemClick ? 'button' : 'div';
        return (
          <li key={item.key}>
            <Wrapper
              onClick={onItemClick ? () => onItemClick(item.key) : undefined}
              className={cn(
                'w-full grid grid-cols-[1fr_auto] gap-x-3 items-center text-left',
                onItemClick && 'group cursor-pointer',
              )}
            >
              <div className="min-w-0">
                <div className={cn(
                  'text-sm text-text-primary truncate mb-1.5',
                  onItemClick && 'group-hover:text-blue-600 transition-colors',
                )}>
                  {item.label}
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', barColor)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <div className="text-sm font-semibold text-text-primary tabular self-start mt-0.5">
                {item.valueText ?? item.count}
              </div>
            </Wrapper>
          </li>
        );
      })}
    </ul>
  );
}
