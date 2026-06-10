/*
 * Volt Voice — mock API client.
 *
 * Reads from /src/mocks/data/*.json and provides typed query functions for
 * the UI. Every function is workspace-scoped: callers pass the active
 * workspace id, the client filters the dataset to that tenant.
 *
 * Phase 1: pure mock, no network. All functions are async with simulated
 * latency to mirror the real API shape and to let the UI render loading
 * states.
 *
 * Backend swap (later): each function below names the implied endpoint.
 * Replace the body with `fetch(path, { headers: { 'X-Workspace-Id': ws } })`
 * and the UI keeps working.
 */
import workspacesData from '@/mocks/data/workspaces.json';
import usersData from '@/mocks/data/users.json';
import voiceAgentsData from '@/mocks/data/voice-agents.json';
import campaignsData from '@/mocks/data/campaigns.json';
import callSummariesData from '@/mocks/data/calls.json';
import type {
  Workspace,
  User,
  VoiceAgent,
  Campaign,
  CampaignRun,
  CampaignStatus,
  CallingWindow,
  FeedbackIntent,
  RetryPolicy,
  CallSummary,
  CallDetail,
  FailureReason,
  AudienceFile,
  AudienceFileStatus,
} from '@/types';
import { DEFAULT_RETRY_POLICY, DEFAULT_CALLING_WINDOW } from '@/types';

// ────────────────────────────────────────────────────────────────────
// Latency + fault simulator.
//
// Every async function below returns a `delay()`-wrapped value to mirror
// real API latency and let the UI render loading states. When the URL
// query string contains `?simulateError=1` (or localStorage flag
// `volt.simulateError = "1"`), every request rejects with a fake error.
// This is how Phase 6 demonstrates error states without breaking the
// happy-path demo.
// ────────────────────────────────────────────────────────────────────
const LATENCY_MS = { fast: 80, medium: 220, slow: 450 } as const;
type Speed = keyof typeof LATENCY_MS;

function shouldFault(): boolean {
  if (typeof window === 'undefined') return false;
  const sp = new URLSearchParams(window.location.search);
  if (sp.get('simulateError') === '1') return true;
  try {
    return localStorage.getItem('volt.simulateError') === '1';
  } catch {
    return false;
  }
}

class MockApiError extends Error {
  constructor(message = 'Mock API failure (simulateError flag is on)') {
    super(message);
    this.name = 'MockApiError';
  }
}

function delay<T>(value: T, speed: Speed = 'medium'): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldFault()) {
        reject(new MockApiError());
        return;
      }
      resolve(value);
    }, LATENCY_MS[speed]);
  });
}

// ────────────────────────────────────────────────────────────────────
// Static seed slices — typed views over the JSON.
// ────────────────────────────────────────────────────────────────────
// JSON imports widen string-literal types — cast through unknown.
const WORKSPACES = workspacesData as unknown as Workspace[];
const USERS = usersData as unknown as User[];
const VOICE_AGENTS = voiceAgentsData as unknown as VoiceAgent[];
const CAMPAIGNS = campaignsData as unknown as Campaign[];
const CALL_SUMMARIES = callSummariesData as unknown as CallSummary[];

// Lazy detail map — loaded only when the drawer first opens.
let _detailsCache: Record<string, CallDetail> | null = null;
async function loadDetails(): Promise<Record<string, CallDetail>> {
  if (_detailsCache) return _detailsCache;
  const mod = await import('@/mocks/data/call-details.json');
  _detailsCache = mod.default as unknown as Record<string, CallDetail>;
  return _detailsCache;
}

// ────────────────────────────────────────────────────────────────────
// Auth / workspace
// ────────────────────────────────────────────────────────────────────

/** Implies: GET /workspaces */
export async function getWorkspaces(userId: string): Promise<Workspace[]> {
  const user = USERS.find((u) => u.id === userId);
  if (!user) return delay([]);
  return delay(WORKSPACES.filter((w) => user.workspaces.includes(w.id)));
}

/** Implies: GET /workspaces/:id */
export async function getWorkspace(id: string): Promise<Workspace | null> {
  return delay(WORKSPACES.find((w) => w.id === id) ?? null, 'fast');
}

/** Implies: GET /auth/me */
export async function getCurrentUser(id: string): Promise<User | null> {
  return delay(USERS.find((u) => u.id === id) ?? null, 'fast');
}

// ────────────────────────────────────────────────────────────────────
// Voice agents
// ────────────────────────────────────────────────────────────────────

/** Implies: GET /voice-agents */
export async function getVoiceAgents(workspaceId: string): Promise<VoiceAgent[]> {
  return delay(VOICE_AGENTS.filter((a) => a.workspaceId === workspaceId), 'fast');
}

// ────────────────────────────────────────────────────────────────────
// Campaigns
// ────────────────────────────────────────────────────────────────────

export interface CampaignFilters {
  status?: CampaignStatus | CampaignStatus[];
  voiceAgentId?: string;
  search?: string;
  sort?: 'recent' | 'name' | 'status';
  limit?: number;
  offset?: number;
}

/** Implies: GET /campaigns?status=&voiceAgentId=&search=&sort= */
export async function getCampaigns(
  workspaceId: string,
  filters: CampaignFilters = {},
): Promise<{ items: Campaign[]; total: number }> {
  let rows = CAMPAIGNS.filter((c) => c.workspaceId === workspaceId);

  if (filters.status) {
    const set = new Set(Array.isArray(filters.status) ? filters.status : [filters.status]);
    rows = rows.filter((c) => set.has(c.status));
  }
  if (filters.voiceAgentId) {
    rows = rows.filter((c) => c.voiceAgentId === filters.voiceAgentId);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    rows = rows.filter((c) => c.name.toLowerCase().includes(q));
  }

  // Sort
  const sort = filters.sort ?? 'recent';
  rows = [...rows].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'status') return a.status.localeCompare(b.status);
    const aT = mostRecentActivity(a);
    const bT = mostRecentActivity(b);
    return bT - aT;
  });

  const total = rows.length;
  if (filters.offset != null) rows = rows.slice(filters.offset);
  if (filters.limit != null) rows = rows.slice(0, filters.limit);
  return delay({ items: rows, total });
}

function mostRecentActivity(c: Campaign): number {
  const candidates = [c.completedAt, c.startedAt, c.createdAt, c.schedule.startsAt].filter(
    Boolean,
  ) as string[];
  return Math.max(...candidates.map((s) => new Date(s).getTime()), 0);
}

/** Implies: GET /campaigns/:id */
export async function getCampaign(workspaceId: string, id: string): Promise<Campaign | null> {
  return delay(
    CAMPAIGNS.find((c) => c.workspaceId === workspaceId && c.id === id) ?? null,
    'fast',
  );
}

/** Implies: POST /campaigns */
export interface CampaignDraft {
  name: string;
  voiceAgentId: string;
  contactList: Campaign['contactList'];
  schedule: Campaign['schedule'];
  retryPolicy?: RetryPolicy;
  callingWindow?: CallingWindow;
  description?: string;
  feedbackIntents?: FeedbackIntent[];
}
export async function createCampaign(
  workspaceId: string,
  draft: CampaignDraft,
): Promise<Campaign> {
  const id = `camp_${String(CAMPAIGNS.length + 1).padStart(3, '0')}`;
  const created: Campaign = {
    id,
    workspaceId,
    name: draft.name,
    voiceAgentId: draft.voiceAgentId,
    // Newly created campaigns are always active. Operator can flip to
    // inactive from the campaign detail page once they want to stop.
    status: 'active',
    contactList: draft.contactList,
    schedule: draft.schedule,
    retryPolicy: draft.retryPolicy ?? DEFAULT_RETRY_POLICY,
    callingWindow: draft.callingWindow ?? DEFAULT_CALLING_WINDOW,
    description: draft.description,
    feedbackIntents: draft.feedbackIntents,
    metrics: {
      baseUploaded: draft.contactList.validRows,
      callsInitiated: 0,
      callsConnected: 0,
      callsAnswered: 0,
      callsFailed: 0,
      avgCallDuration: 0,
      totalCost: 0,
    },
    createdBy: 'user_001',
    createdAt: new Date().toISOString(),
    startedAt: draft.schedule.type === 'immediate' ? new Date().toISOString() : undefined,
  };
  // Ephemeral — appended to the runtime list. Reload re-reads JSON.
  CAMPAIGNS.unshift(created);
  return delay(created, 'slow');
}

/** Implies: POST /campaigns/:id/runs
 *
 * Start a new run on an existing campaign — typically triggered when
 * the operator wants to dial a fresh contact list under the same
 * campaign so analytics roll up together. The run lands on
 * `campaign.runs[]`, and the campaign's `metrics.baseUploaded` grows
 * by the run's `validRows`. The campaign's top-level `contactList` is
 * updated to point at the most recent run's list so existing consumers
 * (cards, list views) keep showing the latest cut. The submitted
 * `retryPolicy` becomes the campaign's default for subsequent runs and
 * is snapshot-saved on the run record.
 */
export interface RunDraft {
  contactList: Campaign['contactList'];
  schedule: Campaign['schedule'];
  retryPolicy: RetryPolicy;
}
export async function startCampaignRun(
  workspaceId: string,
  campaignId: string,
  draft: RunDraft,
): Promise<{ campaign: Campaign; run: CampaignRun }> {
  const camp = CAMPAIGNS.find((c) => c.workspaceId === workspaceId && c.id === campaignId);
  if (!camp) {
    return delay(
      Promise.reject(new Error(`Campaign ${campaignId} not found`)) as never,
      'fast',
    );
  }
  const run: CampaignRun = {
    id: `run_${Date.now().toString(36)}`,
    campaignId,
    contactList: draft.contactList,
    schedule: draft.schedule,
    retryPolicy: draft.retryPolicy,
    // Snapshot the campaign's current calling window so the run record
    // reflects what was in force at start time.
    callingWindow: camp.callingWindow ?? DEFAULT_CALLING_WINDOW,
    startedBy: 'user_001',
    startedAt: new Date().toISOString(),
    status: draft.schedule.type === 'scheduled' ? 'queued' : 'running',
  };
  camp.runs = camp.runs ? [...camp.runs, run] : [run];
  camp.contactList = draft.contactList;
  camp.retryPolicy = draft.retryPolicy;
  camp.metrics = {
    ...camp.metrics,
    baseUploaded: camp.metrics.baseUploaded + draft.contactList.validRows,
  };
  // Starting a fresh run on an inactive campaign automatically flips it
  // back to active — calls are about to flow.
  if (draft.schedule.type === 'immediate' && camp.status === 'inactive') {
    camp.status = 'active';
    if (!camp.startedAt) camp.startedAt = new Date().toISOString();
    camp.completedAt = undefined;
  }
  return delay({ campaign: camp, run }, 'slow');
}

// ────────────────────────────────────────────────────────────────────
// Calls
// ────────────────────────────────────────────────────────────────────

export interface CallFilters {
  campaignId?: string | string[];
  voiceAgentId?: string | string[];
  status?: CallSummary['status'] | CallSummary['status'][];
  failureReason?: FailureReason | FailureReason[];
  intent?: string | string[];
  sentiment?: ('positive' | 'neutral' | 'negative')[] | ('positive' | 'neutral' | 'negative');
  minDuration?: number;
  maxDuration?: number;
  phoneSearch?: string;
  from?: string; // ISO
  to?: string;   // ISO
  sort?: 'recent' | 'duration' | 'cost';
  limit?: number;
  offset?: number;
}

/** Implies: GET /calls?...filters */
export async function getCalls(
  workspaceId: string,
  filters: CallFilters = {},
): Promise<{ items: CallSummary[]; total: number }> {
  let rows = CALL_SUMMARIES.filter((c) => c.workspaceId === workspaceId);

  rows = applyCallFilters(rows, filters);

  // Sort
  const sort = filters.sort ?? 'recent';
  rows = [...rows].sort((a, b) => {
    if (sort === 'duration') return b.duration - a.duration;
    if (sort === 'cost') return b.cost - a.cost;
    return a.initiatedAt < b.initiatedAt ? 1 : -1;
  });

  const total = rows.length;
  if (filters.offset != null) rows = rows.slice(filters.offset);
  if (filters.limit != null) rows = rows.slice(0, filters.limit);
  return delay({ items: rows, total });
}

function applyCallFilters(rows: CallSummary[], filters: CallFilters): CallSummary[] {
  const inSet = <T>(value: T | undefined, filter: T | T[] | undefined): boolean => {
    if (filter == null) return true;
    if (value == null) return false;
    if (Array.isArray(filter)) return filter.includes(value);
    return filter === value;
  };
  return rows.filter((c) => {
    if (!inSet(c.campaignId, filters.campaignId)) return false;
    if (!inSet(c.voiceAgentId, filters.voiceAgentId)) return false;
    if (!inSet(c.status, filters.status)) return false;
    if (filters.failureReason && !inSet(c.failureReason, filters.failureReason)) return false;
    if (filters.intent && !inSet(c.primaryIntent, filters.intent)) return false;
    if (filters.sentiment && !inSet(c.sentiment, filters.sentiment)) return false;
    if (filters.minDuration != null && c.duration < filters.minDuration) return false;
    if (filters.maxDuration != null && c.duration > filters.maxDuration) return false;
    if (filters.phoneSearch && !c.phoneNumber.includes(filters.phoneSearch.replace(/\s/g, ''))) {
      return false;
    }
    if (filters.from && c.initiatedAt < filters.from) return false;
    if (filters.to && c.initiatedAt > filters.to) return false;
    return true;
  });
}

/** Implies: GET /calls/:id */
export async function getCallSummary(
  workspaceId: string,
  id: string,
): Promise<CallSummary | null> {
  return delay(
    CALL_SUMMARIES.find((c) => c.workspaceId === workspaceId && c.id === id) ?? null,
    'fast',
  );
}

/** Implies: GET /calls/:id/detail */
export async function getCallDetail(workspaceId: string, id: string): Promise<CallDetail | null> {
  // Tenant boundary enforced via summary lookup first.
  const summary = CALL_SUMMARIES.find((c) => c.workspaceId === workspaceId && c.id === id);
  if (!summary) return delay(null, 'fast');
  const map = await loadDetails();
  return delay(map[id] ?? null, 'medium');
}

// ────────────────────────────────────────────────────────────────────
// Aggregates — Dashboard, KPI cards, charts
// ────────────────────────────────────────────────────────────────────

export interface DashboardKpis {
  activeCampaigns: number;
  scheduledCampaigns: number;
  callsToday: number;
  callsYesterday: number;
  connectedRate7d: number;
  connectedRatePrev7d: number;
  avgDuration7d: number;
  avgDurationPrev7d: number;
}

/** Implies: GET /dashboard/kpis */
export async function getDashboardKpis(workspaceId: string): Promise<DashboardKpis> {
  const camps = CAMPAIGNS.filter((c) => c.workspaceId === workspaceId);
  const calls = CALL_SUMMARIES.filter((c) => c.workspaceId === workspaceId);

  const now = new Date('2026-04-30T11:00:00.000Z'); // matches generator anchor
  const startOfToday = new Date(now); startOfToday.setUTCHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);
  const startOf7d = new Date(startOfToday.getTime() - 6 * 86_400_000);
  const startOfPrev7d = new Date(startOfToday.getTime() - 13 * 86_400_000);

  const within = (call: CallSummary, from: Date, to: Date) => {
    const t = new Date(call.initiatedAt).getTime();
    return t >= from.getTime() && t < to.getTime();
  };

  const today = calls.filter((c) => within(c, startOfToday, new Date(startOfToday.getTime() + 86_400_000)));
  const yesterday = calls.filter((c) => within(c, startOfYesterday, startOfToday));

  const last7 = calls.filter((c) => within(c, startOf7d, new Date(startOfToday.getTime() + 86_400_000)));
  const prev7 = calls.filter((c) => within(c, startOfPrev7d, startOf7d));

  const rate = (xs: CallSummary[]) => {
    if (xs.length === 0) return 0;
    const connected = xs.filter((c) => c.status !== 'failed').length;
    return connected / xs.length;
  };
  const avgDur = (xs: CallSummary[]) => {
    const ans = xs.filter((c) => c.duration > 0);
    if (ans.length === 0) return 0;
    return Math.round(ans.reduce((s, c) => s + c.duration, 0) / ans.length);
  };

  return delay({
    activeCampaigns: camps.filter((c) => c.status === 'active').length,
    scheduledCampaigns: camps.filter((c) => c.status === 'inactive').length,
    callsToday: today.length,
    callsYesterday: yesterday.length,
    connectedRate7d: rate(last7),
    connectedRatePrev7d: rate(prev7),
    avgDuration7d: avgDur(last7),
    avgDurationPrev7d: avgDur(prev7),
  });
}

/** Implies: GET /dashboard/intents-today */
export async function getIntentsToday(workspaceId: string): Promise<{ intent: string; count: number }[]> {
  const now = new Date('2026-04-30T11:00:00.000Z');
  const start = new Date(now); start.setUTCHours(0, 0, 0, 0);
  const calls = CALL_SUMMARIES.filter(
    (c) => c.workspaceId === workspaceId && c.primaryIntent && new Date(c.initiatedAt) >= start,
  );
  const counts = new Map<string, number>();
  for (const c of calls) counts.set(c.primaryIntent!, (counts.get(c.primaryIntent!) ?? 0) + 1);
  const items = [...counts.entries()]
    .map(([intent, count]) => ({ intent, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  return delay(items);
}

/** Implies: GET /dashboard/failures-today */
export async function getFailureReasonsToday(
  workspaceId: string,
): Promise<{ reason: FailureReason; count: number }[]> {
  const now = new Date('2026-04-30T11:00:00.000Z');
  const start = new Date(now); start.setUTCHours(0, 0, 0, 0);
  const calls = CALL_SUMMARIES.filter(
    (c) =>
      c.workspaceId === workspaceId &&
      c.status === 'failed' &&
      c.failureReason &&
      new Date(c.initiatedAt) >= start,
  );
  const counts = new Map<FailureReason, number>();
  for (const c of calls) counts.set(c.failureReason!, (counts.get(c.failureReason!) ?? 0) + 1);
  return delay(
    [...counts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3),
  );
}

// ────────────────────────────────────────────────────────────────────
// Audience files
// ────────────────────────────────────────────────────────────────────

/** Synthetic "fresh upload, awaiting validation" rows. These are not
 *  tied to a real campaign — just demonstrate the pending state on the
 *  Audience List page. They sit at the top of the list. */
const PENDING_AUDIENCE_FILES_BASE = [
  {
    fileName: 'kyc_pending_q2_sweep_v3.csv',
    totalRows: 1240,
    sizeBytes: 187_300,
    daysAgo: 0,
    hours: 0,
  },
  {
    fileName: 'top_up_offers_may_2026.csv',
    totalRows: 2104,
    sizeBytes: 314_800,
    daysAgo: 0,
    hours: 1,
  },
  {
    fileName: 'application_followup_batch_07.csv',
    totalRows: 580,
    sizeBytes: 84_600,
    daysAgo: 0,
    hours: 3,
  },
  {
    fileName: 'recovery_30dpd_freshlist.csv',
    totalRows: 412,
    sizeBytes: 61_900,
    daysAgo: 1,
    hours: 0,
  },
];

const FAILED_AUDIENCE_FILE_BASE = {
  fileName: 'cross_sell_april_v2.csv',
  totalRows: 0,
  sizeBytes: 12_400,
  daysAgo: 1,
  hours: 4,
};

/** Implies: GET /audiences */
export async function getAudienceFiles(workspaceId: string): Promise<AudienceFile[]> {
  const camps = CAMPAIGNS.filter((c) => c.workspaceId === workspaceId);
  const out: AudienceFile[] = [];

  // Pending (synthetic, not yet attached to a campaign).
  const now = new Date('2026-04-30T11:00:00.000Z').getTime();
  for (const f of PENDING_AUDIENCE_FILES_BASE) {
    const uploadedAt = new Date(now - (f.daysAgo * 86_400_000 + f.hours * 3_600_000)).toISOString();
    out.push({
      id: `aud_pending_${f.fileName.replace(/\W+/g, '_')}`,
      workspaceId,
      fileName: f.fileName,
      uploadedAt,
      uploadedBy: 'user_001',
      source: 'new_campaign',
      totalRows: f.totalRows,
      validRows: 0,
      invalidRows: 0,
      duplicates: 0,
      status: 'pending' as AudienceFileStatus,
      fileSizeBytes: f.sizeBytes,
      downloadUrl: `/mocks/audiences/${f.fileName}`,
    });
  }

  // One failed file for demo.
  const failedAt = new Date(now - (FAILED_AUDIENCE_FILE_BASE.daysAgo * 86_400_000 + FAILED_AUDIENCE_FILE_BASE.hours * 3_600_000)).toISOString();
  out.push({
    id: `aud_failed_${FAILED_AUDIENCE_FILE_BASE.fileName.replace(/\W+/g, '_')}`,
    workspaceId,
    fileName: FAILED_AUDIENCE_FILE_BASE.fileName,
    uploadedAt: failedAt,
    uploadedBy: 'user_001',
    source: 'new_campaign',
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
    duplicates: 0,
    status: 'failed',
    fileSizeBytes: FAILED_AUDIENCE_FILE_BASE.sizeBytes,
    downloadUrl: `/mocks/audiences/${FAILED_AUDIENCE_FILE_BASE.fileName}`,
  });

  // Validated — derived from existing campaigns and their runs.
  for (const c of camps) {
    if (c.contactList.totalRows > 0) {
      out.push({
        id: `aud_${c.id}_initial`,
        workspaceId,
        fileName: c.contactList.fileName,
        uploadedAt: c.contactList.uploadedAt ?? c.createdAt,
        uploadedBy: c.createdBy,
        source: 'new_campaign',
        campaignId: c.id,
        campaignName: c.name,
        totalRows: c.contactList.totalRows,
        validRows: c.contactList.validRows,
        invalidRows: c.contactList.invalidRows,
        duplicates: c.contactList.duplicates,
        status: 'validated',
        // Approx size: rows × ~150 bytes/row
        fileSizeBytes: c.contactList.totalRows * 150,
        downloadUrl: `/mocks/audiences/${c.contactList.fileName}`,
      });
    }
    for (const r of c.runs ?? []) {
      out.push({
        id: `aud_${r.id}`,
        workspaceId,
        fileName: r.contactList.fileName,
        uploadedAt: r.contactList.uploadedAt ?? r.startedAt,
        uploadedBy: r.startedBy,
        source: 'new_run',
        campaignId: c.id,
        campaignName: c.name,
        totalRows: r.contactList.totalRows,
        validRows: r.contactList.validRows,
        invalidRows: r.contactList.invalidRows,
        duplicates: r.contactList.duplicates,
        status: 'validated',
        fileSizeBytes: r.contactList.totalRows * 150,
        downloadUrl: `/mocks/audiences/${r.contactList.fileName}`,
      });
    }
  }

  // Newest first
  out.sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
  return delay(out);
}

// ────────────────────────────────────────────────────────────────────
// Campaign mutations
// ────────────────────────────────────────────────────────────────────

/** Implies: PATCH /campaigns/:id { status }
 *
 * Toggles the operator-facing active/inactive flag. Underlying schedule
 * and run history are untouched — the dialer just stops/resumes flowing
 * calls based on this signal.
 */
export async function setCampaignStatus(
  workspaceId: string,
  campaignId: string,
  status: CampaignStatus,
): Promise<Campaign> {
  const camp = CAMPAIGNS.find((c) => c.workspaceId === workspaceId && c.id === campaignId);
  if (!camp) {
    return delay(
      Promise.reject(new Error(`Campaign ${campaignId} not found`)) as never,
      'fast',
    );
  }
  camp.status = status;
  if (status === 'inactive' && !camp.completedAt) {
    camp.completedAt = new Date().toISOString();
  }
  if (status === 'active' && camp.completedAt) {
    camp.completedAt = undefined;
  }
  return delay(camp, 'fast');
}
