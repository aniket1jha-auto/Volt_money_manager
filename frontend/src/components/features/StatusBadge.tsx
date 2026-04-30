import { Badge } from '@/components/ui/Badge';
import type { CampaignStatus, CallStatus } from '@/types';

const CAMPAIGN_TONE: Record<CampaignStatus, Parameters<typeof Badge>[0]['tone']> = {
  active:    'success',
  scheduled: 'info',
  completed: 'neutral',
  paused:    'warning',
  draft:     'neutral',
};

const CAMPAIGN_LABEL: Record<CampaignStatus, string> = {
  active:    'Active',
  scheduled: 'Scheduled',
  completed: 'Completed',
  paused:    'Paused',
  draft:     'Draft',
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <Badge tone={CAMPAIGN_TONE[status]} dot={status === 'active' || status === 'scheduled'}>
      {CAMPAIGN_LABEL[status]}
    </Badge>
  );
}

const CALL_TONE: Record<CallStatus, Parameters<typeof Badge>[0]['tone']> = {
  initiated: 'neutral',
  ringing:   'info',
  connected: 'info',
  answered:  'success',
  completed: 'success',
  failed:    'danger',
  abandoned: 'warning',
};

const CALL_LABEL: Record<CallStatus, string> = {
  initiated: 'Initiated',
  ringing:   'Ringing',
  connected: 'Connected',
  answered:  'Answered',
  completed: 'Completed',
  failed:    'Failed',
  abandoned: 'Abandoned',
};

export function CallStatusBadge({ status }: { status: CallStatus }) {
  return <Badge tone={CALL_TONE[status]}>{CALL_LABEL[status]}</Badge>;
}
