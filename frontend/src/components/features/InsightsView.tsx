import {
  Smile,
  Meh,
  Frown,
  Wrench,
  Target,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { CallInsights } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { intentLabel } from '@/lib/labels';
import { cn } from '@/lib/cn';

interface InsightsViewProps {
  insights: CallInsights;
}

export function InsightsView({ insights }: InsightsViewProps) {
  return (
    <div className="space-y-6">
      <SummarySection insights={insights} />
      <IntentSection insights={insights} />
      <SentimentSection insights={insights} />
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

function SummarySection({ insights }: { insights: CallInsights }) {
  return (
    <Section title="Call summary" icon={Sparkles}>
      <div className="rounded-md border border-border-subtle bg-slate-25 px-4 py-3">
        <p className="text-sm text-text-primary leading-relaxed">
          {insights.summary || 'No summary available.'}
        </p>
      </div>
    </Section>
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

function SentimentSection({ insights }: { insights: CallInsights }) {
  const Icon = insights.sentiment === 'positive'
    ? Smile
    : insights.sentiment === 'negative'
      ? Frown
      : Meh;
  const colorClass = insights.sentiment === 'positive'
    ? 'text-success-700'
    : insights.sentiment === 'negative'
      ? 'text-danger-700'
      : 'text-text-tertiary';

  return (
    <Section title="Sentiment" icon={Smile}>
      <div className="flex items-center gap-3">
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
