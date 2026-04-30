import { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  type IntentBucket,
  type SentimentMix,
  type DurationBucket,
} from '@/lib/analytics';
import { intentLabel } from '@/lib/labels';
import { formatPercent } from '@/lib/format';
import { cn } from '@/lib/cn';

const CHART_PALETTE = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-chart-6)',
];

// ────────────────────────────────────────────────────────────────────
// Card A — Intent distribution (vertical bars)
// ────────────────────────────────────────────────────────────────────
interface IntentBarsProps {
  items: IntentBucket[];
  loading?: boolean;
  onSelect?: (intent: string) => void;
}

const TOP_N = 10;

export function IntentBars({ items, loading, onSelect }: IntentBarsProps) {
  if (loading) return <ChartSkeleton title="Intent distribution" />;

  const top = items.slice(0, TOP_N);
  const overflow = items.length > TOP_N ? items.length - TOP_N : 0;
  const total = items.reduce((s, i) => s + i.count, 0);

  if (total === 0) {
    return (
      <Card padding="md" className="h-full">
        <div className="mb-2">
          <h3 className="text-base font-semibold text-text-primary">Intent distribution</h3>
          <p className="text-xs text-text-tertiary">Top intents across answered calls.</p>
        </div>
        <EmptyChart />
      </Card>
    );
  }

  return (
    <Card padding="md" className="h-full flex flex-col">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary">Intent distribution</h3>
          <p className="text-xs text-text-tertiary">Top intents across answered calls.</p>
        </div>
        {overflow > 0 && (
          <span className="text-xs text-text-tertiary">+{overflow} more</span>
        )}
      </div>
      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer>
          <BarChart
            data={top.map((d) => ({ ...d, label: intentLabel(d.intent) }))}
            margin={{ top: 10, right: 8, left: -14, bottom: 4 }}
            onClick={(e) => {
              const intent = (e?.activePayload?.[0]?.payload as IntentBucket | undefined)?.intent;
              if (intent && onSelect) onSelect(intent);
            }}
          >
            <CartesianGrid stroke="var(--color-border-subtle)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--color-text-tertiary)', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border-subtle)' }}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={70}
            />
            <YAxis
              tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={48}
            />
            <Tooltip cursor={{ fill: 'var(--color-slate-100)' }} content={<IntentTooltip />} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} cursor={onSelect ? 'pointer' : undefined}>
              {top.map((_, i) => (
                <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function IntentTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!.payload as IntentBucket & { label: string };
  return (
    <div className="rounded-md border border-border-subtle bg-surface shadow-lg px-3 py-2 text-xs">
      <div className="font-semibold text-text-primary">{p.label}</div>
      <div className="text-text-tertiary tabular mt-1">
        {p.count.toLocaleString('en-IN')} calls · {formatPercent(p.share, 1)}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Card B — Sentiment donut
// ────────────────────────────────────────────────────────────────────
const SENTIMENT_COLORS = {
  positive: 'var(--color-success-500)',
  neutral:  'var(--color-text-tertiary)',
  negative: 'var(--color-danger-500)',
} as const;

const SENTIMENT_LABEL = {
  positive: 'Positive',
  neutral:  'Neutral',
  negative: 'Negative',
} as const;

interface SentimentDonutProps {
  mix: SentimentMix;
  loading?: boolean;
}

export function SentimentDonut({ mix, loading }: SentimentDonutProps) {
  if (loading) return <ChartSkeleton title="Sentiment distribution" />;

  const data = (['positive', 'neutral', 'negative'] as const).map((k) => ({
    key: k,
    label: SENTIMENT_LABEL[k],
    value: mix[k],
    color: SENTIMENT_COLORS[k],
  }));

  const total = mix.total;

  if (total === 0) {
    return (
      <Card padding="md" className="h-full">
        <div className="mb-2">
          <h3 className="text-base font-semibold text-text-primary">Sentiment distribution</h3>
          <p className="text-xs text-text-tertiary">Across answered calls.</p>
        </div>
        <EmptyChart />
      </Card>
    );
  }

  return (
    <Card padding="md" className="h-full flex flex-col">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-text-primary">Sentiment distribution</h3>
        <p className="text-xs text-text-tertiary">Across answered calls.</p>
      </div>
      <div className="relative" style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={62}
              outerRadius={92}
              paddingAngle={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {data.map((d) => <Cell key={d.key} fill={d.color} />)}
            </Pie>
            <Tooltip content={<SentimentTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-2xl font-semibold text-text-primary tabular">
            {total.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] uppercase tracking-wide text-text-tertiary">answered</div>
        </div>
      </div>

      {/* Legend */}
      <ul className="mt-4 space-y-1.5">
        {data.map((d) => {
          const share = total ? d.value / total : 0;
          return (
            <li key={d.key} className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: d.color }}
              />
              <span className="text-text-primary flex-1">{d.label}</span>
              <span className="text-text-tertiary tabular">{d.value.toLocaleString('en-IN')}</span>
              <span className="font-semibold text-text-primary tabular w-12 text-right">
                {formatPercent(share, 1)}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function SentimentTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!;
  return (
    <div className="rounded-md border border-border-subtle bg-surface shadow-lg px-3 py-2 text-xs">
      <div className="font-semibold text-text-primary">{p.name}</div>
      <div className="text-text-tertiary tabular mt-1">
        {(p.value ?? 0).toLocaleString('en-IN')} calls
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Card C — Duration histogram
// ────────────────────────────────────────────────────────────────────
interface DurationHistogramProps {
  buckets: DurationBucket[];
  loading?: boolean;
}

export function DurationHistogram({ buckets, loading }: DurationHistogramProps) {
  const [hover, setHover] = useState<number | null>(null);
  if (loading) return <ChartSkeleton title="Call duration distribution" />;

  const total = buckets.reduce((s, b) => s + b.count, 0);

  if (total === 0) {
    return (
      <Card padding="md" className="h-full">
        <div className="mb-2">
          <h3 className="text-base font-semibold text-text-primary">Call duration distribution</h3>
          <p className="text-xs text-text-tertiary">Across answered calls.</p>
        </div>
        <EmptyChart />
      </Card>
    );
  }

  const max = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <Card padding="md" className="h-full flex flex-col">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-text-primary">Call duration distribution</h3>
        <p className="text-xs text-text-tertiary">Across answered calls.</p>
      </div>
      <div className="flex items-end justify-between gap-2 h-[200px] mt-4 px-2">
        {buckets.map((b, i) => {
          const h = (b.count / max) * 100;
          const isHover = hover === i;
          return (
            <div
              key={b.key}
              className="flex-1 flex flex-col items-center justify-end gap-2 h-full group"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {isHover && (
                <div className="text-xs tabular text-text-primary mb-1">
                  <span className="font-semibold">{b.count.toLocaleString('en-IN')}</span>
                  <span className="text-text-tertiary"> · {formatPercent(b.share, 1)}</span>
                </div>
              )}
              <div
                className={cn(
                  'w-full rounded-t-md transition-all duration-200',
                  isHover ? 'bg-blue-500' : 'bg-blue-500/80',
                )}
                style={{ height: `${Math.max(h, 2)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-5 gap-2 mt-2 text-center text-[11px] text-text-tertiary">
        {buckets.map((b) => (
          <div key={b.key}>{b.label}</div>
        ))}
      </div>
    </Card>
  );
}

function ChartSkeleton({ title }: { title: string }) {
  return (
    <Card padding="md" className="h-full">
      <h3 className="text-base font-semibold text-text-primary mb-1">{title}</h3>
      <Skeleton className="h-3 w-32 mb-4" />
      <Skeleton className="h-[240px] w-full" />
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-[240px] text-sm text-text-tertiary">
      No data in scope
    </div>
  );
}
