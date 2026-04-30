import { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  Line,
  Legend,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import type { DailyPoint } from '@/lib/analytics';
import { cn } from '@/lib/cn';

type SeriesKey = 'initiated' | 'connected' | 'answered' | 'failed';

interface SeriesDef {
  key: SeriesKey;
  label: string;
  color: string;       // CSS var or hex
  areaOpacity?: number;
}

const SERIES: SeriesDef[] = [
  { key: 'initiated', label: 'Initiated', color: 'var(--color-chart-1)', areaOpacity: 0.18 },
  { key: 'connected', label: 'Connected', color: 'var(--color-chart-2)', areaOpacity: 0 },
  { key: 'answered',  label: 'Answered',  color: 'var(--color-chart-3)', areaOpacity: 0 },
  { key: 'failed',    label: 'Failed',    color: 'var(--color-chart-6)', areaOpacity: 0 },
];

interface TrendChartProps {
  data: DailyPoint[];
  loading?: boolean;
  height?: number;
  className?: string;
}

export function TrendChart({ data, loading, height = 320, className }: TrendChartProps) {
  const [enabled, setEnabled] = useState<Record<SeriesKey, boolean>>({
    initiated: true,
    connected: true,
    answered: true,
    failed: true,
  });

  if (loading) {
    return (
      <Card padding="md" className={className}>
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-48" />
        </div>
        <Skeleton className="h-[320px] w-full" />
      </Card>
    );
  }

  return (
    <Card padding="md" className={className}>
      <div className="flex items-baseline justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-text-primary">Daily breakdown</h3>
          <p className="text-xs text-text-tertiary">Calls per day across the selected range.</p>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {SERIES.map((s) => {
            const on = enabled[s.key];
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setEnabled((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
                className={cn(
                  'h-7 px-2.5 rounded text-xs font-medium inline-flex items-center gap-1.5 transition-colors',
                  on
                    ? 'bg-slate-100 text-text-primary hover:bg-slate-200'
                    : 'text-text-tertiary hover:bg-slate-50 line-through',
                )}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: s.color, opacity: on ? 1 : 0.4 }}
                />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
            <defs>
              {SERIES.map((s) => (
                <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={s.color} stopOpacity={(s.areaOpacity ?? 0.15) * 1.4} />
                  <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="var(--color-border-subtle)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border-subtle)' }}
              minTickGap={28}
            />
            <YAxis
              tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={48}
              allowDecimals={false}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--color-border-medium)', strokeDasharray: '3 3' }} />
            <Legend wrapperStyle={{ display: 'none' }} />

            {SERIES.map((s) =>
              !enabled[s.key] ? null : s.key === 'initiated' ? (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  fill={`url(#fill-${s.key})`}
                  isAnimationActive={false}
                />
              ) : (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ),
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-border-subtle bg-surface shadow-lg px-3 py-2 text-xs">
      <div className="font-semibold text-text-primary mb-1.5">{label}</div>
      <div className="space-y-1">
        {payload.map((p) => {
          const def = SERIES.find((s) => s.key === p.dataKey);
          if (!def) return null;
          return (
            <div key={String(p.dataKey)} className="flex items-center gap-2 tabular">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: def.color }}
              />
              <span className="text-text-tertiary">{def.label}</span>
              <span className="ml-auto font-semibold text-text-primary">
                {(p.value ?? 0).toLocaleString('en-IN')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
