# Data shapes

> Canonical reference for every entity in the Volt Voice portal. The UI is
> built against these shapes; backend builds APIs to match.

All shapes also live as TypeScript interfaces in
[`frontend/src/types/index.ts`](../frontend/src/types/index.ts). Mock
records are in `frontend/src/mocks/data/*.json` — inspect actual records
to ground the contracts.

---

## Workspace

A tenant. Every other entity carries `workspaceId`.

```ts
type Workspace = {
  id: string;                       // 'ws_volt'
  name: string;                     // 'Volt Money'
  logo: string;                     // '/logos/volt-money.svg'
  industry: string;                 // 'Consumer Lending'
  region: string;                   // 'IN'
  currency: 'INR' | 'AED' | 'USD';
  timezone: string;                 // 'Asia/Kolkata'
  createdAt: string;                // ISO 8601
};
```

Sample: see [workspaces.json](../frontend/src/mocks/data/workspaces.json).

---

## User

```ts
type Role = 'admin' | 'manager' | 'analyst' | 'viewer';

type User = {
  id: string;                       // 'user_001'
  email: string;
  name: string;
  role: Role;
  workspaces: string[];             // workspace ids the user can access
};
```

Notes:
- `workspaces` is the source of truth for tenant access. The backend must
  reject any request whose authenticated user does not include the
  requested workspace.
- v1 only exercises `admin`. Other roles are reserved.

---

## VoiceAgent

```ts
type VoiceAgent = {
  id: string;
  workspaceId: string;
  name: string;                     // 'Loan Recovery Agent'
  voice: string;                    // 'Kavya' (voice persona)
  language: string;                 // 'hi-IN' | 'en-IN'
  description: string;
  status: 'active' | 'paused' | 'draft';
  model: string;                    // 'gpt-4o-realtime'
  createdAt: string;
};
```

Sample: 3 voice agents in
[voice-agents.json](../frontend/src/mocks/data/voice-agents.json).

---

## Campaign

```ts
type CampaignStatus =
  | 'draft' | 'scheduled' | 'active' | 'completed' | 'paused';

type ContactList = {
  fileName: string;
  uploadedAt: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicates: number;
  // CSV column header → variable name. 'phone_number' is required and
  // must be exactly one mapping.
  columnMapping: Record<string, string>;
};

type CampaignSchedule = {
  type: 'immediate' | 'scheduled';
  startsAt?: string;                // ISO; required when type === 'scheduled'
  timezone: string;                 // workspace timezone, denormalized
};

type CampaignMetrics = {
  baseUploaded: number;             // valid rows on the contact list
  callsInitiated: number;
  callsConnected: number;           // initiated minus failed
  callsAnswered: number;            // subset of connected
  callsFailed: number;
  avgCallDuration: number;          // seconds, across answered calls
  totalCost: number;                // workspace currency
};

/**
 * Campaign goal — captured at creation time. Two parts:
 *   - description: free-text purpose of the campaign
 *   - targetIntent: customer-side intent that counts as "goal met" for
 *     a single answered call
 *
 * The Analytics page renders a Goal card showing
 *   pct = count(answered calls where primaryIntent === targetIntent)
 *         / count(answered calls)
 */
type CampaignGoal = {
  description: string;
  targetIntent: string;
};

type CampaignRunStatus =
  | 'queued' | 'running' | 'completed' | 'paused' | 'failed';

/**
 * A campaign can be re-run against a fresh contact list at any time.
 * Each execution is a CampaignRun. The initial launch is implicitly
 * run #1 (its `contactList` and `schedule` live on the Campaign
 * itself). Subsequent runs are appended to `campaign.runs[]`.
 *
 * The campaign's top-level `contactList` is updated to the most recent
 * run's list (kept for backward compatibility with consumers that
 * just want the latest cut). Aggregate metrics on the campaign sum
 * across all runs.
 */
type CampaignRun = {
  id: string;                       // 'run_xxx'
  campaignId: string;
  contactList: ContactList;
  schedule: CampaignSchedule;
  /** Snapshot of the retry policy in force when this run was started. */
  retryPolicy: RetryPolicy;
  startedAt: string;
  startedBy: string;                // user id
  status: CampaignRunStatus;
};

/**
 * Retry policy — controls automatic re-dialing of calls that didn't
 * connect cleanly. Maps user-facing categories to Plivo `hangup_cause`
 * codes; see api-contracts.md for the full mapping table.
 */
type RetryPolicy = {
  enabled: boolean;
  /** Number of additional dial attempts on top of the first one. 1..5. */
  maxAttempts: number;
  /** Cooldown between attempts (minutes). */
  intervalMinutes: number;
  retryOn: {
    /** Customer answered but call duration < shortAnswerThresholdSec. */
    shortAnswer: boolean;
    shortAnswerThresholdSec: number;     // default 5
    /** No answer / rang out. Plivo: 3000, 6010. */
    noAnswer: boolean;
    /** Busy or carrier congestion. Plivo: 3010, 3100, 3090. */
    busy: boolean;
    /** Carrier or network error. Plivo: 3070, 3080, 5000, 6020. */
    carrierError: boolean;
    /** Voicemail / answering machine detected. Plivo: 9100. */
    voicemail: boolean;
  };
};

type Campaign = {
  id: string;                       // 'camp_001'
  workspaceId: string;
  name: string;
  voiceAgentId: string;
  status: CampaignStatus;
  contactList: ContactList;
  schedule: CampaignSchedule;
  metrics: CampaignMetrics;
  /** Default retry policy applied to new runs. Optional — older
   *  campaigns may not have one set; UI defaults to a sensible one. */
  retryPolicy?: RetryPolicy;
  /** Operator-defined success metric. Optional. */
  goal?: CampaignGoal;
  /**
   * Subset of the intent vocabulary the operator wants to track for
   * this campaign — the "feedback loop". Drives the Feedback Signals
   * card on the Analytics page. Optional.
   */
  feedbackIntents?: string[];
  createdBy: string;                // user id
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  /**
   * Subsequent runs queued against this campaign after the initial
   * launch. Optional — the initial launch (`contactList` + `schedule`
   * above) is implicitly run #1.
   */
  runs?: CampaignRun[];
};
```

Sample: 25 campaigns in
[campaigns.json](../frontend/src/mocks/data/campaigns.json) with a mix of
all statuses (5 active, 15 completed, 3 scheduled, 2 draft).

Notes:
- `metrics` is denormalized aggregates. Backend may compute these on read
  or maintain them eventually-consistent — the UI doesn't care, as long as
  values are consistent within a single response.
- Draft campaigns have all-zero metrics. Scheduled campaigns may have
  `baseUploaded` but otherwise zero.

---

## Call (split: summary + detail)

Calls are returned in two shapes from the API:

- `CallSummary` powers tables, KPIs, charts. Loaded eagerly.
- `CallDetail` powers the call drawer (transcript, insights, recording).
  Loaded on click.

The split is for performance: the index of every call fits in memory; the
transcripts and insights are 10× heavier and only needed one call at a
time.

### CallSummary

```ts
type CallStatus =
  | 'initiated' | 'ringing' | 'connected'
  | 'answered' | 'completed' | 'failed' | 'abandoned';

type FailureReason =
  | 'busy' | 'not_reachable' | 'invalid_number' | 'dnd'
  | 'network_error' | 'customer_hung_up' | 'other';

type CallSummary = {
  id: string;
  workspaceId: string;
  campaignId: string;
  voiceAgentId: string;

  phoneNumber: string;              // E.164 — '+919876543210'
  customerName?: string;            // pulled from CSV attribute, may be undefined

  initiatedAt: string;              // ISO 8601
  connectedAt?: string;
  answeredAt?: string;
  endedAt?: string;
  duration: number;                 // seconds; 0 for failed/abandoned

  status: CallStatus;
  failureReason?: FailureReason;    // present only when status === 'failed'

  primaryIntent?: string;           // present only on answered calls
  sentiment?: 'positive' | 'neutral' | 'negative';
  hasRecording: boolean;

  reviewed: boolean;
  flagged: boolean;
  tags: string[];
  cost: number;                     // workspace currency
};
```

Sample: 14,504 summaries in
[calls.json](../frontend/src/mocks/data/calls.json). Distribution roughly
74% answered / 20% failed / 6% abandoned.

### CallDetail

```ts
type Turn = {
  index: number;
  role: 'agent' | 'customer';
  text: string;
  startMs: number;                  // ms into the call
  endMs: number;
};

type Entity = {
  type: 'amount' | 'date' | 'product' | 'reference' | 'other';
  label: string;                    // 'Loan amount'
  value: string;                    // '₹2.5L'
  turnIndex: number;
};

type ToolCall = {
  name: string;                     // 'lookup_loan_status'
  argsPreview: string;              // JSON-ish preview, redacted
  resultPreview: string;
  durationMs: number;
  status: 'success' | 'error';
  turnIndex: number;
};

type CallInsights = {
  primaryIntent: string;
  secondaryIntents: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number;           // -1 to 1
  sentimentByTurn: number[];        // one per turn (kept on the wire; no longer rendered)
  entities: Entity[];               // kept on the wire; no longer rendered
  /** 1–2 sentence LLM-generated paraphrase of the call. Replaces the
   *  enum-style outcome label as the primary "what happened" surface. */
  summary: string;
  outcome: string;                  // managed-vocabulary tag, kept for analytics rollups
  toolCalls: ToolCall[];
};

type CallRecording = {
  url: string;                      // mock: '/mocks/sample-call.mp3'
  durationMs: number;
  fileSizeBytes: number;
};

type CallDetail = {
  id: string;
  contactAttributes: Record<string, string>; // all CSV columns for this contact
  recording?: CallRecording;
  transcript?: Turn[];
  insights?: CallInsights;
  notes?: string;
};
```

Sample: keyed map in
[call-details.json](../frontend/src/mocks/data/call-details.json).
Roughly 10.7K answered calls have a detail record; failed/abandoned do
not.

---

## Intent vocabulary (post-call outcomes)

These are the labels the AI tags onto a call **after it ends**. Each
value names what HAPPENED on the call, not what the customer asked
about. Stable enum — backend should treat these as a managed
vocabulary, not free text.

```
kyc_completed_on_call    KYC completed on call
application_submitted    Application submitted
interested_will_apply    Interested, will apply later
call_me_later            Call me later
not_interested           Not interested
payment_promised         Payment promised
payment_already_done     Payment already done
documents_requested      Documents requested
complaint_raised         Complaint raised
not_eligible             Not eligible
requesting_branch_visit  Wants to visit branch
wrong_number             Wrong number
dnd_requested            DND requested
transferred_to_human     Transferred to human
customer_unavailable     Customer unavailable
```

The canonical UI labels live in
[`frontend/src/lib/labels.ts`](../frontend/src/lib/labels.ts).

## Outcome vocabulary

Bounded per intent — see `OUTCOMES_BY_INTENT` in
[scripts/generate-mocks.mjs](../frontend/scripts/generate-mocks.mjs) for the
full mapping.

---

## Identifier conventions

| Entity | Prefix | Example |
| --- | --- | --- |
| Workspace | `ws_` | `ws_volt` |
| User | `user_` | `user_001` |
| Voice agent | `agent_` | `agent_loan_recovery` |
| Campaign | `camp_` | `camp_001` |
| Campaign run | `run_` | `run_lwxn7a3` |
| Call | `call_` | `call_camp_001_00042` |
| Tool call ticket | `TKT-` | `TKT-44219` |

Backend should adopt these prefixes (or map to its own scheme) — the UI
truncates ids in tables based on prefix length.

---

## Multi-tenant correctness

Every shape carries `workspaceId` (except `User`, which carries
`workspaces[]`). Every API endpoint must enforce that the authenticated
user's workspace list contains the requested `workspaceId`. The UI sends
the active workspace via the `X-Workspace-Id` header on every request
(see [api.ts](../frontend/src/lib/api.ts)).
