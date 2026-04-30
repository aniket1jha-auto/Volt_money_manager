import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export type DateRangePreset = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'custom';

export interface DateRange {
  preset: DateRangePreset;
  /** ISO date string (YYYY-MM-DD) — required when preset === 'custom' */
  from?: string;
  to?: string;
}

const PRESET_LABELS: Record<DateRangePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  custom: 'Custom range',
};

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (v: DateRange) => void;
  /** "now" anchor — defaults to real now. The mock can pass a fixed date. */
  now?: Date;
  className?: string;
}

export function DateRangeFilter({ value, onChange, now, className }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const anchor = now ?? new Date();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const triggerLabel =
    value.preset === 'custom' && value.from && value.to
      ? `${value.from} → ${value.to}`
      : PRESET_LABELS[value.preset];

  function pickPreset(p: DateRangePreset) {
    if (p === 'custom') {
      const range = computeRange(p, anchor);
      onChange({ preset: 'custom', from: range.from, to: range.to });
    } else {
      onChange({ preset: p });
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'h-9 inline-flex items-center gap-2 rounded-md border bg-surface px-3 text-sm',
          'transition-colors min-w-[180px]',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
          open ? 'border-blue-500' : 'border-border-medium hover:border-border-strong',
        )}
      >
        <Calendar size={14} className="text-text-tertiary" />
        <span className="font-medium text-text-primary truncate">{triggerLabel}</span>
        <ChevronDown
          size={14}
          className={cn('ml-auto text-text-tertiary transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 right-0 rounded-md border border-border-subtle bg-surface shadow-xl overflow-hidden min-w-[260px]">
          <ul className="py-1">
            {(['today', 'yesterday', '7d', '30d', '90d', 'custom'] as DateRangePreset[]).map((p) => (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => pickPreset(p)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
                    'hover:bg-slate-50 transition-colors',
                    value.preset === p && 'bg-brand-50/40 text-brand-700 font-medium',
                  )}
                >
                  {PRESET_LABELS[p]}
                </button>
              </li>
            ))}
          </ul>

          {value.preset === 'custom' && (
            <div className="border-t border-border-subtle p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] uppercase tracking-wide text-text-tertiary mb-1">From</label>
                  <input
                    type="date"
                    value={value.from ?? ''}
                    onChange={(e) => onChange({ ...value, from: e.target.value })}
                    className="h-8 w-full rounded border border-border-medium px-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wide text-text-tertiary mb-1">To</label>
                  <input
                    type="date"
                    value={value.to ?? ''}
                    onChange={(e) => onChange({ ...value, to: e.target.value })}
                    className="h-8 w-full rounded border border-border-medium px-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full h-8 mt-1 rounded bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const ONE_DAY = 86_400_000;

export function computeRange(value: DateRangePreset, now: Date): { from: string; to: string } {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  switch (value) {
    case 'today':
      return { from: toDateStr(startOfToday), to: toDateStr(end) };
    case 'yesterday': {
      const y = new Date(startOfToday.getTime() - ONE_DAY);
      const yEnd = new Date(y);
      yEnd.setHours(23, 59, 59, 999);
      return { from: toDateStr(y), to: toDateStr(yEnd) };
    }
    case '7d':  return { from: toDateStr(new Date(startOfToday.getTime() - 6 * ONE_DAY)), to: toDateStr(end) };
    case '30d': return { from: toDateStr(new Date(startOfToday.getTime() - 29 * ONE_DAY)), to: toDateStr(end) };
    case '90d': return { from: toDateStr(new Date(startOfToday.getTime() - 89 * ONE_DAY)), to: toDateStr(end) };
    case 'custom':
      return { from: toDateStr(new Date(startOfToday.getTime() - 6 * ONE_DAY)), to: toDateStr(end) };
  }
}

export function rangeBounds(value: DateRange, now: Date): { fromIso: string; toIso: string } {
  if (value.preset === 'custom' && value.from && value.to) {
    const f = new Date(`${value.from}T00:00:00`);
    const t = new Date(`${value.to}T23:59:59.999`);
    return { fromIso: f.toISOString(), toIso: t.toISOString() };
  }
  const r = computeRange(value.preset, now);
  return {
    fromIso: new Date(`${r.from}T00:00:00`).toISOString(),
    toIso: new Date(`${r.to}T23:59:59.999`).toISOString(),
  };
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
