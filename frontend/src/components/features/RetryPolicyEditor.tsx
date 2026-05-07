import { RotateCcw, Clock, Repeat } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RetryPolicy } from '@/types';
import { Card } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { Select } from '@/components/ui/Select';
import { RETRY_INTERVAL_PRESETS } from '@/lib/retryPolicy';
import { cn } from '@/lib/cn';

interface RetryPolicyEditorProps {
  value: RetryPolicy;
  onChange: (next: RetryPolicy) => void;
  /** Render in a compact (drawer-friendly) mode without an outer Card. */
  compact?: boolean;
  className?: string;
}

const MAX_ATTEMPT_OPTIONS = [1, 2, 3, 4, 5];

export function RetryPolicyEditor({ value, onChange, compact, className }: RetryPolicyEditorProps) {
  const set = <K extends keyof RetryPolicy>(key: K, v: RetryPolicy[K]) =>
    onChange({ ...value, [key]: v });

  const inner = (
    <>
      {/* Header: enable toggle */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
            <RotateCcw size={16} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary">Retry policy</h3>
            <p className="text-sm text-text-tertiary mt-0.5 max-w-md">
              Automatically re-dial calls that didn't connect cleanly.
            </p>
          </div>
        </div>
        <Switch
          id="retry-enabled"
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
          <SettingRow icon={Repeat} label="Max retry attempts" hint="In addition to the first dial">
            <Select
              value={String(value.maxAttempts)}
              onChange={(e) => set('maxAttempts', Number(e.target.value))}
              className="w-full"
            >
              {MAX_ATTEMPT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'retry' : 'retries'}
                </option>
              ))}
            </Select>
          </SettingRow>

          <SettingRow icon={Clock} label="Wait between retries" hint="Cooldown before re-dialing">
            <Select
              value={String(value.intervalMinutes)}
              onChange={(e) => set('intervalMinutes', Number(e.target.value))}
              className="w-full"
            >
              {RETRY_INTERVAL_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </SettingRow>
        </div>
      </div>
    </>
  );

  if (compact) {
    return <div className={cn('rounded-lg border border-border-subtle bg-surface p-5', className)}>{inner}</div>;
  }
  return <Card padding="lg" className={className}>{inner}</Card>;
}

// ────────────────────────────────────────────────────────────────────
function SettingRow({
  icon: Icon,
  label,
  hint,
  children,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={13} className="text-text-tertiary" />
        <label className="text-sm font-medium text-text-primary">{label}</label>
      </div>
      {children}
      {hint && <p className="text-xs text-text-tertiary mt-1">{hint}</p>}
    </div>
  );
}
