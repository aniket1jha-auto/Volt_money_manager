import { useEffect, useState } from 'react';
import {
  X,
  Flag,
  CheckCircle2,
  Download,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
} from 'lucide-react';
import type { CallSummary, CallDetail, Workspace } from '@/types';
import { Drawer } from '@/components/ui/Drawer';
import { Tabs } from '@/components/ui/Tabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CallStatusBadge } from './StatusBadge';
import { AudioPlayer } from './AudioPlayer';
import { TranscriptView } from './TranscriptView';
import { InsightsView } from './InsightsView';
import { useToast } from '@/components/ui/Toast';
import { getCallDetail } from '@/lib/api';
import {
  formatDateTime,
  formatDuration,
  formatPhone,
} from '@/lib/format';

interface CallDetailDrawerProps {
  workspace: Workspace;
  /** Summary of the selected call. Drawer closes when null. */
  call: CallSummary | null;
  agentName?: string;
  campaignName?: string;
  onClose: () => void;
}

export function CallDetailDrawer({
  workspace,
  call,
  agentName,
  campaignName,
  onClose,
}: CallDetailDrawerProps) {
  const open = call !== null;
  const [tab, setTab] = useState<'transcript' | 'insights'>('transcript');
  const [detail, setDetail] = useState<CallDetail | null | undefined>(undefined); // undefined = loading
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const toast = useToast();

  // Reset whenever a new call is opened.
  useEffect(() => {
    if (!call) return;
    setTab('transcript');
    setDetail(undefined);
    setCurrentMs(0);
    setPlaying(false);
    setReviewed(call.reviewed);
    setFlagged(call.flagged);

    let cancelled = false;
    getCallDetail(workspace.id, call.id).then((d) => {
      if (cancelled) return;
      setDetail(d ?? null);
    });
    return () => { cancelled = true; };
  }, [call, workspace.id]);

  if (!call) {
    // Render the empty drawer for the slide-out animation.
    return <Drawer open={false} onClose={onClose} />;
  }

  const durationMs = detail?.recording?.durationMs ?? call.duration * 1000;
  const subtitle = [
    formatDateTime(call.initiatedAt, workspace),
    formatDuration(call.duration),
    campaignName,
  ].filter(Boolean).join(' · ');

  return (
    <Drawer open={open} onClose={onClose} width={620}>
      {/* Header */}
      <header className="px-5 py-4 border-b border-border-subtle flex items-start gap-3 shrink-0">
        <div className="h-10 w-10 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
          {call.status === 'failed' ? <PhoneOff size={18} /> :
           call.status === 'abandoned' ? <PhoneMissed size={18} /> :
           <PhoneIncoming size={18} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold text-text-primary truncate">
              {formatPhone(call.phoneNumber)}
            </h2>
            {call.customerName && (
              <span className="text-text-tertiary text-sm truncate">· {call.customerName}</span>
            )}
            <CallStatusBadge status={call.status} />
          </div>
          <p className="text-xs text-text-tertiary mt-0.5 truncate">
            {subtitle}
            {agentName && <> · <span className="text-text-secondary">{agentName}</span></>}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="p-1.5 -mr-1 rounded text-text-tertiary hover:bg-slate-100 transition-colors shrink-0"
        >
          <X size={18} />
        </button>
      </header>

      {/* Content (scrollable) */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-5 space-y-5">
          {/* Audio player */}
          {detail === undefined ? (
            <Skeleton className="h-24 w-full" />
          ) : detail?.recording || (call.duration && call.duration > 0) ? (
            <AudioPlayer
              durationMs={durationMs}
              url={detail?.recording?.url}
              currentMs={currentMs}
              onSeek={setCurrentMs}
              playing={playing}
              onTogglePlay={() => setPlaying((p) => !p)}
            />
          ) : (
            <div className="text-sm text-text-tertiary rounded-md border border-dashed border-border-subtle bg-slate-25 px-4 py-6 text-center">
              No recording available for this call.
              {call.failureReason && (
                <div className="mt-1 text-xs">
                  Reason: <span className="font-medium">{call.failureReason.replace(/_/g, ' ')}</span>
                </div>
              )}
            </div>
          )}

          {/* Tabs */}
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'transcript', label: 'Transcript', count: detail?.transcript?.length },
              { value: 'insights', label: 'Insights' },
            ]}
          />

          <div className="pt-2">
            {tab === 'transcript' && (
              <>
                {detail === undefined ? (
                  <TranscriptSkeleton />
                ) : detail?.transcript && detail.transcript.length > 0 ? (
                  <TranscriptView
                    turns={detail.transcript}
                    currentMs={currentMs}
                    onSeek={(ms) => {
                      setCurrentMs(ms);
                      if (!playing) setPlaying(true);
                    }}
                  />
                ) : (
                  <p className="text-sm text-text-tertiary py-8 text-center">
                    No transcript available for this call.
                  </p>
                )}
              </>
            )}
            {tab === 'insights' && (
              <>
                {detail === undefined ? (
                  <InsightsSkeleton />
                ) : detail?.insights ? (
                  <InsightsView insights={detail.insights} />
                ) : (
                  <p className="text-sm text-text-tertiary py-8 text-center">
                    No insights available for this call.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="px-5 py-3 border-t border-border-subtle bg-slate-25 flex items-center gap-2 shrink-0">
        <Button
          variant={reviewed ? 'primary' : 'secondary'}
          size="sm"
          leftIcon={<CheckCircle2 size={14} />}
          onClick={() => {
            setReviewed((v) => !v);
            toast.success(reviewed ? 'Marked as not reviewed' : 'Marked as reviewed');
          }}
        >
          {reviewed ? 'Reviewed' : 'Mark reviewed'}
        </Button>
        <Button
          variant={flagged ? 'danger' : 'ghost'}
          size="sm"
          leftIcon={<Flag size={14} />}
          onClick={() => {
            setFlagged((v) => !v);
            toast.push({
              tone: flagged ? 'info' : 'warning',
              title: flagged ? 'Unflagged' : 'Flagged for follow-up',
            });
          }}
        >
          {flagged ? 'Flagged' : 'Flag'}
        </Button>
        <span className="flex-1" />
        {detail?.notes && (
          <Badge tone="info">Has notes</Badge>
        )}
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Download size={14} />}
          onClick={() => toast.success('Export started', `Call ${call.id.slice(-6)}`)}
        >
          Export
        </Button>
      </footer>
    </Drawer>
  );
}

function TranscriptSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

function InsightsSkeleton() {
  return (
    <div className="space-y-5">
      <div>
        <Skeleton className="h-3 w-16 mb-2" />
        <Skeleton className="h-7 w-40" />
      </div>
      <div>
        <Skeleton className="h-3 w-24 mb-2" />
        <Skeleton className="h-24 w-full" />
      </div>
      <div>
        <Skeleton className="h-3 w-24 mb-2" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
}
