import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import type { Campaign, VoiceAgent } from '@/types';
import { getCampaign, getVoiceAgents } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';
import CampaignAnalytics from './CampaignAnalytics';
import { Skeleton } from '@/components/ui/Skeleton';

/*
 * Campaign Detail = Campaign Analytics page filtered to a single campaign.
 * The brief explicitly defines it this way (§4 routing: /campaigns/:id).
 * We render CampaignAnalytics with fixedCampaignId — the campaign filter
 * dropdown is hidden and the comparison table is suppressed.
 */
export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const { activeWorkspace } = useWorkspace();
  const [campaign, setCampaign] = useState<Campaign | null | undefined>(undefined); // undefined = loading
  const [agent, setAgent] = useState<VoiceAgent | null>(null);

  useEffect(() => {
    if (!activeWorkspace || !id) return;
    let cancelled = false;
    getCampaign(activeWorkspace.id, id).then(async (c) => {
      if (cancelled) return;
      setCampaign(c);
      if (!c) return;
      const agents = await getVoiceAgents(activeWorkspace.id);
      if (cancelled) return;
      setAgent(agents.find((a) => a.id === c.voiceAgentId) ?? null);
    });
    return () => { cancelled = true; };
  }, [activeWorkspace, id]);

  if (!id) return <Navigate to="/campaigns" replace />;
  if (campaign === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (campaign === null) return <Navigate to="/campaigns" replace />;

  const subtitle = agent
    ? `${agent.name} · ${campaign.metrics.baseUploaded.toLocaleString('en-IN')} contacts`
    : `${campaign.metrics.baseUploaded.toLocaleString('en-IN')} contacts`;

  return (
    <CampaignAnalytics
      fixedCampaignId={campaign.id}
      headerTitle={campaign.name}
      headerSubtitle={subtitle}
    />
  );
}
