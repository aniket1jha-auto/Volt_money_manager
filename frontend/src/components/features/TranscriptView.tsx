import { useEffect, useMemo, useRef } from 'react';
import type { Turn } from '@/types';
import { cn } from '@/lib/cn';

interface TranscriptViewProps {
  turns: Turn[];
  currentMs: number;
  /** seek to a specific ms when a turn is clicked */
  onSeek: (ms: number) => void;
  className?: string;
}

export function TranscriptView({ turns, currentMs, onSeek, className }: TranscriptViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const activeIndex = useMemo(() => {
    // The "current" turn is the latest one whose startMs ≤ currentMs.
    let idx = -1;
    for (let i = 0; i < turns.length; i++) {
      if (turns[i].startMs <= currentMs) idx = i;
      else break;
    }
    return idx;
  }, [turns, currentMs]);

  // Auto-scroll the active turn into view (smooth, only when needed).
  useEffect(() => {
    if (activeIndex < 0 || !containerRef.current) return;
    const el = containerRef.current.querySelector<HTMLElement>(`[data-turn="${activeIndex}"]`);
    if (!el) return;
    const c = containerRef.current;
    const rect = el.getBoundingClientRect();
    const cRect = c.getBoundingClientRect();
    if (rect.top < cRect.top + 24 || rect.bottom > cRect.bottom - 24) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [activeIndex]);

  if (!turns || turns.length === 0) {
    return (
      <div className={cn('text-sm text-text-tertiary py-8 text-center', className)}>
        No transcript available for this call.
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('flex flex-col gap-3', className)}>
      {turns.map((t) => {
        const active = t.index === activeIndex;
        const isAgent = t.role === 'agent';
        return (
          <button
            key={t.index}
            type="button"
            data-turn={t.index}
            onClick={() => onSeek(t.startMs)}
            className={cn(
              'group text-left rounded-lg px-3 py-2.5 transition-all',
              'border border-transparent',
              isAgent
                ? 'bg-brand-50/60 hover:bg-brand-50'
                : 'bg-bg-subtle hover:bg-slate-100',
              active && (isAgent
                ? 'border-brand-500/50 bg-brand-50 ring-1 ring-brand-500/20'
                : 'border-blue-500/40 bg-blue-50 ring-1 ring-blue-500/20'),
            )}
          >
            <div className="flex items-baseline gap-2 mb-1">
              <span
                className={cn(
                  'text-[11px] uppercase tracking-wider font-semibold',
                  isAgent ? 'text-brand-700' : 'text-text-secondary',
                )}
              >
                {isAgent ? 'Agent' : 'Customer'}
              </span>
              <span className="font-mono text-[11px] text-text-tertiary tabular">
                {formatMs(t.startMs)}
              </span>
              {active && (
                <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-blue-700 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                  speaking
                </span>
              )}
            </div>
            <p className="text-sm text-text-primary leading-relaxed">{t.text}</p>
          </button>
        );
      })}
    </div>
  );
}

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
