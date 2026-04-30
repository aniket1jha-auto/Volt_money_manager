import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type {
  Campaign,
  CallSummary,
  VoiceAgent,
  Workspace,
  FailureReason,
} from '@/types';
import { getCampaigns, getCalls, getVoiceAgents } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';
import { PageHeader } from '@/components/features/PageHeader';
import { Card } from '@/components/ui/Card';
import { KpiTile } from '@/components/ui/KpiTile';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { MultiSelect, FilterChip } from '@/components/ui/MultiSelect';
import {
  DateRangeFilter,
  rangeBounds,
  type DateRange,
} from '@/components/ui/DateRangeFilter';
import { Table, type TableColumn } from '@/components/ui/Table';
import { CampaignStatusBadge } from '@/components/features/StatusBadge';
import { TrendChart } from '@/components/features/TrendChart';
import { FailureBreakdown } from '@/components/features/FailureBreakdown';
import {
  aggregate,
  dailySeries,
  failureBreakdown,
  perCampaignRows,
  type AggregateMetrics,
  type CampaignRow,
} from '@/lib/analytics';
import { formatNumber, formatPercent, formatMoney, formatDate } from '@/lib/format';
import { failureReasonLabel } from '@/lib/labels';

// Anchor "now" to the mock dataset so default ranges hit data.
const MOCK_NOW = new Date('2026-04-30T11:00:00.000Z');

interface CampaignAnalyticsProps {
  /** When set, this becomes a single-campaign view (Campaign Detail). */
  fixedCampaignId?: string;
  /** Override the page header. */
  headerTitle?: string;
  headerSubtitle?: string;
}

export default function CampaignAnalytics({
  fixedCampaignId,
  headerTitle,
  headerSubtitle,
}: CampaignAnalyticsProps = {}) {
  const { activeWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  // ── Filter state ───────────────────────────────────────────────────
  const [campaignIds, setCampaignIds] = useState<string[]>(
    fixedCampaignId ? [fixedCampaignId] : [],
  );
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const [range, setRange] = useState<DateRange>({ preset: '30d' });

  // Pre-apply ?failure= from query string (linked from Dashboard / failure list)
  const initialFailureFromQuery = params.get('failure') as FailureReason | null;
  const [failureFilter, setFailureFilter] = useState<FailureReason | null>(initialFailureFromQuery);
  useEffect(() => {
    if (initialFailureFromQuery) {
      params.delete('failure');
      setParams(params, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Data state ─────────────────────────────────────────────────────
  const [allCampaigns, setAllCampaigns] = useState<Campaign[] | null>(null);
  const [agents, setAgents] = useState<VoiceAgent[] | null>(null);
  const [calls, setCalls] = useState<CallSummary[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const retry = () => setReloadTick((t) => t + 1);

  // Load campaigns + agents once per workspace
  useEffect(() => {
    if (!activeWorkspace) return;
    let cancelled = false;
    Promise.all([
      getCampaigns(activeWorkspace.id),
      getVoiceAgents(activeWorkspace.id),
    ])
      .then(([c, a]) => {
        if (cancelled) return;
        setAllCampaigns(c.items);
        setAgents(a);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err);
      });
    return () => { cancelled = true; };
  }, [activeWorkspace, reloadTick]);

  // Bounds for the selected range
  const { fromIso, toIso } = useMemo(() => rangeBounds(range, MOCK_NOW), [range]);

  // Re-fetch calls when filters change
  useEffect(() => {
    if (!activeWorkspace) return;
    let cancelled = false;
    setCalls(null);
    setError(null);
    getCalls(activeWorkspace.id, {
      campaignId: campaignIds.length ? campaignIds : undefined,
      voiceAgentId: agentIds.length ? agentIds : undefined,
      from: fromIso,
      to: toIso,
      limit: 50_000,
    })
      .then(({ items }) => {
        if (cancelled) return;
        setCalls(items);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err);
      });
    return () => { cancelled = true; };
  }, [activeWorkspace, campaignIds, agentIds, fromIso, toIso, reloadTick]);

  // ── Derived ────────────────────────────────────────────────────────
  const visibleCalls = useMemo(() => {
    if (!calls) return null;
    if (!failureFilter) return calls;
    return calls.filter((c) => c.failureReason === failureFilter);
  }, [calls, failureFilter]);

  const metrics: AggregateMetrics | null = useMemo(() => {
    if (!visibleCalls) return null;
    return aggregate(visibleCalls);
  }, [visibleCalls]);

  const series = useMemo(() => {
    if (!visibleCalls) return null;
    return dailySeries(visibleCalls, fromIso, toIso);
  }, [visibleCalls, fromIso, toIso]);

  const failures = useMemo(() => {
    if (!calls) return null;
    return failureBreakdown(calls);
  }, [calls]);

  // Per-campaign comparison (only when 0 or 2+ campaigns are in scope)
  const inScopeCampaigns = useMemo(() => {
    if (!allCampaigns) return [];
    if (campaignIds.length === 0) return allCampaigns;
    return allCampaigns.filter((c) => campaignIds.includes(c.id));
  }, [allCampaigns, campaignIds]);

  const showComparison = !fixedCampaignId && inScopeCampaigns.length !== 1;

  const comparisonRows: CampaignRow[] | null = useMemo(() => {
    if (!visibleCalls || !showComparison) return null;
    return perCampaignRows(visibleCalls, inScopeCampaigns);
  }, [visibleCalls, inScopeCampaigns, showComparison]);

  // Total base uploaded (across in-scope campaigns)
  const baseUploaded = useMemo(() => {
    if (!inScopeCampaigns) return 0;
    return inScopeCampaigns.reduce((s, c) => s + c.metrics.baseUploaded, 0);
  }, [inScopeCampaigns]);

  // ── Filter helpers ─────────────────────────────────────────────────
  const filtersActive =
    (!fixedCampaignId && campaignIds.length > 0) ||
    agentIds.length > 0 ||
    range.preset !== '30d' ||
    failureFilter !== null;

  function clearAll() {
    if (!fixedCampaignId) setCampaignIds([]);
    setAgentIds([]);
    setRange({ preset: '30d' });
    setFailureFilter(null);
  }

  // ── Render ─────────────────────────────────────────────────────────
  if (!activeWorkspace) return null;

  const campaignOptions = (allCampaigns ?? []).map((c) => ({
    value: c.id,
    label: c.name,
    hint: c.status,
  }));

  const agentOptions = (agents ?? []).map((a) => ({
    value: a.id,
    label: a.name,
    hint: a.voice,
  }));

  return (
    <>
      <PageHeader
        title={headerTitle ?? 'Campaign Analytics'}
        subtitle={
          headerSubtitle ??
          'Aggregated daily-level performance across one or many campaigns.'
        }
      />

      {/* FILTER BAR */}
      <div className="sticky top-0 z-20 -mx-8 px-8 py-3 bg-bg/80 backdrop-blur border-b border-border-subtle mb-6">
        <div className="flex flex-wrap items-center gap-2">
          {!fixedCampaignId && (
            <MultiSelect
              options={campaignOptions}
              value={campaignIds}
              onChange={setCampaignIds}
              allLabel="All campaigns"
              noun="campaigns"
              menuMinWidth={300}
            />
          )}
          <MultiSelect
            options={agentOptions}
            value={agentIds}
            onChange={setAgentIds}
            allLabel="All agents"
            noun="agents"
          />
          <DateRangeFilter value={range} onChange={setRange} now={MOCK_NOW} />

          {filtersActive && (
            <button
              onClick={clearAll}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 ml-1"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Active filter chips */}
        <ActiveChips
          campaignIds={campaignIds}
          campaigns={allCampaigns ?? []}
          agentIds={agentIds}
          agents={agents ?? []}
          failureFilter={failureFilter}
          fixedCampaignId={fixedCampaignId}
          onRemoveCampaign={(id) => setCampaignIds(campaignIds.filter((x) => x !== id))}
          onRemoveAgent={(id) => setAgentIds(agentIds.filter((x) => x !== id))}
          onRemoveFailure={() => setFailureFilter(null)}
        />
      </div>

      {error && (
        <ErrorState
          title="We couldn't load analytics"
          description="The mock API returned an error. Adjusting filters or retrying should clear it."
          onRetry={retry}
          className="mb-6"
        />
      )}

      {/* KPI STRIP */}
      <KpiStrip metrics={metrics} baseUploaded={baseUploaded} workspace={activeWorkspace} />

      {/* TREND */}
      <div className="mb-8">
        <TrendChart data={series ?? []} loading={series === null} />
      </div>

      {/* FAILURES */}
      <div className="mb-8">
        <FailureBreakdown
          items={failures?.items ?? []}
          total={failures?.total ?? 0}
          loading={failures === null}
          viewAllHref="/analytics/agents"
          onSelect={(reason) => navigate(`/analytics/agents?failure=${reason}`)}
        />
      </div>

      {/* PER-CAMPAIGN COMPARISON */}
      {showComparison && (
        <ComparisonTable
          rows={comparisonRows}
          agents={agents ?? []}
          workspace={activeWorkspace}
          onRowClick={(c) => navigate(`/campaigns/${c.id}`)}
        />
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// KPI strip
// ────────────────────────────────────────────────────────────────────
function KpiStrip({
  metrics,
  baseUploaded,
  workspace,
}: {
  metrics: AggregateMetrics | null;
  baseUploaded: number;
  workspace: Workspace;
}) {
  const loading = metrics === null;
  const initiatedShare = baseUploaded > 0 && metrics ? metrics.initiated / baseUploaded : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
      <KpiTile
        loading={loading}
        label="Total Base"
        value={formatNumber(baseUploaded, workspace)}
        breakdown="contacts uploaded"
      />
      <KpiTile
        loading={loading}
        label="Initiated"
        value={metrics ? formatNumber(metrics.initiated, workspace) : '—'}
        breakdown={baseUploaded > 0 ? `${formatPercent(initiatedShare, 1)} of base` : undefined}
      />
      <KpiTile
        loading={loading}
        label="Connected"
        value={metrics ? formatNumber(metrics.connected, workspace) : '—'}
        breakdown={metrics ? `${formatPercent(metrics.connectedRate, 1)} connect rate` : undefined}
      />
      <KpiTile
        loading={loading}
        label="Answered"
        value={metrics ? formatNumber(metrics.answered, workspace) : '—'}
        breakdown={metrics ? `${formatPercent(metrics.answeredRate, 1)} answer rate` : undefined}
      />
      <KpiTile
        loading={loading}
        label="Failed"
        value={metrics ? formatNumber(metrics.failed, workspace) : '—'}
        breakdown={metrics ? `${formatPercent(metrics.failureRate, 1)} fail rate` : undefined}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Active filter chips
// ────────────────────────────────────────────────────────────────────
function ActiveChips({
  campaignIds,
  campaigns,
  agentIds,
  agents,
  failureFilter,
  fixedCampaignId,
  onRemoveCampaign,
  onRemoveAgent,
  onRemoveFailure,
}: {
  campaignIds: string[];
  campaigns: Campaign[];
  agentIds: string[];
  agents: VoiceAgent[];
  failureFilter: FailureReason | null;
  fixedCampaignId?: string;
  onRemoveCampaign: (id: string) => void;
  onRemoveAgent: (id: string) => void;
  onRemoveFailure: () => void;
}) {
  const items: { key: string; label: string; remove: () => void }[] = [];

  if (!fixedCampaignId) {
    for (const id of campaignIds) {
      const c = campaigns.find((x) => x.id === id);
      if (c) items.push({ key: `c:${id}`, label: c.name, remove: () => onRemoveCampaign(id) });
    }
  }
  for (const id of agentIds) {
    const a = agents.find((x) => x.id === id);
    if (a) items.push({ key: `a:${id}`, label: a.name, remove: () => onRemoveAgent(id) });
  }
  if (failureFilter) {
    items.push({ key: 'f', label: `Failure: ${failureReasonLabel(failureFilter)}`, remove: onRemoveFailure });
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {items.map((it) => (
        <FilterChip key={it.key} label={it.label} onRemove={it.remove} />
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Comparison table
// ────────────────────────────────────────────────────────────────────
function ComparisonTable({
  rows,
  agents,
  workspace,
  onRowClick,
}: {
  rows: CampaignRow[] | null;
  agents: VoiceAgent[];
  workspace: Workspace;
  onRowClick: (campaign: Campaign) => void;
}) {
  const agentById = new Map(agents.map((a) => [a.id, a]));

  if (rows === null) {
    return (
      <Card padding="md" className="mb-4">
        <Skeleton className="h-5 w-48 mb-4" />
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      </Card>
    );
  }

  const cols: TableColumn<CampaignRow>[] = [
    {
      key: 'name',
      header: 'Campaign',
      cell: ({ campaign }) => (
        <div className="min-w-0">
          <div className="font-medium text-text-primary truncate">{campaign.name}</div>
          <div className="text-xs text-text-tertiary truncate">
            {agentById.get(campaign.voiceAgentId)?.name ?? '—'}
          </div>
        </div>
      ),
      sort: (a, b) => a.campaign.name.localeCompare(b.campaign.name),
      width: 280,
    },
    {
      key: 'status',
      header: 'Status',
      cell: ({ campaign }) => <CampaignStatusBadge status={campaign.status} />,
      sort: (a, b) => a.campaign.status.localeCompare(b.campaign.status),
      width: 120,
    },
    {
      key: 'started',
      header: 'Started',
      cell: ({ campaign }) =>
        campaign.startedAt ? formatDate(campaign.startedAt, workspace) : '—',
      sort: (a, b) => (a.campaign.startedAt ?? '').localeCompare(b.campaign.startedAt ?? ''),
      width: 130,
    },
    {
      key: 'base',
      header: 'Base',
      align: 'right',
      cell: ({ campaign }) => (
        <span className="tabular">{formatNumber(campaign.metrics.baseUploaded, workspace)}</span>
      ),
      sort: (a, b) => a.campaign.metrics.baseUploaded - b.campaign.metrics.baseUploaded,
    },
    {
      key: 'initiated',
      header: 'Initiated',
      align: 'right',
      cell: ({ metrics }) => <span className="tabular">{formatNumber(metrics.initiated, workspace)}</span>,
      sort: (a, b) => a.metrics.initiated - b.metrics.initiated,
    },
    {
      key: 'connected',
      header: 'Connected',
      align: 'right',
      cell: ({ metrics }) => <span className="tabular">{formatNumber(metrics.connected, workspace)}</span>,
      sort: (a, b) => a.metrics.connected - b.metrics.connected,
    },
    {
      key: 'answered',
      header: 'Answered',
      align: 'right',
      cell: ({ metrics }) => <span className="tabular">{formatNumber(metrics.answered, workspace)}</span>,
      sort: (a, b) => a.metrics.answered - b.metrics.answered,
    },
    {
      key: 'failed',
      header: 'Failed',
      align: 'right',
      cell: ({ metrics }) => <span className="tabular">{formatNumber(metrics.failed, workspace)}</span>,
      sort: (a, b) => a.metrics.failed - b.metrics.failed,
    },
    {
      key: 'connRate',
      header: 'Conn %',
      align: 'right',
      cell: ({ metrics }) => <span className="tabular">{formatPercent(metrics.connectedRate, 1)}</span>,
      sort: (a, b) => a.metrics.connectedRate - b.metrics.connectedRate,
    },
    {
      key: 'ansRate',
      header: 'Ans %',
      align: 'right',
      cell: ({ metrics }) => <span className="tabular">{formatPercent(metrics.answeredRate, 1)}</span>,
      sort: (a, b) => a.metrics.answeredRate - b.metrics.answeredRate,
    },
    {
      key: 'cost',
      header: 'Cost',
      align: 'right',
      cell: ({ metrics }) => <span className="tabular">{formatMoney(metrics.totalCost, workspace)}</span>,
      sort: (a, b) => a.metrics.totalCost - b.metrics.totalCost,
    },
  ];

  // Default sort: most recently started first.
  const defaultSort = { key: 'started', dir: 'desc' as const };

  return (
    <section className="mb-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-base font-semibold text-text-primary">Per-campaign comparison</h3>
        <span className="text-xs text-text-tertiary">{rows.length} campaigns in scope</span>
      </div>
      <Table
        columns={cols}
        rows={rows}
        rowKey={(r) => r.campaign.id}
        defaultSort={defaultSort}
        onRowClick={(r) => onRowClick(r.campaign)}
        emptyText="No campaigns match these filters."
      />
    </section>
  );
}
