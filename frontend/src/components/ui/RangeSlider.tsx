import { useCallback, useRef, type PointerEvent } from 'react';
import { cn } from '@/lib/cn';

interface RangeSliderProps {
  /** [min, max] in domain units */
  domain: [number, number];
  /** [low, high] currently selected */
  value: [number, number];
  onChange: (v: [number, number]) => void;
  step?: number;
  /** Renders the value labels above the handles */
  formatValue?: (n: number) => string;
  className?: string;
}

export function RangeSlider({
  domain,
  value,
  onChange,
  step = 1,
  formatValue = (n) => String(n),
  className,
}: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [min, max] = domain;
  const [low, high] = value;
  const range = max - min || 1;

  const lowPct = ((low - min) / range) * 100;
  const highPct = ((high - min) / range) * 100;

  const onPointerDown = useCallback(
    (handle: 'low' | 'high') => (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const track = trackRef.current;
      if (!track) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const move = (clientX: number) => {
        const rect = track.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const raw = min + pct * range;
        const snapped = Math.round(raw / step) * step;
        if (handle === 'low') {
          onChange([Math.min(snapped, high - step), high]);
        } else {
          onChange([low, Math.max(snapped, low + step)]);
        }
      };

      const onMove = (ev: PointerEvent | globalThis.PointerEvent) => move(ev.clientX);
      const onUp = () => {
        window.removeEventListener('pointermove', onMove as EventListener);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove as EventListener);
      window.addEventListener('pointerup', onUp);
    },
    [low, high, min, range, step, onChange],
  );

  return (
    <div className={cn('w-full', className)}>
      {/* Value labels */}
      <div className="flex items-center justify-between text-xs text-text-tertiary mb-2">
        <span className="tabular text-text-primary font-medium">{formatValue(low)}</span>
        <span className="tabular text-text-primary font-medium">{formatValue(high)}</span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-1.5 rounded-full bg-slate-200"
        role="group"
        aria-label="Range slider"
      >
        {/* Selected band */}
        <div
          className="absolute h-full bg-brand-500/80 rounded-full"
          style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }}
        />
        {/* Low handle */}
        <button
          type="button"
          aria-label="Minimum value"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={low}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full bg-surface border-2 border-brand-500 shadow-sm hover:scale-110 active:scale-95 transition-transform focus-visible:ring-2 focus-visible:ring-blue-500/30 outline-none"
          style={{ left: `${lowPct}%` }}
          onPointerDown={onPointerDown('low')}
        />
        {/* High handle */}
        <button
          type="button"
          aria-label="Maximum value"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={high}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full bg-surface border-2 border-brand-500 shadow-sm hover:scale-110 active:scale-95 transition-transform focus-visible:ring-2 focus-visible:ring-blue-500/30 outline-none"
          style={{ left: `${highPct}%` }}
          onPointerDown={onPointerDown('high')}
        />
      </div>
    </div>
  );
}
