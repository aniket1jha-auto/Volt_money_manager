import { Clock } from 'lucide-react';
import type { CallingWindow, DayOfWeek } from '@/types';
import { Card } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';

interface CallingWindowEditorProps {
  value: CallingWindow;
  onChange: (next: CallingWindow) => void;
  /** When the schedule type is "scheduled", we surface a subtle hint
   *  about how the window interacts with the scheduled start time. */
  scheduleType?: 'immediate' | 'scheduled';
  className?: string;
}

const DAY_LABELS: { value: DayOfWeek; short: string; full: string }[] = [
  { value: 1, short: 'Mon', full: 'Monday' },
  { value: 2, short: 'Tue', full: 'Tuesday' },
  { value: 3, short: 'Wed', full: 'Wednesday' },
  { value: 4, short: 'Thu', full: 'Thursday' },
  { value: 5, short: 'Fri', full: 'Friday' },
  { value: 6, short: 'Sat', full: 'Saturday' },
  { value: 0, short: 'Sun', full: 'Sunday' },
];

export function CallingWindowEditor({
  value,
  onChange,
  scheduleType,
  className,
}: CallingWindowEditorProps) {
  const set = <K extends keyof CallingWindow>(key: K, v: CallingWindow[K]) =>
    onChange({ ...value, [key]: v });

  const toggleDay = (day: DayOfWeek) => {
    const has = value.days.includes(day);
    const next = has
      ? value.days.filter((d) => d !== day)
      : [...value.days, day].sort((a, b) => a - b);
    set('days', next as DayOfWeek[]);
  };

  return (
    <Card padding="lg" className={className}>
      {/* Header: enable toggle */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
            <Clock size={16} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary">Calling window</h3>
            <p className="text-sm text-text-tertiary mt-0.5 max-w-md">
              Daily hours during which the dialer is allowed to place calls.
              Anything outside this window waits until the next opening.
            </p>
          </div>
        </div>
        <Switch
          id="calling-window-enabled"
          checked={value.enabled}
          onChange={(e) => set('enabled', e.target.checked)}
          label={value.enabled ? 'On' : 'Off'}
        />
      </div>

      {/* Body — only when enabled */}
      <div
        className={cn(
          'transition-all duration-200',
          value.enabled
            ? 'mt-5 opacity-100 max-h-[400px]'
            : 'mt-0 opacity-0 max-h-0 overflow-hidden pointer-events-none',
        )}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-text-primary mb-1.5 block">
              Start time
            </label>
            <Input
              type="time"
              value={value.startTime}
              onChange={(e) => set('startTime', e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-text-primary mb-1.5 block">
              End time
            </label>
            <Input
              type="time"
              value={value.endTime}
              onChange={(e) => set('endTime', e.target.value)}
            />
          </div>
        </div>

        <div className="mt-5">
          <label className="text-sm font-medium text-text-primary mb-2 block">
            Active days
          </label>
          <div className="flex flex-wrap gap-1.5">
            {DAY_LABELS.map((d) => {
              const active = value.days.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  aria-pressed={active}
                  className={cn(
                    'h-8 px-3 rounded-full text-xs font-medium transition-colors border',
                    active
                      ? 'bg-brand-50 text-brand-700 border-brand-100'
                      : 'bg-surface text-text-secondary border-border-medium hover:border-border-strong',
                  )}
                  title={d.full}
                >
                  {d.short}
                </button>
              );
            })}
          </div>
        </div>

        {scheduleType && (
          <p className="mt-4 text-xs text-text-tertiary">
            {scheduleType === 'immediate'
              ? "If launch falls outside the window, calls wait until the next opening."
              : "If the scheduled start falls outside the window, calls wait until the next opening."}
          </p>
        )}

        {value.days.length === 0 && (
          <p className="mt-3 text-xs text-danger-700">
            Pick at least one active day for calls to flow.
          </p>
        )}
      </div>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

/** Short human summary, e.g. "09:00–19:00, Mon–Sat". */
export function describeCallingWindow(w: CallingWindow): string {
  if (!w.enabled) return 'No restriction';
  return `${w.startTime}–${w.endTime}, ${describeDays(w.days)}`;
}

function describeDays(days: DayOfWeek[]): string {
  if (days.length === 0) return 'no days';
  if (days.length === 7) return 'every day';

  // Detect Mon–Sat / Mon–Fri runs
  const sorted = [...days].sort((a, b) => a - b);
  const isMonSat = sorted.length === 6 && sorted.join(',') === '1,2,3,4,5,6';
  if (isMonSat) return 'Mon–Sat';
  const isMonFri = sorted.length === 5 && sorted.join(',') === '1,2,3,4,5';
  if (isMonFri) return 'Mon–Fri';

  const short: Record<DayOfWeek, string> = {
    0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
  };
  // Reorder so the week reads Mon-first.
  const monFirst = sorted.sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  return monFirst.map((d) => short[d]).join(', ');
}
