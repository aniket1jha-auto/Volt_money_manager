import { useEffect, useState, type ReactNode } from 'react';
import {
  X,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  Sparkles,
} from 'lucide-react';
import type { CallSummary, CallDetail, Workspace } from '@/types';
import { Drawer } from '@/components/ui/Drawer';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { CallStatusBadge } from './StatusBadge';
import { AudioPlayer } from './AudioPlayer';
import { TranscriptView } from './TranscriptView';
import { getCallDetail } from '@/lib/api';
import { intentLabel } from '@/lib/labels';
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
  const [detail, setDetail] = useState<CallDetail | null | undefined>(undefined); // undefined = loading
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Reset whenever a new call is opened.
  useEffect(() => {
    if (!call) return;
    setDetail(undefined);
    setCurrentMs(0);
    setPlaying(false);

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

          {/* Summary — LLM-generated, 1–2 sentence recap. Hidden when
              the call has no insights (in-progress / failed). */}
          {detail === undefined ? (
            <SummarySkeleton />
          ) : detail?.insights?.summary ? (
            <div className="rounded-lg border border-border-subtle bg-gradient-to-br from-blue-50/40 to-brand-50/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={13} className="text-brand-700" />
                <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-text-tertiary">
                  Summary
                </h3>
              </div>
              <p className="text-sm text-text-primary leading-relaxed">
                {detail.insights.summary}
              </p>
            </div>
          ) : null}

          {/* Insights — sentiment, primary intent, plus each entry from the
              call's custom_intents map rendered as its own labeled field.
              Hidden when the call has no insights yet (e.g. in_progress /
              failed). */}
          {detail === undefined ? (
            <InsightsSkeleton />
          ) : detail?.insights ? (
            <div className="rounded-lg border border-border-subtle bg-surface p-4 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-text-tertiary">
                Insights
              </h3>

              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <InsightField label="Call sentiment">
                  <SentimentChip sentiment={detail.insights.sentiment} />
                </InsightField>
                <InsightField label="Call intent">
                  <Badge tone="brand">
                    {intentLabel(detail.insights.primaryIntent)}
                  </Badge>
                </InsightField>

                {Object.entries(detail.insights.customIntents ?? {}).map(([key, value]) => (
                  <InsightField key={key} label={humanizeKey(key)}>
                    <Badge tone="info" className="whitespace-normal max-w-full">
                      {value}
                    </Badge>
                  </InsightField>
                ))}
              </div>
            </div>
          ) : null}

          {/* Transcript */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-text-tertiary">
                Transcript
              </h3>
              {detail?.transcript && detail.transcript.length > 0 && (
                <span className="text-[11px] text-text-tertiary tabular">
                  {detail.transcript.length} turns
                </span>
              )}
            </div>
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
          </div>
        </div>
      </div>

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

function SummarySkeleton() {
  return (
    <div className="rounded-lg border border-border-subtle bg-slate-25 p-4">
      <Skeleton className="h-3 w-20 mb-2.5" />
      <Skeleton className="h-3.5 w-full mb-1.5" />
      <Skeleton className="h-3.5 w-4/5" />
    </div>
  );
}

function InsightsSkeleton() {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-4 space-y-4">
      <Skeleton className="h-3 w-16" />
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i}>
            <Skeleton className="h-2.5 w-24 mb-2" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-text-tertiary mb-1.5">{label}</div>
      {children}
    </div>
  );
}

/**
 * Humanizes a snake_case custom-intent key into a display label:
 *   social_media_mention → "Social media mention"
 *   drop_off_reason      → "Drop off reason"
 */
function humanizeKey(key: string): string {
  if (!key) return '';
  const spaced = key.replace(/_+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function SentimentChip({
  sentiment,
}: {
  sentiment: 'positive' | 'neutral' | 'negative';
}) {
  const tone =
    sentiment === 'positive' ? 'success' :
    sentiment === 'negative' ? 'danger' :
                                'neutral';
  const label = sentiment.charAt(0).toUpperCase() + sentiment.slice(1);
  return <Badge tone={tone}>{label}</Badge>;
}


