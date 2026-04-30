import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
} from 'recharts';
import {
  Smile,
  Meh,
  Frown,
  Wrench,
  Tags,
  Target,
  ListChecks,
  type LucideIcon,
} from 'lucide-react';
import type { CallInsights } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { intentLabel, outcomeLabel } from '@/lib/labels';
import { cn } from '@/lib/cn';

interface InsightsViewProps {
  insights: CallInsights;
}

export function InsightsView({ insights }: InsightsViewProps) {
  return (
    <div className="space-y-6">
      <IntentSection insights={insights} />
      <SentimentSection insights={insights} />
      <EntitiesSection insights={insights} />
      <OutcomeSection insights={insights} />
      <ToolCallsSection insights={insights} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2.5">
        <Icon size={13} />
        {title}
      </h4>
      {children}
    </section>
  );
}

function IntentSection({ insights }: { insights: CallInsights }) {
  return (
    <Section title="Intent" icon={Target}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="brand" size="md">{intentLabel(insights.primaryIntent)}</Badge>
        {insights.secondaryIntents.length > 0 && (
          <>
            <span className="text-xs text-text-tertiary">also:</span>
            {insights.secondaryIntents.map((i) => (
              <Badge key={i} tone="neutral">{intentLabel(i)}</Badge>
            ))}
          </>
        )}
      </div>
    </Section>
  );
}

const SENTIMENT_COLOR = {
  positive: 'var(--color-success-500)',
  neutral:  'var(--color-text-tertiary)',
  negative: 'var(--color-danger-500)',
} as const;

function SentimentSection({ insights }: { insights: CallInsights }) {
  const Icon = insights.sentiment === 'positive' ? Smile : insights.sentiment === 'negative' ? Frown : Meh;
  const colorClass = insights.sentiment === 'positive'
    ? 'text-success-700'
    : insights.sentiment === 'negative'
    ? 'text-danger-700'
    : 'text-text-tertiary';

  const data = insights.sentimentByTurn.map((v, i) => ({
    turn: i,
    score: v,
  }));

  return (
    <Section title="Sentiment" icon={Smile}>
      <div className="flex items-center gap-3 mb-3">
        <Icon size={20} className={colorClass} />
        <div>
          <div className={cn('text-base font-semibold capitalize', colorClass)}>
            {insights.sentiment}
          </div>
          <div className="text-xs text-text-tertiary tabular">
            score: {insights.sentimentScore.toFixed(2)}
          </div>
        </div>
      </div>
      <div className="rounded-md border border-border-subtle p-3">
        <div className="text-[11px] uppercase tracking-wider text-text-tertiary mb-1">
          Sentiment progression by turn
        </div>
        <div style={{ width: '100%', height: 100 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border-subtle)" vertical={false} />
              <XAxis dataKey="turn" tick={{ fill: 'var(--color-text-tertiary)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis domain={[-1, 1]} ticks={[-1, 0, 1]} tick={{ fill: 'var(--color-text-tertiary)', fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
              <Tooltip content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="rounded-md border border-border-subtle bg-surface shadow-md px-2.5 py-1.5 text-xs">
                    <div>Turn {payload[0]!.payload.turn}</div>
                    <div className="tabular font-medium">{Number(payload[0]!.value).toFixed(2)}</div>
                  </div>
                ) : null
              } />
              <ReferenceLine y={0} stroke="var(--color-border-medium)" strokeDasharray="2 2" />
              <Line
                type="monotone"
                dataKey="score"
                stroke={SENTIMENT_COLOR[insights.sentiment]}
                strokeWidth={2}
                dot={{ r: 2.5, fill: SENTIMENT_COLOR[insights.sentiment], strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Section>
  );
}

function EntitiesSection({ insights }: { insights: CallInsights }) {
  if (insights.entities.length === 0) {
    return (
      <Section title="Key entities" icon={Tags}>
        <p className="text-xs text-text-tertiary">No entities extracted from this call.</p>
      </Section>
    );
  }
  return (
    <Section title="Key entities" icon={Tags}>
      <ul className="grid grid-cols-2 gap-2">
        {insights.entities.map((e, i) => (
          <li key={i} className="rounded-md border border-border-subtle bg-surface px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-text-tertiary">{e.label}</div>
            <div className="text-sm font-medium text-text-primary tabular">{e.value}</div>
            <div className="text-[10px] text-text-tertiary mt-0.5">turn {e.turnIndex} · {e.type}</div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function OutcomeSection({ insights }: { insights: CallInsights }) {
  return (
    <Section title="Call outcome" icon={ListChecks}>
      <Badge tone="info" size="md">{outcomeLabel(insights.outcome)}</Badge>
    </Section>
  );
}

function ToolCallsSection({ insights }: { insights: CallInsights }) {
  if (insights.toolCalls.length === 0) {
    return (
      <Section title="Tools called" icon={Wrench}>
        <p className="text-xs text-text-tertiary">No tools were invoked during this call.</p>
      </Section>
    );
  }
  return (
    <Section title="Tools called" icon={Wrench}>
      <ul className="space-y-2.5">
        {insights.toolCalls.map((t, i) => (
          <li key={i} className="rounded-md border border-border-subtle bg-surface p-3">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <code className="font-mono text-xs font-semibold text-brand-700">{t.name}()</code>
              <div className="flex items-center gap-1.5">
                <Badge tone={t.status === 'success' ? 'success' : 'danger'}>{t.status}</Badge>
                <span className="text-[10px] text-text-tertiary tabular">{t.durationMs}ms · turn {t.turnIndex}</span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-0.5">Args</div>
                <code className="block font-mono text-[11px] text-text-secondary bg-slate-25 px-2 py-1 rounded truncate">
                  {t.argsPreview}
                </code>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-0.5">Result</div>
                <code className="block font-mono text-[11px] text-text-secondary bg-slate-25 px-2 py-1 rounded truncate">
                  {t.resultPreview}
                </code>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
