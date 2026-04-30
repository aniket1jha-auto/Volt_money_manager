import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { Search, Play, FileText } from 'lucide-react';
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
import { ErrorState } from '@/components/ui/ErrorState';
import { MultiSelect, FilterChip } from '@/components/ui/MultiSelect';
import {
  DateRangeFilter,
  rangeBounds,
  type DateRange,
} from '@/components/ui/DateRangeFilter';
import { RangeSlider } from '@/components/ui/RangeSlider';
import { Pagination } from '@/components/ui/Pagination';
import { Table, type TableColumn } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { CallStatusBadge } from '@/components/features/StatusBadge';
import {
  IntentBars,
  SentimentDonut,
  DurationHistogram,
} from '@/components/features/DistributionCharts';
import { CallDetailDrawer } from '@/components/features/CallDetailDrawer';
import {
  aggregate,
  intentDistribution,
  sentimentDistribution,
  durationHistogram,
  type SentimentMix,
} from '@/lib/analytics';
import {
  formatNumber,
  formatPercent,
  formatDuration,
  formatPhone,
  formatTime,
  formatDate,
} from '@/lib/format';
import { intentLabel, failureReasonLabel } from '@/lib/labels';
import { cn } from '@/lib/cn';

const MOCK_NOW = new Date('2026-04-30T11:00:00.000Z');
const PAGE_SIZE = 50;
const DURATION_DOMAIN: [number, number] = [0, 600]; // 10 min cap

type Sentiment = 'positive' | 'neutral' | 'negative';

export default function AgentAnalytics() {
  const { activeWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const { callId } = useParams<{ callId?: string }>();
  const [params, setParams] = useSearchParams();

  // ── Filter state ───────────────────────────────────────────────────
  const [campaignIds, setCampaignIds] = useState<string[]>([]);
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const [intents, setIntents] = useState<string[]>(() => {
    const fromQuery = params.get('intent');
    return fromQuery ? [fromQuery] : [];
  });
  const [sentiments, setSentiments] = useState<Sentiment[]>([]);
  const [durationRange, setDurationRange] = useState<[number, number]>(DURATION_DOMAIN);
  const [phoneSearch, setPhoneSearch] = useState('');
  const [phoneSearchInput, setPhoneSearchInput] = useState('');
  const [range, setRange] = useState<DateRange>({ preset: '30d' });
  const [failureFilter, setFailureFilter] = useState<FailureReason | null>(
    params.get('failure') as FailureReason | null,
  );

  // Clear preloaded query params from URL after applying.
  useEffect(() => {
    if (params.has('intent') || params.has('failure')) {
      params.delete('intent');
      params.delete('failure');
      setParams(params, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pagination
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [campaignIds, agentIds, intents, sentiments, durationRange, phoneSearch, range, failureFilter]);

  // Phone search debounce
  useEffect(() => {
    const t = setTimeout(() => setPhoneSearch(phoneSearchInput.trim()), 200);
    return () => clearTimeout(t);
  }, [phoneSearchInput]);

  // ── Reference data ─────────────────────────────────────────────────
  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([]);
  const [allAgents, setAllAgents] = useState<VoiceAgent[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const retry = () => setReloadTick((t) => t + 1);

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
        setAllAgents(a);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err);
      });
    return () => { cancelled = true; };
  }, [activeWorkspace, reloadTick]);

  // ── Fetch calls (server-side filters: workspace + campaign + agent + range) ──
  const { fromIso, toIso } = useMemo(() => rangeBounds(range, MOCK_NOW), [range]);
  const [serverCalls, setServerCalls] = useState<CallSummary[] | null>(null);

  useEffect(() => {
    if (!activeWorkspace) return;
    let cancelled = false;
    setServerCalls(null);
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
        setServerCalls(items);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err);
      });
    return () => { cancelled = true; };
  }, [activeWorkspace, campaignIds, agentIds, fromIso, toIso, reloadTick]);

  // Apply local filters (intent / sentiment / duration / phone / failure)
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

  // For Agent Analytics, the detail charts/KPIs focus on answered calls.
  const answered = useMemo(() => {
    if (!calls) return null;
    return calls.filter((c) => c.status === 'answered');
  }, [calls]);

  // ── Aggregations ───────────────────────────────────────────────────
  const ans = useMemo(() => answered ? aggregate(answered) : null, [answered]);
  const intentItems = useMemo(() => answered ? intentDistribution(answered) : [], [answered]);
  const sentimentMix: SentimentMix | null = useMemo(
    () => answered ? sentimentDistribution(answered) : null,
    [answered],
  );
  const durBuckets = useMemo(() => answered ? durationHistogram(answered) : [], [answered]);

  const topIntent = intentItems[0];

  // Intent options for the multi-select (derived from currently visible answered calls' available intents)
  const intentOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const c of serverCalls ?? []) if (c.primaryIntent) seen.add(c.primaryIntent);
    const fixed = ['loan_inquiry','emi_status','repayment_intent','payment_promise','kyc_pending','application_status','callback_request','document_request','balance_inquiry','renewal_inquiry','complaint','dispute_charge','financial_hardship','wrong_number','agent_handoff_request'];
    const final = new Set<string>([...fixed, ...seen]);
    return [...final].map((i) => ({ value: i, label: intentLabel(i) }));
  }, [serverCalls]);

  // ── Pagination over the table (full call list, not just answered) ──
  const tableRows = calls ?? [];
  const total = tableRows.length;
  const pageRows = tableRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Drawer state — selected call summary ───────────────────────────
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
    // keep URL clean (don't push every click into history)
  }
  function closeCall() {
    setSelectedId(null);
    if (callId) navigate('/analytics/agents', { replace: true });
  }

  // ── Filter helpers ─────────────────────────────────────────────────
  const filtersActive =
    campaignIds.length > 0 ||
    agentIds.length > 0 ||
    intents.length > 0 ||
    sentiments.length > 0 ||
    durationRange[0] !== DURATION_DOMAIN[0] ||
    durationRange[1] !== DURATION_DOMAIN[1] ||
    phoneSearchInput.length > 0 ||
    range.preset !== '30d' ||
    failureFilter !== null;

  function clearAll() {
    setCampaignIds([]);
    setAgentIds([]);
    setIntents([]);
    setSentiments([]);
    setDurationRange(DURATION_DOMAIN);
    setPhoneSearchInput('');
    setRange({ preset: '30d' });
    setFailureFilter(null);
  }

  if (!activeWorkspace) return null;

  // Sentiment summary as a horizontal bar string
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
        title="Agent Analytics"
        subtitle="Deep-dive on answered calls — intents, sentiment, transcripts."
      />

      {/* FILTER BAR */}
      <div className="sticky top-0 z-20 -mx-8 px-8 py-3 bg-bg/80 backdrop-blur border-b border-border-subtle mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <MultiSelect
            options={allCampaigns.map((c) => ({ value: c.id, label: c.name, hint: c.status }))}
            value={campaignIds}
            onChange={setCampaignIds}
            allLabel="All campaigns"
            noun="campaigns"
            menuMinWidth={300}
          />
          <MultiSelect
            options={allAgents.map((a) => ({ value: a.id, label: a.name, hint: a.voice }))}
            value={agentIds}
            onChange={setAgentIds}
            allLabel="All agents"
            noun="agents"
          />
          <MultiSelect
            options={intentOptions}
            value={intents}
            onChange={setIntents}
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
            onChange={(v) => setSentiments(v as Sentiment[])}
            allLabel="All sentiments"
            noun="sentiments"
            searchable={false}
          />
          <DateRangeFilter value={range} onChange={setRange} now={MOCK_NOW} />

          <div className="w-48">
            <Input
              placeholder="Search phone..."
              leftIcon={<Search size={14} />}
              value={phoneSearchInput}
              onChange={(e) => setPhoneSearchInput(e.target.value)}
            />
          </div>

          {filtersActive && (
            <button
              onClick={clearAll}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 ml-1"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Duration slider — its own row to give it width */}
        <div className="mt-3 flex items-center gap-3 max-w-md">
          <span className="text-[11px] uppercase tracking-wide text-text-tertiary font-semibold w-20 shrink-0">
            Duration
          </span>
          <div className="flex-1">
            <RangeSlider
              domain={DURATION_DOMAIN}
              value={durationRange}
              onChange={setDurationRange}
              step={15}
              formatValue={(n) => n >= DURATION_DOMAIN[1] ? '10m+' : formatDuration(n)}
            />
          </div>
        </div>

        {/* Active chips */}
        <ActiveChips
          campaignIds={campaignIds}
          campaigns={allCampaigns}
          agentIds={agentIds}
          agents={allAgents}
          intents={intents}
          sentiments={sentiments}
          phoneSearch={phoneSearch}
          failureFilter={failureFilter}
          onRemoveCampaign={(id) => setCampaignIds(campaignIds.filter((x) => x !== id))}
          onRemoveAgent={(id) => setAgentIds(agentIds.filter((x) => x !== id))}
          onRemoveIntent={(i) => setIntents(intents.filter((x) => x !== i))}
          onRemoveSentiment={(s) => setSentiments(sentiments.filter((x) => x !== s))}
          onRemovePhone={() => setPhoneSearchInput('')}
          onRemoveFailure={() => setFailureFilter(null)}
        />
      </div>

      {error && (
        <ErrorState
          title="We couldn't load calls"
          description="The mock API returned an error. Adjusting filters or retrying should clear it."
          onRetry={retry}
          className="mb-6"
        />
      )}

      {/* KPI STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <KpiTile
          loading={ans === null}
          label="Calls Answered"
          value={ans ? formatNumber(ans.answered, activeWorkspace) : '—'}
          breakdown="answered in scope"
        />
        <KpiTile
          loading={ans === null}
          label="Avg Call Duration"
          value={ans ? formatDuration(ans.avgDuration) : '—'}
          breakdown="across answered"
        />
        <KpiTile
          loading={!topIntent && ans === null}
          label="Top Intent"
          value={topIntent ? intentLabel(topIntent.intent) : '—'}
          breakdown={topIntent
            ? `${formatNumber(topIntent.count, activeWorkspace)} · ${formatPercent(topIntent.share, 1)}`
            : undefined}
        />
        <Card padding="md">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
            Sentiment Mix
          </div>
          {sMixPctBar ? (
            <>
              <div className="mt-2 mb-2 flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
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

      {/* DISTRIBUTION CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
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

      {/* CALL RECORDS TABLE */}
      <CallsSection
        loading={calls === null}
        rows={pageRows}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        onRowClick={(c) => openCall(c.id)}
        workspace={activeWorkspace}
        agents={allAgents}
      />

      {/* DRAWER */}
      <CallDetailDrawer
        workspace={activeWorkspace}
        call={selectedCall}
        agentName={
          selectedCall ? allAgents.find((a) => a.id === selectedCall.voiceAgentId)?.name : undefined
        }
        campaignName={
          selectedCall ? allCampaigns.find((c) => c.id === selectedCall.campaignId)?.name : undefined
        }
        onClose={closeCall}
      />
    </>
  );
}

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
  agents,
}: {
  loading: boolean;
  rows: CallSummary[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onRowClick: (call: CallSummary) => void;
  workspace: Workspace;
  agents: VoiceAgent[];
}) {
  const agentById = new Map(agents.map((a) => [a.id, a]));
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
      key: 'agent',
      header: 'Agent',
      cell: (c) => (
        <span className="text-sm text-text-secondary truncate">
          {agentById.get(c.voiceAgentId)?.name ?? '—'}
        </span>
      ),
      width: 180,
    },
    {
      key: 'duration',
      header: 'Duration',
      align: 'right',
      cell: (c) => <span className="tabular">{formatDuration(c.duration)}</span>,
      sort: (a, b) => a.duration - b.duration,
      width: 90,
    },
    {
      key: 'intent',
      header: 'Intent',
      cell: (c) => c.primaryIntent ? <Badge tone="brand">{intentLabel(c.primaryIntent)}</Badge> : <span className="text-text-tertiary text-xs">—</span>,
      width: 160,
    },
    {
      key: 'sentiment',
      header: 'Sentiment',
      cell: (c) => c.sentiment ? <SentimentChip s={c.sentiment} /> : <span className="text-text-tertiary text-xs">—</span>,
      width: 110,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (c) => <CallStatusBadge status={c.status} />,
      width: 110,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (c) => (
        <div className="inline-flex items-center gap-1">
          {c.hasRecording && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRowClick(c); }}
              aria-label="Play recording"
              className="h-7 w-7 rounded text-text-tertiary hover:bg-slate-100 hover:text-text-primary transition-colors inline-flex items-center justify-center"
            >
              <Play size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRowClick(c); }}
            aria-label="View detail"
            className="h-7 w-7 rounded text-text-tertiary hover:bg-slate-100 hover:text-text-primary transition-colors inline-flex items-center justify-center"
          >
            <FileText size={13} />
          </button>
        </div>
      ),
      width: 80,
    },
  ];

  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-base font-semibold text-text-primary">Calls</h3>
        <span className="text-xs text-text-tertiary tabular">
          {loading ? 'Loading…' : `Showing ${start.toLocaleString('en-IN')}–${end.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')} calls`}
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

// ────────────────────────────────────────────────────────────────────
function ActiveChips({
  campaignIds,
  campaigns,
  agentIds,
  agents,
  intents,
  sentiments,
  phoneSearch,
  failureFilter,
  onRemoveCampaign,
  onRemoveAgent,
  onRemoveIntent,
  onRemoveSentiment,
  onRemovePhone,
  onRemoveFailure,
}: {
  campaignIds: string[];
  campaigns: Campaign[];
  agentIds: string[];
  agents: VoiceAgent[];
  intents: string[];
  sentiments: Sentiment[];
  phoneSearch: string;
  failureFilter: FailureReason | null;
  onRemoveCampaign: (id: string) => void;
  onRemoveAgent: (id: string) => void;
  onRemoveIntent: (i: string) => void;
  onRemoveSentiment: (s: Sentiment) => void;
  onRemovePhone: () => void;
  onRemoveFailure: () => void;
}) {
  const items: { key: string; label: string; remove: () => void }[] = [];
  for (const id of campaignIds) {
    const c = campaigns.find((x) => x.id === id);
    if (c) items.push({ key: `c:${id}`, label: c.name, remove: () => onRemoveCampaign(id) });
  }
  for (const id of agentIds) {
    const a = agents.find((x) => x.id === id);
    if (a) items.push({ key: `a:${id}`, label: a.name, remove: () => onRemoveAgent(id) });
  }
  for (const i of intents) {
    items.push({ key: `i:${i}`, label: `Intent: ${intentLabel(i)}`, remove: () => onRemoveIntent(i) });
  }
  for (const s of sentiments) {
    items.push({ key: `s:${s}`, label: `${s[0].toUpperCase()}${s.slice(1)} sentiment`, remove: () => onRemoveSentiment(s) });
  }
  if (phoneSearch) {
    items.push({ key: `p`, label: `Phone: ${phoneSearch}`, remove: onRemovePhone });
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
