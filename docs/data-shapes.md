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

type Campaign = {
  id: string;                       // 'camp_001'
  workspaceId: string;
  name: string;
  description?: string;
  voiceAgentId: string;
  status: CampaignStatus;
  contactList: ContactList;
  schedule: CampaignSchedule;
  metrics: CampaignMetrics;
  createdBy: string;                // user id
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
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
  sentimentByTurn: number[];        // one per turn
  entities: Entity[];
  outcome: string;                  // 'agreed_to_pay', 'callback_scheduled', etc.
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

## Intent vocabulary (consumer lending)

Stable enum — backend should treat these as a managed vocabulary, not free
text.

```
loan_inquiry
emi_status
repayment_intent
payment_promise
kyc_pending
application_status
callback_request
document_request
balance_inquiry
renewal_inquiry
complaint
dispute_charge
financial_hardship
wrong_number
agent_handoff_request
```

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
