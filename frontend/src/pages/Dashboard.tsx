import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, PhoneCall, ArrowRight } from 'lucide-react';
import type {
  Campaign,
  VoiceAgent,
  Workspace,
  FailureReason,
} from '@/types';
import {
  getCampaigns,
  getVoiceAgents,
  getDashboardKpis,
  getIntentsToday,
  getFailureReasonsToday,
  type DashboardKpis,
} from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { PageHeader } from '@/components/features/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { KpiTile } from '@/components/ui/KpiTile';
import { ErrorState } from '@/components/ui/ErrorState';
import { MiniBarList, type MiniBarItem } from '@/components/ui/MiniBarList';
import {
  CampaignCard,
  CampaignCardSkeleton,
} from '@/components/features/CampaignCard';
import {
  formatNumber,
  formatPercent,
  formatDuration,
} from '@/lib/format';
import { intentLabel, failureReasonLabel } from '@/lib/labels';

export default function Dashboard() {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const firstName = user?.name.split(' ')[0] ?? 'there';

  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [recent, setRecent] = useState<Campaign[] | null>(null);
  const [agents, setAgents] = useState<VoiceAgent[] | null>(null);
  const [intents, setIntents] = useState<{ intent: string; count: number }[] | null>(null);
  const [failures, setFailures] = useState<{ reason: FailureReason; count: number }[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!activeWorkspace) return;
    let cancelled = false;
    setKpis(null);
    setRecent(null);
    setAgents(null);
    setIntents(null);
    setFailures(null);
    setError(null);

    Promise.all([
      getDashboardKpis(activeWorkspace.id),
      getCampaigns(activeWorkspace.id, { limit: 6, sort: 'recent' }),
      getVoiceAgents(activeWorkspace.id),
      getIntentsToday(activeWorkspace.id),
      getFailureReasonsToday(activeWorkspace.id),
    ])
      .then(([k, c, a, i, f]) => {
        if (cancelled) return;
        setKpis(k);
        setRecent(c.items);
        setAgents(a);
        setIntents(i);
        setFailures(f);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err);
      });

    return () => { cancelled = true; };
  }, [activeWorkspace, reloadTick]);

  if (!activeWorkspace) return null;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle="Voice campaigns at a glance — KPIs, recent activity, and today's signal."
        actions={
          <Button leftIcon={<Plus size={16} />} onClick={() => navigate('/campaigns/new')}>
            New campaign
          </Button>
        }
      />

      {error ? (
        <ErrorState
          title="We couldn't load the dashboard"
          description="The mock API returned an error. This usually clears with a retry."
          onRetry={() => setReloadTick((t) => t + 1)}
        />
      ) : (
        <>
          <KpiStrip kpis={kpis} workspace={activeWorkspace} />

          <RecentCampaigns campaigns={recent} agents={agents} workspace={activeWorkspace} />

          <TodayAtAGlance
            intents={intents}
            failures={failures}
            onIntent={(intent) => navigate(`/analytics/agents?intent=${encodeURIComponent(intent)}`)}
            onFailure={(reason) => navigate(`/analytics/campaigns?failure=${encodeURIComponent(reason)}`)}
          />
        </>
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// KPI strip
// ────────────────────────────────────────────────────────────────────
function KpiStrip({ kpis, workspace }: { kpis: DashboardKpis | null; workspace: Workspace }) {
  const loading = !kpis;
  const callsDelta = kpis ? deltaText(kpis.callsToday, kpis.callsYesterday) : null;
  const rateDelta = kpis ? rateDeltaText(kpis.connectedRate7d, kpis.connectedRatePrev7d) : null;
  const durationDelta = kpis ? durationDeltaText(kpis.avgDuration7d, kpis.avgDurationPrev7d) : null;

  const activeBreakdown = kpis
    ? `${kpis.activeCampaigns} running · ${kpis.scheduledCampaigns} scheduled`
    : undefined;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
      <KpiTile
        loading={loading}
        label="Active Campaigns"
        value={kpis ? formatNumber(kpis.activeCampaigns + kpis.scheduledCampaigns, workspace) : '—'}
        breakdown={activeBreakdown}
      />
      <KpiTile
        loading={loading}
        label="Calls Today"
        value={kpis ? formatNumber(kpis.callsToday, workspace) : '—'}
        delta={callsDelta ?? undefined}
        breakdown="vs yesterday"
      />
      <KpiTile
        loading={loading}
        label="Connected Rate (7d)"
        value={kpis ? formatPercent(kpis.connectedRate7d, 1) : '—'}
        delta={rateDelta ?? undefined}
        breakdown="vs prior 7d"
      />
      <KpiTile
        loading={loading}
        label="Avg Call Duration (7d)"
        value={kpis ? formatDuration(kpis.avgDuration7d) : '—'}
        delta={durationDelta ?? undefined}
        breakdown="vs prior 7d"
      />
    </div>
  );
}

function deltaText(curr: number, prev: number) {
  if (prev === 0 && curr === 0) return { direction: 'neutral' as const, text: '0' };
  if (prev === 0) return { direction: 'up' as const, text: `+${curr}` };
  const diff = curr - prev;
  const pct = (diff / prev) * 100;
  return {
    direction: diff > 0 ? ('up' as const) : diff < 0 ? ('down' as const) : ('neutral' as const),
    text: `${diff > 0 ? '+' : ''}${pct.toFixed(0)}%`,
  };
}

function rateDeltaText(curr: number, prev: number) {
  const diff = curr - prev;
  const pp = diff * 100;
  return {
    direction: diff > 0.001 ? ('up' as const) : diff < -0.001 ? ('down' as const) : ('neutral' as const),
    text: `${diff >= 0 ? '+' : ''}${pp.toFixed(1)}pp`,
  };
}

function durationDeltaText(curr: number, prev: number) {
  const diff = curr - prev;
  return {
    direction: diff > 0 ? ('up' as const) : diff < 0 ? ('down' as const) : ('neutral' as const),
    text: `${diff >= 0 ? '+' : ''}${diff}s`,
    invert: false,
  };
}

// ────────────────────────────────────────────────────────────────────
// Recent campaigns
// ────────────────────────────────────────────────────────────────────
function RecentCampaigns({
  campaigns,
  agents,
  workspace,
}: {
  campaigns: Campaign[] | null;
  agents: VoiceAgent[] | null;
  workspace: Workspace;
}) {
  const loading = campaigns === null || agents === null;
  const agentById = new Map((agents ?? []).map((a) => [a.id, a]));

  return (
    <section className="mb-12">
      <div className="flex items-end justify-between mb-4">
        <h2 className="text-lg font-semibold text-text-primary">Recent campaigns</h2>
        <Link
          to="/campaigns"
          className="text-sm font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
        >
          View all <ArrowRight size={14} />
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => <CampaignCardSkeleton key={i} />)}
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyCampaigns />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              agent={agentById.get(c.voiceAgentId)}
              workspace={workspace}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyCampaigns() {
  const navigate = useNavigate();
  return (
    <Card padding="lg" className="flex flex-col items-center justify-center text-center py-20">
      <div className="h-14 w-14 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center mb-4">
        <PhoneCall size={24} />
      </div>
      <h3 className="font-serif italic text-3xl text-text-primary mb-2">
        No campaigns yet
      </h3>
      <p className="text-sm text-text-tertiary max-w-sm mb-6">
        Upload a contact list and pick a voice agent to start your first
        outbound campaign.
      </p>
      <Button leftIcon={<Plus size={16} />} onClick={() => navigate('/campaigns/new')}>
        Create your first campaign
      </Button>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────
// Today at a glance
// ────────────────────────────────────────────────────────────────────
function TodayAtAGlance({
  intents,
  failures,
  onIntent,
  onFailure,
}: {
  intents: { intent: string; count: number }[] | null;
  failures: { reason: FailureReason; count: number }[] | null;
  onIntent: (intent: string) => void;
  onFailure: (reason: FailureReason) => void;
}) {
  const loadingI = intents === null;
  const loadingF = failures === null;

  const intentItems: MiniBarItem[] = (intents ?? []).map((x) => ({
    key: x.intent,
    label: intentLabel(x.intent),
    count: x.count,
  }));

  const failureItems: MiniBarItem[] = (failures ?? []).map((x) => ({
    key: x.reason,
    label: failureReasonLabel(x.reason),
    count: x.count,
  }));

  return (
    <section className="mb-4">
      <h2 className="text-lg font-semibold text-text-primary mb-4">
        Today at a glance
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card padding="md">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary">Top intents today</h3>
            <span className="text-xs text-text-tertiary">Answered calls</span>
          </div>
          <MiniBarList
            loading={loadingI}
            items={intentItems}
            barColor="bg-brand-500/80"
            onItemClick={(key) => onIntent(key)}
            emptyText="No call data yet today"
          />
        </Card>

        <Card padding="md">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary">Top failure reasons today</h3>
            <span className="text-xs text-text-tertiary">Failed calls</span>
          </div>
          <MiniBarList
            loading={loadingF}
            items={failureItems}
            barColor="bg-danger-500/80"
            onItemClick={(key) => onFailure(key as FailureReason)}
            emptyText="No failures yet today"
          />
        </Card>
      </div>
    </section>
  );
}
