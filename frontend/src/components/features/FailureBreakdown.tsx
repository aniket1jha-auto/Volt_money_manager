import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { failureReasonLabel } from '@/lib/labels';
import { formatPercent } from '@/lib/format';
import type { FailureBreakdownItem } from '@/lib/analytics';
import type { FailureReason } from '@/types';
import { cn } from '@/lib/cn';

const COLORS: Record<FailureReason, string> = {
  busy:             'var(--color-chart-4)',
  not_reachable:    'var(--color-chart-1)',
  invalid_number:   'var(--color-chart-6)',
  dnd:              'var(--color-chart-5)',
  network_error:    'var(--color-chart-2)',
  customer_hung_up: 'var(--color-chart-3)',
  other:            'var(--color-slate-400)',
};

interface FailureBreakdownProps {
  items: FailureBreakdownItem[];
  total: number;
  loading?: boolean;
  onSelect?: (reason: FailureReason) => void;
  /** Link target for "View all calls →" */
  viewAllHref?: string;
  className?: string;
}

export function FailureBreakdown({
  items,
  total,
  loading,
  onSelect,
  viewAllHref,
  className,
}: FailureBreakdownProps) {
  if (loading) {
    return (
      <Card padding="md" className={className}>
        <Skeleton className="h-5 w-40 mb-4" />
        <Skeleton className="h-3 w-full mb-6" />
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-5 w-full" />)}
        </div>
      </Card>
    );
  }

  const filtered = items.filter((i) => i.count > 0);

  return (
    <Card padding="md" className={className}>
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-text-primary">Top failure reasons</h3>
          <p className="text-xs text-text-tertiary">Why outbound calls don't connect.</p>
        </div>
        {viewAllHref && (
          <Link
            to={viewAllHref}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 shrink-0"
          >
            View all calls <ArrowRight size={14} />
          </Link>
        )}
      </div>

      {total === 0 ? (
        <p className="text-sm text-text-tertiary py-6 text-center">
          No failed calls in this scope.
        </p>
      ) : (
        <>
          {/* Stacked bar */}
          <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-100" aria-hidden>
            {filtered.map((item) => (
              <span
                key={item.reason}
                className="block h-full transition-opacity hover:opacity-80"
                style={{ width: `${item.share * 100}%`, backgroundColor: COLORS[item.reason] }}
                title={`${failureReasonLabel(item.reason)} — ${item.count.toLocaleString('en-IN')} (${formatPercent(item.share, 1)})`}
              />
            ))}
          </div>

          {/* List */}
          <ul className="mt-5 divide-y divide-border-subtle">
            {filtered.map((item) => {
              const Wrapper: 'button' | 'div' = onSelect ? 'button' : 'div';
              return (
                <li key={item.reason}>
                  <Wrapper
                    onClick={onSelect ? () => onSelect(item.reason) : undefined}
                    className={cn(
                      'w-full grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 py-2.5 text-sm text-left',
                      onSelect && 'group',
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: COLORS[item.reason] }}
                    />
                    <span className={cn(
                      'text-text-primary truncate',
                      onSelect && 'group-hover:text-blue-600 transition-colors',
                    )}>
                      {failureReasonLabel(item.reason)}
                    </span>
                    <span className="text-text-tertiary tabular tabular-nums text-right w-16">
                      {item.count.toLocaleString('en-IN')}
                    </span>
                    <span className="font-semibold text-text-primary tabular text-right w-12">
                      {formatPercent(item.share, 1)}
                    </span>
                  </Wrapper>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}
