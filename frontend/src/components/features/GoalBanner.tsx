import { Target, TrendingUp, Sparkles } from 'lucide-react';
import type { Campaign, CallSummary } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { intentLabel } from '@/lib/labels';
import { cn } from '@/lib/cn';

interface GoalBannerProps {
  inScopeCampaigns: Campaign[];
  calls: CallSummary[] | null;
}

/*
 * Goal Banner — full-width hero card that surfaces the operator-defined
 * goal as the visual anchor of the analytics view. Soft brand gradient,
 * gradient accent stripe down the left edge, big tabular percentage on
 * the right with a fraction and progress bar.
 *
 * Renders one of three states:
 *   - Single goal in scope → metric + description
 *   - Multiple distinct goals → count + filter prompt
 *   - No goal → null (banner is hidden — KPIs do their job alone)
 */
export function GoalBanner({ inScopeCampaigns, calls }: GoalBannerProps) {
  const campaignsWithGoal = inScopeCampaigns.filter(
    (c): c is Campaign & { goal: NonNullable<Campaign['goal']> } => Boolean(c.goal?.targetIntent),
  );

  if (campaignsWithGoal.length === 0) return null;

  // Multiple distinct goals — render a compact prompt.
  const distinct = new Set(
    campaignsWithGoal.map((c) => c.goal.targetIntent + '|' + c.goal.description),
  );
  if (distinct.size > 1) {
    return (
      <div className="mb-8 relative overflow-hidden rounded-xl border border-blue-100 bg-surface">
        <div
          className="absolute inset-0 opacity-60 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at top right, rgba(0, 186, 242, 0.08), transparent 60%), radial-gradient(ellipse at bottom left, rgba(31, 79, 191, 0.08), transparent 60%)',
          }}
        />
        <div className="relative px-6 py-5 flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-500 to-blue-500 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Target size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              Campaign goals
            </div>
            <div className="mt-0.5 text-base text-text-primary">
              <span className="font-semibold tabular">{campaignsWithGoal.length}</span> campaigns in scope have a goal.
              <span className="text-text-tertiary"> Filter to a single campaign to see progress.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Single distinct goal → headline metric.
  const goal = campaignsWithGoal[0].goal;
  const answeredCalls = (calls ?? []).filter((c) => c.status === 'answered');
  const answered = answeredCalls.length;
  const met = answeredCalls.filter((c) => c.primaryIntent === goal.targetIntent).length;
  const pct = answered > 0 ? (met / answered) * 100 : 0;

  // Status hue for the metric — purely visual.
  const tone =
    answered === 0 ? 'neutral'
    : pct >= 30  ? 'strong'
    : pct >= 15  ? 'mid'
    :              'soft';

  const metricColor =
    tone === 'strong' ? 'text-success-700'
    : tone === 'mid'  ? 'text-brand-700'
    :                    'text-text-secondary';

  return (
    <div className="mb-8 relative overflow-hidden rounded-2xl border border-blue-100 bg-surface shadow-sm">
      {/* Ambient color orbs */}
      <div
        className="absolute -top-24 -right-24 h-72 w-72 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0, 186, 242, 0.18), transparent 70%)' }}
      />
      <div
        className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(31, 79, 191, 0.14), transparent 70%)' }}
      />

      {/* Gradient accent stripe on the left edge */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-500 via-brand-600 to-blue-500" />

      <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 lg:gap-10 items-center px-6 py-6 lg:px-8 lg:py-7">
        {/* Left — goal text */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-700">
            <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-brand-500 to-blue-500 text-white flex items-center justify-center shadow-sm">
              <Target size={14} />
            </span>
            Campaign Goal
          </div>
          <p className="mt-3 text-base lg:text-lg font-semibold text-text-primary leading-relaxed max-w-2xl">
            {goal.description}
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-text-tertiary flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Sparkles size={12} className="text-blue-600" />
              Met when call intent is
            </span>
            <Badge tone="brand">{intentLabel(goal.targetIntent)}</Badge>
          </div>
        </div>

        {/* Right — metric */}
        <div className="lg:border-l lg:border-blue-100 lg:pl-10 min-w-[260px]">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
            <TrendingUp size={12} />
            Goal met
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={cn('text-5xl font-semibold tabular leading-none', metricColor)}>
              {answered > 0 ? `${pct.toFixed(0)}%` : '—'}
            </span>
          </div>
          <div className="mt-1.5 text-xs text-text-tertiary tabular">
            {answered > 0 ? (
              <>
                <span className="font-semibold text-text-primary">
                  {met.toLocaleString('en-IN')}
                </span>{' '}
                met of{' '}
                <span className="font-semibold text-text-primary">
                  {answered.toLocaleString('en-IN')}
                </span>{' '}
                answered
              </>
            ) : (
              'No answered calls in scope yet'
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-2 w-full lg:w-64 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 via-brand-600 to-blue-500 transition-all"
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
