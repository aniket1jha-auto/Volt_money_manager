import { Badge } from '@/components/ui/Badge';
import type { CampaignStatus, CallStatus } from '@/types';

const CAMPAIGN_TONE: Record<CampaignStatus, Parameters<typeof Badge>[0]['tone']> = {
  active:   'success',
  inactive: 'neutral',
};

const CAMPAIGN_LABEL: Record<CampaignStatus, string> = {
  active:   'Active',
  inactive: 'Inactive',
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <Badge tone={CAMPAIGN_TONE[status]} dot={status === 'active'}>
      {CAMPAIGN_LABEL[status]}
    </Badge>
  );
}

const CALL_TONE: Record<CallStatus, Parameters<typeof Badge>[0]['tone']> = {
  initiated:   'neutral',
  ringing:     'info',
  connected:   'info',
  in_progress: 'info',
  answered:    'success',
  completed:   'success',
  failed:      'danger',
  abandoned:   'warning',
};

const CALL_LABEL: Record<CallStatus, string> = {
  initiated:   'Initiated',
  ringing:     'Ringing',
  connected:   'Connected',
  in_progress: 'In progress',
  answered:    'Answered',
  completed:   'Completed',
  failed:      'Failed',
  abandoned:   'Abandoned',
};

export function CallStatusBadge({ status }: { status: CallStatus }) {
  if (status === 'in_progress') {
    // Pulsing dot to signal "live, still happening".
    return (
      <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full border border-blue-100 bg-blue-50 text-xs text-blue-700 font-medium whitespace-nowrap">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inset-0 rounded-full bg-blue-500 opacity-60 animate-ping" />
          <span className="relative h-2 w-2 rounded-full bg-blue-500" />
        </span>
        In progress
      </span>
    );
  }
  return <Badge tone={CALL_TONE[status]}>{CALL_LABEL[status]}</Badge>;
}
