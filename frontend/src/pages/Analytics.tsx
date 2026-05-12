import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import {
  Search,
  Play,
  ChevronRight,
  Users,
  PhoneOutgoing,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Clock,
  TrendingUp,
  Smile,
} from 'lucide-react';
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
import { Input } from '@/components/ui/Input';
import { KpiTile } from '@/components/ui/KpiTile';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { MultiSelect, FilterChip } from '@/components/ui/MultiSelect';
import {
  DateRangeFilter,
  rangeBounds,
  type DateRange,
} from '@/components/ui/DateRangeFilter';
import { Pagination } from '@/components/ui/Pagination';
import { Table, type TableColumn } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { CallStatusBadge } from '@/components/features/StatusBadge';
import { TrendChart } from '@/components/features/TrendChart';
import {
  IntentBars,
  SentimentDonut,
  DurationHistogram,
} from '@/components/features/DistributionCharts';
import { CallDetailDrawer } from '@/components/features/CallDetailDrawer';
import {
  aggregate,
  dailySeries,
  intentDistribution,
  sentimentDistribution,
  durationHistogram,
  type AggregateMetrics,
  type SentimentMix,
} from '@/lib/analytics';
import {
  formatNumber,
  formatPercent,
  formatDate,
  formatDuration,
  formatPhone,
  formatTime,
} from '@/lib/format';
import { intentLabel, failureReasonLabel } from '@/lib/labels';
import { cn } from '@/lib/cn';

// Anchor "now" to the mock dataset so default ranges hit data.
const MOCK_NOW = new Date('2026-04-30T11:00:00.000Z');
const PAGE_SIZE = 50;
const DURATION_DOMAIN: [number, number] = [0, Number.POSITIVE_INFINITY];

interface DurationBucket {
  value: string;
  label: string;
  range: [number, number];
}

const DURATION_BUCKETS: DurationBucket[] = [
  { value: 'any',   label: 'Any duration', range: [0, Number.POSITIVE_INFINITY] },
  { value: 'lt30',  label: '< 30s',        range: [0, 30] },
  { value: '30_60', label: '30s – 1m',     range: [30, 60] },
  { value: '1_3',   label: '1m – 3m',      range: [60, 180] },
  { value: '3_5',   label: '3m – 5m',      range: [180, 300] },
  { value: '5_10',  label: '5m – 10m',     range: [300, 600] },
  { value: 'gt10',  label: '10m+',         range: [600, Number.POSITIVE_INFINITY] },
];

function bucketFromRange(range: [number, number]): DurationBucket {
  return (
    DURATION_BUCKETS.find(
      (b) => b.range[0] === range[0] && b.range[1] === range[1],
    ) ?? DURATION_BUCKETS[0]
  );
}

type Sentiment = 'positive' | 'neutral' | 'negative';

interface AnalyticsProps {
  /** When set, this becomes a single-campaign view (Campaign Detail). */
  fixedCampaignId?: string;
  /** Override the page header. */
  headerTitle?: string;
  headerSubtitle?: string;
  /** Optional action node rendered in the page header (right side). */
  headerActions?: ReactNode;
  /**
   * Optional content rendered between the page header and the filter bar.
   * Useful for surfacing campaign-specific data (e.g. run history) on
   * the Campaign Detail page.
   */
  preludeContent?: ReactNode;
  /**
   * Bumping this number forces all data fetches to re-run. Used by
   * parents that mutate campaign state (e.g. starting a new run) and
   * want the analytics view to refresh.
   */
  refreshKey?: number;
}

/*
 * Analytics — the unified view that combines campaign-level performance
 * (KPIs, daily trend) with conversation insights (intent / sentiment /
 * duration distributions and the calls table). One page, one filter
 * bar, one drawer.
 *
 * Used in two modes:
 *   - Standalone /analytics — every campaign in scope by default; the
 *     campaign filter is visible.
 *   - Campaign Detail (/campaigns/:id) — locked to one campaign via
 *     `fixedCampaignId`; the campaign picker is hidden and the parent
 *     stitches a Run History card in via `preludeContent`.
 */
export default function Analytics({
  fixedCampaignId,
  headerTitle,
  headerSubtitle,
  headerActions,
  preludeContent,
  refreshKey = 0,
}: AnalyticsProps = {}) {
  const { activeWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const { callId } = useParams<{ callId?: string }>();
  const [params, setParams] = useSearchParams();

  // ── Filter state ───────────────────────────────────────────────────
  const [campaignIds, setCampaignIds] = useState<string[]>(
    fixedCampaignId ? [fixedCampaignId] : [],
  );
  const [intents, setIntents] = useState<string[]>(() => {
    const fromQuery = params.get('intent');
    return fromQuery ? [fromQuery] : [];
  });
  const [sentiments, setSentiments] = useState<Sentiment[]>([]);
  const [durationRange, setDurationRange] = useState<[number, number]>(DURATION_DOMAIN);
  const [phoneSearchInput, setPhoneSearchInput] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [range, setRange] = useState<DateRange>({ preset: '30d' });
  const [failureFilter, setFailureFilter] = useState<FailureReason | null>(
    params.get('failure') as FailureReason | null,
  );

  // Strip query params from the URL after applying.
  useEffect(() => {
    if (params.has('intent') || params.has('failure')) {
      params.delete('intent');
      params.delete('failure');
      setParams(params, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phone search debounce
  useEffect(() => {
    const t = setTimeout(() => setPhoneSearch(phoneSearchInput.trim()), 200);
    return () => clearTimeout(t);
  }, [phoneSearchInput]);

  // Pagination — reset whenever filters change.
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [
    campaignIds, intents, sentiments, durationRange,
    phoneSearch, range, failureFilter,
  ]);

  // ── Data state ─────────────────────────────────────────────────────
  const [allCampaigns, setAllCampaigns] = useState<Campaign[] | null>(null);
  const [agents, setAgents] = useState<VoiceAgent[] | null>(null);
  const [serverCalls, setServerCalls] = useState<CallSummary[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const retry = () => setReloadTick((t) => t + 1);

  // Load campaigns + agents once per workspace (or when refresh forced).
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
  }, [activeWorkspace, reloadTick, refreshKey]);

  // Re-fetch calls whenever server-filterable state changes.
  const { fromIso, toIso } = useMemo(() => rangeBounds(range, MOCK_NOW), [range]);

  useEffect(() => {
    if (!activeWorkspace) return;
    let cancelled = false;
    setServerCalls(null);
    setError(null);
    getCalls(activeWorkspace.id, {
      campaignId: campaignIds.length ? campaignIds : undefined,
      from: fromIso,
      to: toIso,
      limit: 50_000,
    })
      .then(({ items }) => {
        if (cancelled) return;
        setServerCalls(items);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err);
      });
    return () => { cancelled = true; };
  }, [activeWorkspace, campaignIds, fromIso, toIso, reloadTick, refreshKey]);

  // ── Derived ────────────────────────────────────────────────────────
  // Apply local filters (intent / sentiment / duration / phone / failure).
  const calls = useMemo(() => {
    if (!serverCalls) return null;
    return serverCalls.filter((c) => {
      if (intents.length > 0 && (!c.primaryIntent || !intents.includes(c.primaryIntent))) return false;
      if (sentiments.length > 0 && (!c.sentiment || !sentiments.includes(c.sentiment))) return false;
      if (c.duration < durationRange[0]) return false;
      if (durationRange[1] < DURATION_DOMAIN[1] && c.duration > durationRange[1]) return false;
      if (phoneSearch) {
        const digits = phoneSearch.replace(/\D/g, '');
        if (digits && !c.phoneNumber.includes(digits)) return false;
      }
      if (failureFilter && c.failureReason !== failureFilter) return false;
      return true;
    });
  }, [serverCalls, intents, sentiments, durationRange, phoneSearch, failureFilter]);

  // Performance overview is computed across the FULL filtered set
  // (initiated + answered + failed all matter for funnel rates).
  const metrics: AggregateMetrics | null = useMemo(
    () => calls ? aggregate(calls) : null,
    [calls],
  );
  const series = useMemo(
    () => calls ? dailySeries(calls, fromIso, toIso) : null,
    [calls, fromIso, toIso],
  );
  // Conversation insights only make sense for ANSWERED calls.
  const answered = useMemo(
    () => calls ? calls.filter((c) => c.status === 'answered') : null,
    [calls],
  );
  const ans = useMemo(() => answered ? aggregate(answered) : null, [answered]);
  const intentItems = useMemo(() => answered ? intentDistribution(answered) : [], [answered]);
  const sentimentMix: SentimentMix | null = useMemo(
    () => answered ? sentimentDistribution(answered) : null,
    [answered],
  );
  const durBuckets = useMemo(() => answered ? durationHistogram(answered) : [], [answered]);
  const topIntent = intentItems[0];

  // Campaigns currently in scope — drives Goal banner, KPI base counts.
  const inScopeCampaigns = useMemo(() => {
    if (!allCampaigns) return [];
    if (campaignIds.length === 0) return allCampaigns;
    return allCampaigns.filter((c) => campaignIds.includes(c.id));
  }, [allCampaigns, campaignIds]);

  const baseUploaded = useMemo(
    () => inScopeCampaigns.reduce((s, c) => s + c.metrics.baseUploaded, 0),
    [inScopeCampaigns],
  );

  // Intent options surfaced from the current data (with the canonical
  // vocabulary added in case a value isn't in the slice).
  const intentOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const c of serverCalls ?? []) if (c.primaryIntent) seen.add(c.primaryIntent);
    const fixed = [
      'loan_inquiry','emi_status','repayment_intent','payment_promise',
      'kyc_pending','application_status','callback_request','document_request',
      'balance_inquiry','renewal_inquiry','complaint','dispute_charge',
      'financial_hardship','wrong_number','agent_handoff_request',
    ];
    const final = new Set<string>([...fixed, ...seen]);
    return [...final].map((i) => ({ value: i, label: intentLabel(i) }));
  }, [serverCalls]);

  // ── Drawer ─────────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(callId ?? null);
  useEffect(() => {
    if (callId !== undefined) setSelectedId(callId);
  }, [callId]);

  const selectedCall = useMemo(() => {
    if (!selectedId || !serverCalls) return null;
    return serverCalls.find((c) => c.id === selectedId) ?? null;
  }, [selectedId, serverCalls]);

  function openCall(id: string) {
    setSelectedId(id);
  }
  function closeCall() {
    setSelectedId(null);
    if (callId) navigate('/analytics', { replace: true });
  }

  // ── Filter helpers ─────────────────────────────────────────────────
  const filtersActive =
    (!fixedCampaignId && campaignIds.length > 0) ||
    intents.length > 0 ||
    sentiments.length > 0 ||
    durationRange[0] !== DURATION_DOMAIN[0] ||
    durationRange[1] !== DURATION_DOMAIN[1] ||
    phoneSearchInput.length > 0 ||
    range.preset !== '30d' ||
    failureFilter !== null;

  function clearAll() {
    if (!fixedCampaignId) setCampaignIds([]);
    setIntents([]);
    setSentiments([]);
    setDurationRange(DURATION_DOMAIN);
    setPhoneSearchInput('');
    setRange({ preset: '30d' });
    setFailureFilter(null);
  }

  // ── Render ─────────────────────────────────────────────────────────
  if (!activeWorkspace) return null;

  const tableRows = calls ?? [];
  const tableTotal = tableRows.length;
  const pageRows = tableRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const sMixPctBar = sentimentMix && sentimentMix.total > 0
    ? [
        { tone: 'positive' as const, w: (sentimentMix.positive / sentimentMix.total) * 100 },
        { tone: 'neutral'  as const, w: (sentimentMix.neutral  / sentimentMix.total) * 100 },
        { tone: 'negative' as const, w: (sentimentMix.negative / sentimentMix.total) * 100 },
      ]
    : null;

  return (
    <>
      <PageHeader
        title={headerTitle ?? 'Analytics'}
        subtitle={
          headerSubtitle ??
          'Calling performance and conversation insights, in one place.'
        }
        actions={headerActions}
      />

      {preludeContent}

      {/* TOP FILTER BAR — page-level scope (campaign + time). */}
      <div className="sticky top-0 z-20 -mx-8 px-8 py-3 bg-bg/80 backdrop-blur border-b border-border-subtle mb-6">
        <div className="flex flex-wrap items-center gap-2">
          {!fixedCampaignId && (
            <MultiSelect
              options={(allCampaigns ?? []).map((c) => ({ value: c.id, label: c.name, hint: c.status }))}
              value={campaignIds}
              onChange={setCampaignIds}
              allLabel="All campaigns"
              noun="campaigns"
              menuMinWidth={300}
            />
          )}
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

        <ActiveChips
          campaignIds={campaignIds}
          campaigns={allCampaigns ?? []}
          failureFilter={failureFilter}
          fixedCampaignId={fixedCampaignId}
          onRemoveCampaign={(id) => setCampaignIds(campaignIds.filter((x) => x !== id))}
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

      {/* SECTION 1 — PERFORMANCE OVERVIEW */}
      <SectionHeading
        title="Performance overview"
        description="What happened to the calls — base, dial-out, and connect funnel."
      />

      <PerformanceKpis
        metrics={metrics}
        baseUploaded={baseUploaded}
        workspace={activeWorkspace}
      />

      <div className="mb-10">
        <TrendChart data={series ?? []} loading={series === null} />
      </div>

      {/* SECTION 2 — CONVERSATION INSIGHTS */}
      <SectionHeading
        title="Conversation insights"
        description="What customers said on answered calls — intents, sentiment, and call shape."
      />

      <ConversationKpis
        ans={ans}
        topIntent={topIntent}
        sMixPctBar={sMixPctBar}
        workspace={activeWorkspace}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-10">
        <IntentBars
          items={intentItems}
          loading={answered === null}
          onSelect={(i) => setIntents([i])}
        />
        <SentimentDonut
          mix={sentimentMix ?? { positive: 0, neutral: 0, negative: 0, total: 0 }}
          loading={answered === null}
        />
        <DurationHistogram
          buckets={durBuckets}
          loading={answered === null}
        />
      </div>

      {/* SECTION 3 — CALLS TABLE */}
      <SectionHeading
        title="Calls"
        description="Every call in scope. Click a row for the transcript and recording."
      />

      <CallsSection
        loading={calls === null}
        rows={pageRows}
        total={tableTotal}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        onRowClick={(c) => openCall(c.id)}
        phoneSearchInput={phoneSearchInput}
        onPhoneSearchChange={setPhoneSearchInput}
        intents={intents}
        onIntentsChange={setIntents}
        intentOptions={intentOptions}
        sentiments={sentiments}
        onSentimentsChange={setSentiments}
        durationRange={durationRange}
        onDurationChange={setDurationRange}
        workspace={activeWorkspace}
      />

      {/* DRAWER */}
      <CallDetailDrawer
        workspace={activeWorkspace}
        call={selectedCall}
        agentName={
          selectedCall ? (agents ?? []).find((a) => a.id === selectedCall.voiceAgentId)?.name : undefined
        }
        campaignName={
          selectedCall ? (allCampaigns ?? []).find((c) => c.id === selectedCall.campaignId)?.name : undefined
        }
        onClose={closeCall}
      />
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// Section heading
// ────────────────────────────────────────────────────────────────────
function SectionHeading({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex items-start gap-3', className)}>
      <span
        aria-hidden
        className="mt-1 h-5 w-1 rounded-full bg-gradient-to-b from-brand-500 to-blue-500"
      />
      <div>
        <h2 className="text-base font-semibold text-text-primary tracking-tight">{title}</h2>
        {description && (
          <p className="text-xs text-text-tertiary mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Performance KPI strip — 5 tiles
// ────────────────────────────────────────────────────────────────────
function PerformanceKpis({
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
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
      <KpiTile
        loading={loading}
        label="Total Base"
        icon={<Users size={14} />}
        tone="neutral"
        value={formatNumber(baseUploaded, workspace)}
        breakdown="contacts uploaded"
      />
      <KpiTile
        loading={loading}
        label="Initiated"
        icon={<PhoneOutgoing size={14} />}
        tone="brand"
        value={metrics ? formatNumber(metrics.initiated, workspace) : '—'}
        breakdown={baseUploaded > 0 ? `${formatPercent(initiatedShare, 1)} of base` : undefined}
      />
      <KpiTile
        loading={loading}
        label="Connected"
        icon={<PhoneCall size={14} />}
        tone="info"
        value={metrics ? formatNumber(metrics.connected, workspace) : '—'}
        breakdown={metrics ? `${formatPercent(metrics.connectedRate, 1)} connect rate` : undefined}
      />
      <KpiTile
        loading={loading}
        label="Answered"
        icon={<PhoneIncoming size={14} />}
        tone="success"
        value={metrics ? formatNumber(metrics.answered, workspace) : '—'}
        breakdown={metrics ? `${formatPercent(metrics.answeredRate, 1)} answer rate` : undefined}
      />
      <KpiTile
        loading={loading}
        label="Failed"
        icon={<PhoneOff size={14} />}
        tone="danger"
        value={metrics ? formatNumber(metrics.failed, workspace) : '—'}
        breakdown={metrics ? `${formatPercent(metrics.failureRate, 1)} fail rate` : undefined}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Conversation KPI strip — 4 tiles
// ────────────────────────────────────────────────────────────────────
function ConversationKpis({
  ans,
  topIntent,
  sMixPctBar,
  workspace,
}: {
  ans: AggregateMetrics | null;
  topIntent?: { intent: string; count: number; share: number };
  sMixPctBar: { tone: 'positive' | 'neutral' | 'negative'; w: number }[] | null;
  workspace: Workspace;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <KpiTile
        loading={ans === null}
        label="Calls Answered"
        icon={<PhoneIncoming size={14} />}
        tone="brand"
        value={ans ? formatNumber(ans.answered, workspace) : '—'}
        breakdown="answered in scope"
      />
      <KpiTile
        loading={ans === null}
        label="Avg Call Duration"
        icon={<Clock size={14} />}
        tone="info"
        value={ans ? formatDuration(ans.avgDuration) : '—'}
        breakdown="across answered"
      />
      <KpiTile
        loading={!topIntent && ans === null}
        label="Top Intent"
        icon={<TrendingUp size={14} />}
        tone="brand"
        value={topIntent ? intentLabel(topIntent.intent) : '—'}
        breakdown={topIntent
          ? `${formatNumber(topIntent.count, workspace)} · ${formatPercent(topIntent.share, 1)}`
          : undefined}
      />
      <Card padding="md" className="relative overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
            Sentiment Mix
          </div>
          <span className="h-7 w-7 rounded-md bg-success-50 text-success-700 flex items-center justify-center">
            <Smile size={14} />
          </span>
        </div>
        {sMixPctBar ? (
          <>
            <div className="mt-3 mb-2 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              {sMixPctBar.map((s) => (
                <span
                  key={s.tone}
                  className={cn(
                    'h-full',
                    s.tone === 'positive' ? 'bg-success-500' :
                    s.tone === 'neutral'  ? 'bg-slate-400'  :
                                            'bg-danger-500',
                  )}
                  style={{ width: `${s.w}%` }}
                />
              ))}
            </div>
            <div className="flex items-center justify-between text-xs tabular text-text-tertiary">
              <span><span className="text-success-700 font-semibold">{Math.round(sMixPctBar[0].w)}%</span> pos</span>
              <span><span className="text-text-secondary font-semibold">{Math.round(sMixPctBar[1].w)}%</span> neu</span>
              <span><span className="text-danger-700 font-semibold">{Math.round(sMixPctBar[2].w)}%</span> neg</span>
            </div>
          </>
        ) : (
          <div className="mt-3 text-sm text-text-tertiary">No data</div>
        )}
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Calls table section
// ────────────────────────────────────────────────────────────────────
function CallsSection({
  loading,
  rows,
  total,
  page,
  pageSize,
  onPageChange,
  onRowClick,
  workspace,
  phoneSearchInput,
  onPhoneSearchChange,
  intents,
  onIntentsChange,
  intentOptions,
  sentiments,
  onSentimentsChange,
  durationRange,
  onDurationChange,
}: {
  loading: boolean;
  rows: CallSummary[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onRowClick: (call: CallSummary) => void;
  workspace: Workspace;
  phoneSearchInput: string;
  onPhoneSearchChange: (v: string) => void;
  intents: string[];
  onIntentsChange: (v: string[]) => void;
  intentOptions: { value: string; label: string }[];
  sentiments: Sentiment[];
  onSentimentsChange: (v: Sentiment[]) => void;
  durationRange: [number, number];
  onDurationChange: (r: [number, number]) => void;
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  const cols: TableColumn<CallSummary>[] = [
    {
      key: 'time',
      header: 'Time',
      cell: (c) => (
        <div className="text-sm">
          <div className="text-text-primary tabular">{formatTime(c.initiatedAt, workspace)}</div>
          <div className="text-xs text-text-tertiary">{formatDate(c.initiatedAt, workspace)}</div>
        </div>
      ),
      sort: (a, b) => (a.initiatedAt < b.initiatedAt ? -1 : 1),
      width: 130,
    },
    {
      key: 'phone',
      header: 'Phone',
      cell: (c) => <span className="font-mono text-xs tabular">{formatPhone(c.phoneNumber)}</span>,
      width: 170,
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (c) => <span className="text-sm truncate">{c.customerName ?? '—'}</span>,
      width: 160,
    },
    {
      key: 'duration',
      header: 'Duration',
      align: 'right',
      cell: (c) => c.status === 'in_progress'
        ? <AwaitingPill compact />
        : <span className="tabular">{formatDuration(c.duration)}</span>,
      sort: (a, b) => a.duration - b.duration,
      width: 90,
    },
    {
      key: 'intent',
      header: 'Intent',
      cell: (c) => {
        if (c.status === 'in_progress') return <AwaitingPill />;
        if (c.primaryIntent) return <Badge tone="brand">{intentLabel(c.primaryIntent)}</Badge>;
        return <span className="text-text-tertiary text-xs">—</span>;
      },
      width: 160,
    },
    {
      key: 'sentiment',
      header: 'Sentiment',
      cell: (c) => {
        if (c.status === 'in_progress') return <AwaitingPill />;
        if (c.sentiment) return <SentimentChip s={c.sentiment} />;
        return <span className="text-text-tertiary text-xs">—</span>;
      },
      width: 110,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (c) => <CallStatusBadge status={c.status} />,
      width: 110,
    },
    {
      key: 'chevron',
      header: '',
      align: 'right',
      cell: (c) => (
        <div className="inline-flex items-center gap-2 text-text-tertiary group-hover:text-brand-700 transition-colors">
          {c.hasRecording && (
            <Play
              size={12}
              className="opacity-70 group-hover:opacity-100"
              aria-label="Has recording"
            />
          )}
          <ChevronRight
            size={16}
            className="transition-transform duration-150 group-hover:translate-x-0.5"
          />
        </div>
      ),
      width: 56,
    },
  ];

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="w-full sm:w-64">
          <Input
            placeholder="Search by phone number..."
            leftIcon={<Search size={14} />}
            value={phoneSearchInput}
            onChange={(e) => onPhoneSearchChange(e.target.value)}
          />
        </div>
        <MultiSelect
          options={intentOptions}
          value={intents}
          onChange={onIntentsChange}
          allLabel="All intents"
          noun="intents"
          menuMinWidth={240}
        />
        <MultiSelect
          options={[
            { value: 'positive', label: 'Positive' },
            { value: 'neutral',  label: 'Neutral'  },
            { value: 'negative', label: 'Negative' },
          ]}
          value={sentiments}
          onChange={(v) => onSentimentsChange(v as Sentiment[])}
          allLabel="All sentiments"
          noun="sentiments"
          searchable={false}
        />
        <DurationSelect value={durationRange} onChange={onDurationChange} />

        <span className="ml-auto text-xs text-text-tertiary tabular shrink-0">
          {loading
            ? 'Loading…'
            : `Showing ${start.toLocaleString('en-IN')}–${end.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')} calls`}
        </span>
      </div>
      <Table
        columns={cols}
        rows={rows}
        rowKey={(r) => r.id}
        defaultSort={{ key: 'time', dir: 'desc' }}
        onRowClick={onRowClick}
        emptyText={loading ? 'Loading calls…' : 'No calls match your filters.'}
      />
      <div className="mt-4">
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onChange={onPageChange}
        />
      </div>
    </section>
  );
}

function SentimentChip({ s }: { s: Sentiment }) {
  const tone = s === 'positive' ? 'success' : s === 'negative' ? 'danger' : 'neutral';
  return <Badge tone={tone}>{s.charAt(0).toUpperCase() + s.slice(1)}</Badge>;
}

/** Compact placeholder used in cells while a call is still in progress
 *  and analytics fields haven't been computed yet. */
function AwaitingPill({ compact }: { compact?: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full',
      'border border-dashed border-border-medium',
      'text-text-tertiary italic',
      compact ? 'text-[11px] px-2 h-5 tabular' : 'text-xs px-2.5 h-6',
    )}>
      <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
      Awaiting
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────
// Active filter chips
// ────────────────────────────────────────────────────────────────────
function ActiveChips({
  campaignIds,
  campaigns,
  failureFilter,
  fixedCampaignId,
  onRemoveCampaign,
  onRemoveFailure,
}: {
  campaignIds: string[];
  campaigns: Campaign[];
  failureFilter: FailureReason | null;
  fixedCampaignId?: string;
  onRemoveCampaign: (id: string) => void;
  onRemoveFailure: () => void;
}) {
  const items: { key: string; label: string; remove: () => void }[] = [];
  if (!fixedCampaignId) {
    for (const id of campaignIds) {
      const c = campaigns.find((x) => x.id === id);
      if (c) items.push({ key: `c:${id}`, label: c.name, remove: () => onRemoveCampaign(id) });
    }
  }
  if (failureFilter) {
    items.push({ key: `f`, label: `Failure: ${failureReasonLabel(failureFilter)}`, remove: onRemoveFailure });
  }
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {items.map((it) => <FilterChip key={it.key} label={it.label} onRemove={it.remove} />)}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Duration filter — bucket dropdown that mirrors the MultiSelect trigger
// styling so the filter row stays visually uniform.
// ────────────────────────────────────────────────────────────────────
function DurationSelect({
  value,
  onChange,
}: {
  value: [number, number];
  onChange: (next: [number, number]) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const current = bucketFromRange(value);
  const isDefault = current.value === 'any';

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'h-9 inline-flex items-center justify-between gap-2 rounded-md border bg-surface pl-3 pr-2 text-sm',
          'transition-colors min-w-[180px]',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
          open ? 'border-blue-500' : 'border-border-medium hover:border-border-strong',
        )}
      >
        <span className={cn('truncate', isDefault ? 'text-text-tertiary' : 'text-text-primary font-medium')}>
          {isDefault ? 'Any duration' : `Duration: ${current.label}`}
        </span>
        <ChevronDownIcon open={open} />
      </button>

      {open && (
        <div
          className="absolute z-30 mt-1 rounded-md border border-border-subtle bg-surface shadow-xl overflow-hidden"
          style={{ minWidth: 200 }}
        >
          <ul className="py-1">
            {DURATION_BUCKETS.map((b) => {
              const sel = b.value === current.value;
              return (
                <li key={b.value}>
                  <button
                    type="button"
                    onClick={() => { onChange(b.range); setOpen(false); }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left',
                      'hover:bg-slate-50 transition-colors',
                      sel && 'bg-brand-50/40 text-brand-700 font-medium',
                    )}
                  >
                    <span className="flex-1 truncate">{b.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('shrink-0 text-text-tertiary transition-transform', open && 'rotate-180')}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
