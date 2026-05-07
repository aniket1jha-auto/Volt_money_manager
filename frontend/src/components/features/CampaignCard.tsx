import { useNavigate } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import type { Campaign, VoiceAgent, Workspace } from '@/types';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { CampaignStatusBadge } from './StatusBadge';
import { formatNumber, formatDuration, formatRelative, formatPercent } from '@/lib/format';
import { cn } from '@/lib/cn';

interface Props {
  campaign: Campaign;
  agent?: VoiceAgent;
  workspace: Workspace;
  className?: string;
}

export function CampaignCard({ campaign, agent, workspace, className }: Props) {
  const navigate = useNavigate();
  const m = campaign.metrics;

  // Choose the most contextual relative timestamp.
  const relRef =
    campaign.status === 'inactive' ? campaign.completedAt ?? campaign.startedAt ?? campaign.createdAt :
    campaign.status === 'active'   ? campaign.startedAt ?? campaign.schedule.startsAt ?? campaign.createdAt :
                                      campaign.createdAt;

  const relPrefix =
    campaign.status === 'inactive' ? 'paused' :
    campaign.status === 'active'   ? 'started' :
                                      'created';

  const connectedRate = m.callsInitiated > 0 ? m.callsConnected / m.callsInitiated : 0;
  const answeredRate = m.callsConnected > 0 ? m.callsAnswered / m.callsConnected : 0;

  return (
    <Card
      interactive
      padding="md"
      className={cn('flex flex-col gap-4 group', className)}
      onClick={() => navigate(`/campaigns/${campaign.id}`)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-text-primary leading-snug truncate">
            {campaign.name}
          </h3>
          <p className="text-xs text-text-tertiary mt-1 truncate">
            {agent?.name ?? '—'} · {formatNumber(m.baseUploaded, workspace)} contacts
          </p>
        </div>
        <CampaignStatusBadge status={campaign.status} />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-2 pt-1">
        <Metric label="Calls" value={formatNumber(m.callsInitiated, workspace)} />
        <Metric label="Connected" value={m.callsInitiated ? formatPercent(connectedRate, 0) : '—'} />
        <Metric label="Answered" value={m.callsConnected ? formatPercent(answeredRate, 0) : '—'} />
        <Metric label="Avg dur" value={m.avgCallDuration ? formatDuration(m.avgCallDuration) : '—'} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border-subtle pt-3 -mx-1 px-1">
        <span className="text-xs text-text-tertiary">
          {relRef ? `${relPrefix} ${formatRelative(relRef)}` : '—'}
        </span>
        <button
          aria-label="More options"
          className="p-1 rounded text-text-tertiary opacity-0 group-hover:opacity-100 hover:bg-slate-100 hover:text-text-secondary transition-all"
          onClick={(e) => { e.stopPropagation(); /* Phase 6 — actions menu */ }}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-text-tertiary truncate">
        {label}
      </div>
      <div className="text-sm font-semibold text-text-primary tabular truncate">
        {value}
      </div>
    </div>
  );
}

export function CampaignCardSkeleton() {
  return (
    <Card padding="md" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="grid grid-cols-4 gap-2 pt-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-2.5 w-12" />
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>
      <div className="border-t border-border-subtle pt-3">
        <Skeleton className="h-3 w-24" />
      </div>
    </Card>
  );
}
