/*
 * Analytics aggregation helpers — pure functions over CallSummary[].
 * Used by Campaign Analytics, Agent Analytics, and Campaign Detail pages.
 *
 * Each function returns plain JS — no React, no API calls — so the same
 * helpers can be lifted to the backend untouched when the API endpoints
 * are built.
 */
import type {
  CallSummary,
  Campaign,
  FailureReason,
} from '@/types';

export interface AggregateMetrics {
  total: number;
  initiated: number;
  connected: number;
  answered: number;
  failed: number;
  abandoned: number;
  connectedRate: number;     // connected / initiated
  answeredRate: number;      // answered / connected
  failureRate: number;       // failed / initiated
  avgDuration: number;       // seconds, across answered
  totalCost: number;
}

export function aggregate(calls: CallSummary[]): AggregateMetrics {
  const initiated = calls.length;
  const failed = calls.filter((c) => c.status === 'failed').length;
  const abandoned = calls.filter((c) => c.status === 'abandoned').length;
  const connected = initiated - failed;
  const answered = calls.filter((c) => c.status === 'answered').length;
  const totalCost = calls.reduce((s, c) => s + (c.cost ?? 0), 0);
  const ans = calls.filter((c) => c.duration > 0);
  const avgDuration = ans.length === 0 ? 0 : Math.round(ans.reduce((s, c) => s + c.duration, 0) / ans.length);

  return {
    total: initiated,
    initiated,
    connected,
    answered,
    failed,
    abandoned,
    connectedRate: initiated ? connected / initiated : 0,
    answeredRate: connected ? answered / connected : 0,
    failureRate: initiated ? failed / initiated : 0,
    avgDuration,
    totalCost: Math.round(totalCost * 100) / 100,
  };
}

export interface DailyPoint {
  date: string;        // YYYY-MM-DD (local)
  label: string;       // 'Apr 22'
  initiated: number;
  connected: number;
  answered: number;
  failed: number;
}

export function dailySeries(
  calls: CallSummary[],
  fromIso: string,
  toIso: string,
): DailyPoint[] {
  const start = new Date(fromIso);
  start.setHours(0, 0, 0, 0);
  const end = new Date(toIso);
  end.setHours(0, 0, 0, 0);

  const map = new Map<string, DailyPoint>();
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = toDateKey(d);
    map.set(key, {
      date: key,
      label: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      initiated: 0,
      connected: 0,
      answered: 0,
      failed: 0,
    });
  }

  for (const c of calls) {
    const key = toDateKey(new Date(c.initiatedAt));
    const point = map.get(key);
    if (!point) continue;
    point.initiated++;
    if (c.status === 'answered') {
      point.answered++;
      point.connected++;
    } else if (c.status === 'failed') {
      point.failed++;
    } else {
      point.connected++;
    }
  }

  return [...map.values()];
}

const FAILURE_ORDER: FailureReason[] = [
  'busy',
  'not_reachable',
  'invalid_number',
  'dnd',
  'network_error',
  'customer_hung_up',
  'other',
];

export interface FailureBreakdownItem {
  reason: FailureReason;
  count: number;
  share: number;     // 0..1 of total failures
}

export function failureBreakdown(calls: CallSummary[]): {
  total: number;
  items: FailureBreakdownItem[];
} {
  const failures = calls.filter((c) => c.status === 'failed');
  const counts = new Map<FailureReason, number>();
  for (const r of FAILURE_ORDER) counts.set(r, 0);
  for (const f of failures) {
    if (!f.failureReason) continue;
    counts.set(f.failureReason, (counts.get(f.failureReason) ?? 0) + 1);
  }
  const total = failures.length;
  const items = FAILURE_ORDER.map((reason) => {
    const count = counts.get(reason) ?? 0;
    return {
      reason,
      count,
      share: total ? count / total : 0,
    };
  });
  return { total, items };
}

export interface CampaignRow {
  campaign: Campaign;
  metrics: AggregateMetrics;
}

export function perCampaignRows(
  calls: CallSummary[],
  campaigns: Campaign[],
): CampaignRow[] {
  const byId = new Map<string, CallSummary[]>();
  for (const c of calls) {
    const arr = byId.get(c.campaignId);
    if (arr) arr.push(c);
    else byId.set(c.campaignId, [c]);
  }
  return campaigns.map((camp) => ({
    campaign: camp,
    metrics: aggregate(byId.get(camp.id) ?? []),
  }));
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ────────────────────────────────────────────────────────────────────
// Agent Analytics aggregations
// ────────────────────────────────────────────────────────────────────

export interface IntentBucket {
  intent: string;
  count: number;
  share: number;     // 0..1
}

export function intentDistribution(calls: CallSummary[]): IntentBucket[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const c of calls) {
    if (!c.primaryIntent) continue;
    counts.set(c.primaryIntent, (counts.get(c.primaryIntent) ?? 0) + 1);
    total++;
  }
  return [...counts.entries()]
    .map(([intent, count]) => ({ intent, count, share: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count);
}

export interface SentimentMix {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
}

export function sentimentDistribution(calls: CallSummary[]): SentimentMix {
  let p = 0, n = 0, ng = 0, t = 0;
  for (const c of calls) {
    if (!c.sentiment) continue;
    t++;
    if (c.sentiment === 'positive') p++;
    else if (c.sentiment === 'neutral') n++;
    else ng++;
  }
  return { positive: p, neutral: n, negative: ng, total: t };
}

export interface DurationBucket {
  key: string;
  label: string;
  /** lower bound in seconds, inclusive */
  min: number;
  /** upper bound in seconds, exclusive (Infinity for last bucket) */
  max: number;
  count: number;
  share: number;
}

export const DURATION_BUCKETS: Pick<DurationBucket, 'key' | 'label' | 'min' | 'max'>[] = [
  { key: '0_30',  label: '0-30s',    min: 0,   max: 30 },
  { key: '30_60', label: '30s-1m',   min: 30,  max: 60 },
  { key: '1_2',   label: '1-2m',     min: 60,  max: 120 },
  { key: '2_5',   label: '2-5m',     min: 120, max: 300 },
  { key: '5_+',   label: '5m+',      min: 300, max: Infinity },
];

export function durationHistogram(calls: CallSummary[]): DurationBucket[] {
  const buckets: DurationBucket[] = DURATION_BUCKETS.map((b) => ({ ...b, count: 0, share: 0 }));
  let total = 0;
  for (const c of calls) {
    if (!c.duration || c.duration <= 0) continue;
    const b = buckets.find((x) => c.duration >= x.min && c.duration < x.max);
    if (b) {
      b.count++;
      total++;
    }
  }
  for (const b of buckets) b.share = total ? b.count / total : 0;
  return buckets;
}
