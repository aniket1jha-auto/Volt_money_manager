import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Pause, Play, Rocket } from 'lucide-react';
import type { Campaign } from '@/types';
import { getCampaign, setCampaignStatus } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/components/ui/Toast';
import Analytics from './Analytics';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { NewRunDrawer } from '@/components/features/NewRunDrawer';

/*
 * Campaign Detail = the unified Analytics view filtered to a single
 * campaign, plus a "New run" action in the page header that opens the
 * upload drawer. Performance metrics, conversation insights, and the
 * calls table all live on the same page (under one filter bar) — the
 * operator sees everything that happened in this campaign without
 * page-hopping.
 */
export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const { activeWorkspace } = useWorkspace();
  const toast = useToast();
  const [campaign, setCampaign] = useState<Campaign | null | undefined>(undefined);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  // Bumped after a successful run-start to force the analytics page to refetch.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!activeWorkspace || !id) return;
    let cancelled = false;
    getCampaign(activeWorkspace.id, id).then((c) => {
      if (cancelled) return;
      setCampaign(c);
    });
    return () => { cancelled = true; };
  }, [activeWorkspace, id, refreshKey]);

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
  if (!activeWorkspace) return null;

  async function toggleStatus() {
    if (!activeWorkspace || !campaign) return;
    const next = campaign.status === 'active' ? 'inactive' : 'active';
    setStatusBusy(true);
    try {
      const updated = await setCampaignStatus(activeWorkspace.id, campaign.id, next);
      setCampaign(updated);
      toast.success(
        next === 'inactive' ? 'Campaign paused' : 'Campaign activated',
        next === 'inactive'
          ? `'${updated.name}' will not place new calls until reactivated.`
          : `'${updated.name}' is live again.`,
      );
    } finally {
      setStatusBusy(false);
    }
  }

  const headerActions = (
    <>
      <Button
        variant="secondary"
        leftIcon={campaign.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
        onClick={toggleStatus}
        disabled={statusBusy}
      >
        {campaign.status === 'active' ? 'Mark inactive' : 'Mark active'}
      </Button>
      <Button leftIcon={<Rocket size={16} />} onClick={() => setDrawerOpen(true)}>
        New run
      </Button>
    </>
  );

  return (
    <>
      <Analytics
        fixedCampaignId={campaign.id}
        headerTitle={campaign.name}
        headerSubtitle=""
        headerActions={headerActions}
        refreshKey={refreshKey}
      />

      <NewRunDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        campaign={campaign}
        workspace={activeWorkspace}
        onStarted={(updated) => {
          setCampaign(updated);
          setRefreshKey((k) => k + 1);
        }}
      />
    </>
  );
}
