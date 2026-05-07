import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, PhoneCall } from 'lucide-react';
import type { Campaign, CampaignStatus, VoiceAgent } from '@/types';
import { getCampaigns, getVoiceAgents } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';
import { PageHeader } from '@/components/features/PageHeader';
import {
  CampaignCard,
  CampaignCardSkeleton,
} from '@/components/features/CampaignCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Pagination } from '@/components/ui/Pagination';
import { ErrorState } from '@/components/ui/ErrorState';

type StatusFilter = 'all' | CampaignStatus;
type SortKey = 'recent' | 'name' | 'status';

const PAGE_SIZE = 12;

const STATUS_SEGMENTS: { value: StatusFilter; label: string }[] = [
  { value: 'all',      label: 'All' },
  { value: 'active',   label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export default function Campaigns() {
  const { activeWorkspace } = useWorkspace();
  const navigate = useNavigate();

  const [status, setStatus] = useState<StatusFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [page, setPage] = useState(1);

  const [allCampaigns, setAllCampaigns] = useState<Campaign[] | null>(null);
  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Load every campaign once; filter/sort/paginate locally for snappy UX.
  useEffect(() => {
    if (!activeWorkspace) return;
    let cancelled = false;
    setAllCampaigns(null);
    setError(null);
    Promise.all([
      getCampaigns(activeWorkspace.id),
      getVoiceAgents(activeWorkspace.id),
    ])
      .then(([{ items }, ag]) => {
        if (cancelled) return;
        setAllCampaigns(items);
        setAgents(ag);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err);
      });
    return () => { cancelled = true; };
  }, [activeWorkspace, reloadTick]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset page when filter inputs change
  useEffect(() => { setPage(1); }, [status, search, sort]);

  const filtered = useMemo(() => {
    if (!allCampaigns) return null;
    let rows = allCampaigns;
    if (status !== 'all') rows = rows.filter((c) => c.status === status);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((c) => c.name.toLowerCase().includes(q));
    }
    rows = [...rows].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'status') return a.status.localeCompare(b.status);
      const at = mostRecent(a);
      const bt = mostRecent(b);
      return bt - at;
    });
    return rows;
  }, [allCampaigns, status, search, sort]);

  const counts = useMemo(() => {
    if (!allCampaigns) return null;
    const c: Record<StatusFilter, number> = {
      all: allCampaigns.length,
      active: 0, inactive: 0,
    };
    for (const x of allCampaigns) {
      if (x.status === 'active' || x.status === 'inactive') c[x.status] += 1;
    }
    return c;
  }, [allCampaigns]);

  const total = filtered?.length ?? 0;
  const pageRows = filtered?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) ?? [];
  const agentById = new Map(agents.map((a) => [a.id, a]));

  if (!activeWorkspace) return null;
  const loading = allCampaigns === null;

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle="All voice campaigns in this workspace."
        actions={
          <Button leftIcon={<Plus size={16} />} onClick={() => navigate('/campaigns/new')}>
            New campaign
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <SegmentedControl<StatusFilter>
          value={status}
          onChange={setStatus}
          segments={STATUS_SEGMENTS.map((s) => ({
            ...s,
            count: counts ? counts[s.value] : undefined,
          }))}
        />

        <div className="flex-1 min-w-[240px] max-w-sm">
          <Input
            placeholder="Search campaigns..."
            leftIcon={<Search size={16} />}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-text-tertiary">Sort by</label>
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="w-36"
          >
            <option value="recent">Recent</option>
            <option value="name">Name</option>
            <option value="status">Status</option>
          </Select>
        </div>
      </div>

      {error ? (
        <ErrorState
          title="Could not load campaigns"
          onRetry={() => setReloadTick((t) => t + 1)}
        />
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => <CampaignCardSkeleton key={i} />)}
        </div>
      ) : total === 0 ? (
        <EmptyState search={search} status={status} onClear={() => { setStatus('all'); setSearchInput(''); }} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pageRows.map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                agent={agentById.get(c.voiceAgentId)}
                workspace={activeWorkspace}
              />
            ))}
          </div>
          <div className="mt-8">
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onChange={setPage}
            />
          </div>
        </>
      )}
    </>
  );
}

function mostRecent(c: Campaign): number {
  const candidates = [c.completedAt, c.startedAt, c.createdAt, c.schedule.startsAt].filter(
    Boolean,
  ) as string[];
  return Math.max(...candidates.map((s) => new Date(s).getTime()), 0);
}

function EmptyState({
  search,
  status,
  onClear,
}: {
  search: string;
  status: StatusFilter;
  onClear: () => void;
}) {
  const navigate = useNavigate();
  const filtersActive = search || status !== 'all';

  if (filtersActive) {
    return (
      <Card padding="lg" className="flex flex-col items-center text-center py-16">
        <h3 className="text-lg font-semibold text-text-primary mb-1">No campaigns match your filters</h3>
        <p className="text-sm text-text-tertiary mb-5">Try clearing them to see all campaigns.</p>
        <Button variant="secondary" onClick={onClear}>Clear filters</Button>
      </Card>
    );
  }

  return (
    <Card padding="lg" className="flex flex-col items-center text-center py-20">
      <div className="h-14 w-14 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center mb-4">
        <PhoneCall size={24} />
      </div>
      <h3 className="font-serif italic text-3xl text-text-primary mb-2">No campaigns yet</h3>
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
