import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface MultiSelectOption {
  value: string;
  label: ReactNode;
  hint?: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (values: string[]) => void;
  /** Trigger button label when nothing is selected (i.e. "all"). */
  allLabel: string;
  /** Used in the trigger when N values are selected. */
  noun: string;
  searchable?: boolean;
  className?: string;
  /** dropdown min width — defaults to trigger width */
  menuMinWidth?: number;
}

export function MultiSelect({
  options,
  value,
  onChange,
  allLabel,
  noun,
  searchable = true,
  className,
  menuMinWidth,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
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

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) =>
      String(o.label).toLowerCase().includes(q) ||
      o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  const selectedSet = new Set(value);

  function toggle(v: string) {
    if (selectedSet.has(v)) {
      onChange(value.filter((x) => x !== v));
    } else {
      onChange([...value, v]);
    }
  }

  const labelText =
    value.length === 0
      ? allLabel
      : value.length === 1
        ? oneLabel(options, value[0])
        : `${value.length} ${noun} selected`;

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'h-9 inline-flex items-center justify-between gap-2 rounded-md border bg-surface pl-3 pr-2 text-sm',
          'transition-colors min-w-[180px]',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
          open ? 'border-blue-500' : 'border-border-medium hover:border-border-strong',
        )}
      >
        <span className={cn(
          'truncate',
          value.length === 0 ? 'text-text-tertiary' : 'text-text-primary font-medium',
        )}>
          {labelText}
        </span>
        <ChevronDown
          size={14}
          className={cn(
            'shrink-0 text-text-tertiary transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div
          className="absolute z-30 mt-1 rounded-md border border-border-subtle bg-surface shadow-xl overflow-hidden"
          style={{ minWidth: menuMinWidth ?? 240 }}
        >
          {searchable && (
            <div className="px-2 pt-2 pb-1.5 border-b border-border-subtle">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search..."
                  className="h-8 w-full rounded border border-border-medium pl-8 pr-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Header actions */}
          <div className="px-2 py-1.5 border-b border-border-subtle flex items-center justify-between text-xs">
            <span className="text-text-tertiary">
              {value.length} of {options.length} selected
            </span>
            <div className="flex items-center gap-2">
              {value.length > 0 && (
                <button
                  onClick={() => onChange([])}
                  className="text-text-tertiary hover:text-text-primary"
                >
                  Clear
                </button>
              )}
              {value.length < options.length && (
                <button
                  onClick={() => onChange(filtered.map((o) => o.value))}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Select {query ? 'matching' : 'all'}
                </button>
              )}
            </div>
          </div>

          <ul className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-text-tertiary text-center">
                No matches
              </li>
            ) : (
              filtered.map((opt) => {
                const sel = selectedSet.has(opt.value);
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      onClick={() => toggle(opt.value)}
                      className={cn(
                        'w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-left',
                        'hover:bg-slate-50 transition-colors',
                        sel && 'bg-brand-50/40',
                      )}
                    >
                      <span
                        className={cn(
                          'h-4 w-4 shrink-0 rounded border flex items-center justify-center',
                          sel ? 'bg-brand-500 border-brand-500 text-white' : 'border-border-strong',
                        )}
                      >
                        {sel && <Check size={11} strokeWidth={3} />}
                      </span>
                      <span className="flex-1 min-w-0 truncate text-text-primary">{opt.label}</span>
                      {opt.hint && (
                        <span className="text-xs text-text-tertiary shrink-0">{opt.hint}</span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function oneLabel(options: MultiSelectOption[], v: string): string {
  return String(options.find((o) => o.value === v)?.label ?? v);
}

interface FilterChipProps {
  label: ReactNode;
  onRemove: () => void;
}

export function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <span className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1 rounded-full border border-blue-100 bg-blue-50 text-xs text-blue-700">
      <span className="font-medium">{label}</span>
      <button
        onClick={onRemove}
        aria-label="Remove filter"
        className="h-5 w-5 inline-flex items-center justify-center rounded-full hover:bg-blue-100 transition-colors"
      >
        <X size={12} />
      </button>
    </span>
  );
}
