/*
 * Volt Voice — shared types.
 * These shapes are the implied API contract for backend handoff.
 * See /docs/data-shapes.md for the canonical reference.
 */

export type Role = 'admin' | 'manager' | 'analyst' | 'viewer';

export interface Workspace {
  id: string;
  name: string;
  logo: string;
  industry: string;
  region: string;
  currency: 'INR' | 'AED' | 'USD';
  timezone: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  workspaces: string[];
}

export interface VoiceAgent {
  id: string;
  workspaceId: string;
  name: string;
  voice: string;
  language: string;
  description: string;
  status: 'active' | 'paused' | 'draft';
  model: string;
  createdAt: string;
}

/**
 * Campaign lifecycle is binary in the UI.
 *   - active   → operator considers this campaign live (calls may be
 *                running now or scheduled for later)
 *   - inactive → operator paused / completed / drafted, no calls flow
 *
 * The schedule object on the campaign still drives WHEN calls go out;
 * status is just "is this campaign currently live for the operator."
 */
export type CampaignStatus = 'active' | 'inactive';

export interface ContactList {
  fileName: string;
  uploadedAt: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicates: number;
  columnMapping: Record<string, string>;
}

export interface CampaignSchedule {
  type: 'immediate' | 'scheduled';
  startsAt?: string;
  timezone: string;
}

export interface CampaignMetrics {
  baseUploaded: number;
  callsInitiated: number;
  callsConnected: number;
  callsAnswered: number;
  callsFailed: number;
  avgCallDuration: number;
  totalCost: number;
}

export type CampaignRunStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'paused'
  | 'failed';

/*
 * Retry policy — when a call doesn't connect cleanly, the dialer can
 * automatically re-attempt later. Reasons map to Plivo `hangup_cause`
 * codes (see PLIVO_CAUSE_CODES below) so the backend can act on the
 * exact telco signal rather than user-facing groupings.
 */
export interface RetryPolicy {
  enabled: boolean;
  /** Number of additional dial attempts on top of the first one. 1..5. */
  maxAttempts: number;
  /** Cooldown between attempts. */
  intervalMinutes: number;
  retryOn: RetryConditions;
}

export interface RetryConditions {
  /**
   * Customer answered but the call was very short. The dialer should
   * retry if `duration < shortAnswerThresholdSec`. Catches cases where
   * the customer hung up immediately, dropped the call, or it was a
   * misdial that the customer cleared.
   */
  shortAnswer: boolean;
  shortAnswerThresholdSec: number;     // default 5
  /** No answer / rang out. Plivo: 3000, 6010. */
  noAnswer: boolean;
  /** Busy or network congestion. Plivo: 3010, 3100, 3090. */
  busy: boolean;
  /** Carrier or network error. Plivo: 3070, 3080, 5000, 6020. */
  carrierError: boolean;
  /** Voicemail / answering machine detected. Plivo: 9100. */
  voicemail: boolean;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  enabled: false,
  maxAttempts: 2,
  intervalMinutes: 60,
  retryOn: {
    shortAnswer: true,
    shortAnswerThresholdSec: 5,
    noAnswer: true,
    busy: true,
    carrierError: true,
    voicemail: false,
  },
};

/*
 * A feedback intent is a post-call outcome the operator wants to track
 * for this campaign. Each entry is captured as:
 *   - name:        short label shown in the UI and surfaced on analytics
 *                  (e.g. "KYC completed on call")
 *   - description: a longer plain-English explanation of what the
 *                  intent means — handed to the backend LLM so it can
 *                  classify each call's outcome against the operator's
 *                  vocabulary instead of a generic one.
 */
export interface FeedbackIntent {
  name: string;
  description: string;
}

/*
 * A campaign starts with one contact list (uploaded at creation) and can
 * accrue more over time as the operator queues additional runs against
 * fresh audiences. Each execution is a `CampaignRun`. The campaign's
 * top-level `contactList` is the most recent run's list (kept for
 * backward compatibility with consumers that just want the latest cut).
 * Aggregate metrics on the campaign sum across all runs.
 */
export interface CampaignRun {
  id: string;                                 // 'run_xxx'
  campaignId: string;
  contactList: ContactList;
  schedule: CampaignSchedule;
  /** Snapshot of the retry policy in force when this run was started. */
  retryPolicy: RetryPolicy;
  startedBy: string;                          // user id
  startedAt: string;                          // ISO 8601
  status: CampaignRunStatus;
}

export interface Campaign {
  id: string;
  workspaceId: string;
  name: string;
  voiceAgentId: string;
  status: CampaignStatus;
  contactList: ContactList;
  schedule: CampaignSchedule;
  metrics: CampaignMetrics;
  /** Default retry policy applied to new runs. Optional — older
   *  campaigns may not have one set; UI defaults to DEFAULT_RETRY_POLICY. */
  retryPolicy?: RetryPolicy;
  /** Operator-authored description of what this campaign does — captured
   *  at creation time, used for context (no analytics derived from it). */
  description?: string;
  /**
   * Post-call outcome intents the operator wants to track for this
   * campaign. Each one carries a short name plus a longer description
   * the backend LLM uses to classify call outcomes.
   */
  feedbackIntents?: FeedbackIntent[];
  createdBy: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  /**
   * Subsequent runs queued against this campaign after the initial
   * launch. Optional — the initial launch (`contactList` + `schedule`
   * above) is implicitly run #1.
   */
  runs?: CampaignRun[];
}

export type CallStatus =
  | 'initiated'
  | 'ringing'
  | 'connected'
  | 'in_progress'    // call is actively underway — intent/sentiment not yet finalised
  | 'answered'
  | 'completed'
  | 'failed'
  | 'abandoned';

export type FailureReason =
  | 'busy'
  | 'not_reachable'
  | 'invalid_number'
  | 'dnd'
  | 'network_error'
  | 'customer_hung_up'
  | 'other';

export interface Turn {
  index: number;
  role: 'agent' | 'customer';
  text: string;
  startMs: number;
  endMs: number;
}

export interface Entity {
  type: 'amount' | 'date' | 'product' | 'reference' | 'other';
  label: string;
  value: string;
  turnIndex: number;
}

export interface ToolCall {
  name: string;
  argsPreview: string;
  resultPreview: string;
  durationMs: number;
  status: 'success' | 'error';
  turnIndex: number;
}

export interface CallInsights {
  primaryIntent: string;
  secondaryIntents: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number;
  sentimentByTurn: number[];
  entities: Entity[];
  /** Short LLM-generated summary of the call (1–2 sentences). */
  summary: string;
  outcome: string;
  toolCalls: ToolCall[];
}

export interface CallRecording {
  url: string;
  durationMs: number;
  fileSizeBytes: number;
}

export interface Call {
  id: string;
  workspaceId: string;
  campaignId: string;
  voiceAgentId: string;
  phoneNumber: string;
  customerName?: string;
  contactAttributes: Record<string, string>;
  initiatedAt: string;
  connectedAt?: string;
  answeredAt?: string;
  endedAt?: string;
  duration: number;
  status: CallStatus;
  failureReason?: FailureReason;
  recording?: CallRecording;
  transcript?: Turn[];
  insights?: CallInsights;
  reviewed: boolean;
  flagged: boolean;
  notes?: string;
  tags: string[];
  cost: number;
}

/*
 * Calls are returned in two shapes from the API:
 *   - CallSummary  → list endpoints (tables, charts, KPIs)
 *   - CallDetail   → drawer endpoint (transcript, insights, recording)
 *
 * Backend contract:
 *   GET /calls?...            → CallSummary[]
 *   GET /calls/:id/detail     → CallDetail
 *
 * Joining a summary + detail by id reconstructs the full Call.
 */
export interface CallSummary {
  id: string;
  workspaceId: string;
  campaignId: string;
  voiceAgentId: string;
  phoneNumber: string;
  customerName?: string;
  initiatedAt: string;
  connectedAt?: string;
  answeredAt?: string;
  endedAt?: string;
  duration: number;
  status: CallStatus;
  failureReason?: FailureReason;
  primaryIntent?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  hasRecording: boolean;
  reviewed: boolean;
  flagged: boolean;
  tags: string[];
  cost: number;
}

export interface CallDetail {
  id: string;
  contactAttributes: Record<string, string>;
  recording?: CallRecording;
  transcript?: Turn[];
  insights?: CallInsights;
  notes?: string;
}

// ────────────────────────────────────────────────────────────────────
// Audience files
//
// Every CSV the operator uploads — whether at campaign creation or as a
// new run — lands here for validation. Powers the Audience List page.
// ────────────────────────────────────────────────────────────────────

export type AudienceFileStatus = 'pending' | 'validated' | 'failed';

export type AudienceFileSource = 'new_campaign' | 'new_run';

export interface AudienceFile {
  id: string;
  workspaceId: string;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string;
  source: AudienceFileSource;
  /** Reference to the campaign this file was uploaded against. */
  campaignId?: string;
  campaignName?: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicates: number;
  status: AudienceFileStatus;
  fileSizeBytes: number;
  /** Mock URL — real backend returns a presigned download link. */
  downloadUrl: string;
}
