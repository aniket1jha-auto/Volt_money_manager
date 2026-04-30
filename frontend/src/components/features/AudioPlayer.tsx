import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import {
  Play,
  Pause,
  Download,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/cn';

interface AudioPlayerProps {
  durationMs: number;
  /** Source URL for download — UI mock pretends this is real. */
  url?: string;
  /** Current playback head in ms (controlled). */
  currentMs: number;
  onSeek: (ms: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  className?: string;
}

const SPEEDS = [0.5, 1, 1.25, 1.5, 2] as const;

export function AudioPlayer({
  durationMs,
  url,
  currentMs,
  onSeek,
  playing,
  onTogglePlay,
  className,
}: AudioPlayerProps) {
  const [speed, setSpeed] = useState<number>(1);
  const [volume, setVolume] = useState(0.75);
  const [muted, setMuted] = useState(false);

  // Drive simulated playback. Real backend will swap this for an
  // <audio>'s timeupdate event.
  useEffect(() => {
    if (!playing) return;
    let raf: number | null = null;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) * speed;
      last = now;
      const next = currentMs + dt;
      if (next >= durationMs) {
        onSeek(durationMs);
        onTogglePlay(); // auto-pause at end
        return;
      }
      onSeek(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [playing, speed, currentMs, durationMs, onSeek, onTogglePlay]);

  const progressPct = durationMs > 0 ? Math.max(0, Math.min(1, currentMs / durationMs)) * 100 : 0;

  return (
    <div className={cn('flex flex-col gap-3 rounded-lg border border-border-subtle bg-slate-25 p-3', className)}>
      <Waveform durationMs={durationMs} progressPct={progressPct} onSeek={onSeek} />

      <div className="flex items-center justify-between gap-3">
        {/* Time + transport */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            className="h-9 w-9 rounded-full bg-brand-500 text-white inline-flex items-center justify-center hover:bg-brand-600 transition-colors shadow-sm"
          >
            {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
          </button>
          <span className="text-sm tabular text-text-primary">
            {formatTimeMs(currentMs)} <span className="text-text-tertiary">/ {formatTimeMs(durationMs)}</span>
          </span>
        </div>

        {/* Speed + volume + download */}
        <div className="flex items-center gap-2">
          <Select
            value={String(speed)}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="h-8 w-[70px] text-xs"
            aria-label="Playback speed"
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>{s}×</option>
            ))}
          </Select>

          <div className="flex items-center gap-1.5 group">
            <button
              type="button"
              aria-label={muted ? 'Unmute' : 'Mute'}
              onClick={() => setMuted((v) => !v)}
              className="h-8 w-8 rounded text-text-secondary hover:bg-slate-100 inline-flex items-center justify-center"
            >
              {muted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                setVolume(Number(e.target.value));
                if (Number(e.target.value) > 0) setMuted(false);
              }}
              className="w-16 accent-brand-500"
              aria-label="Volume"
            />
          </div>

          <a
            href={url ?? '#'}
            download
            onClick={(e) => { if (!url) e.preventDefault(); }}
            aria-label="Download recording"
            className={cn(
              'h-8 w-8 rounded inline-flex items-center justify-center transition-colors',
              url
                ? 'text-text-secondary hover:bg-slate-100 hover:text-text-primary'
                : 'text-text-tertiary opacity-50 cursor-not-allowed',
            )}
          >
            <Download size={15} />
          </a>
        </div>
      </div>
    </div>
  );
}

function formatTimeMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ────────────────────────────────────────────────────────────────────
// Waveform — deterministic SVG mock; click + drag to seek
// ────────────────────────────────────────────────────────────────────
function Waveform({
  durationMs,
  progressPct,
  onSeek,
}: {
  durationMs: number;
  progressPct: number;
  onSeek: (ms: number) => void;
}) {
  // Generate a deterministic bar pattern from durationMs so the same call
  // shows the same waveform across renders.
  const bars = useMemo(() => generateWave(durationMs), [durationMs]);
  const trackRef = useRef<HTMLDivElement>(null);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    seekToEvent(e.clientX);
    const onMove = (ev: PointerEvent | globalThis.PointerEvent) => seekToEvent(ev.clientX);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove as EventListener);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove as EventListener);
    window.addEventListener('pointerup', onUp);
  };

  const seekToEvent = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(pct * durationMs);
  };

  return (
    <div
      ref={trackRef}
      onPointerDown={onPointerDown}
      className="relative h-14 cursor-pointer select-none rounded overflow-hidden"
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={durationMs}
      aria-valuenow={(progressPct / 100) * durationMs}
    >
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        <defs>
          <clipPath id="wave-played">
            <rect x="0" y="0" width={progressPct} height="40" />
          </clipPath>
        </defs>
        {/* Unplayed bars */}
        <g fill="var(--color-slate-300)">
          {bars.map((h, i) => (
            <rect
              key={`u-${i}`}
              x={i * (100 / bars.length) + 0.2}
              y={20 - h / 2}
              width={(100 / bars.length) - 0.4}
              height={h}
              rx={0.6}
            />
          ))}
        </g>
        {/* Played bars (clipped) */}
        <g fill="var(--color-brand-500)" clipPath="url(#wave-played)">
          {bars.map((h, i) => (
            <rect
              key={`p-${i}`}
              x={i * (100 / bars.length) + 0.2}
              y={20 - h / 2}
              width={(100 / bars.length) - 0.4}
              height={h}
              rx={0.6}
            />
          ))}
        </g>
      </svg>
      {/* Playhead line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-brand-500 pointer-events-none"
        style={{ left: `${progressPct}%` }}
      />
    </div>
  );
}

function generateWave(seedMs: number): number[] {
  const N = 80;
  let s = (seedMs | 0) || 1;
  const bars: number[] = [];
  for (let i = 0; i < N; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const r = (s & 0xffff) / 0xffff;
    // shape: more energy in the middle, taper at edges
    const taper = 1 - Math.pow((Math.abs(i - N / 2) / (N / 2)), 1.6);
    const h = 4 + r * 26 * taper;
    bars.push(h);
  }
  return bars;
}
