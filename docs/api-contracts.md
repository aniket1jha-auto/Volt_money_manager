# API contracts

> Every endpoint the backend needs to build, derived from what the UI
> reads and writes. Each entry is grounded in a function in
> [`frontend/src/lib/api.ts`](../frontend/src/lib/api.ts) — that is the
> source of truth. Replace the mock body with a real `fetch()` and the UI
> keeps working.

## Conventions

- **Base URL**: TBD. Suggest `/api/v1`.
- **Tenant header (mandatory)**: `X-Workspace-Id: <workspace_id>` on every
  request that returns tenant data. The server **must** verify the
  authenticated user belongs to that workspace and reject otherwise. See
  [multi-tenancy.md](./multi-tenancy.md).
- **Auth**: session cookie or bearer token — TBD with backend.
  Auth flow described in [auth-flow.md](./auth-flow.md).
- **Content type**: `application/json` for both request and response.
- **Pagination**: cursor or offset+limit — UI sends `offset` and
  `limit`; response carries `items[]` and `total`.
- **Filtering**: single values use `?key=v`, arrays use repeated keys
  (`?key=a&key=b`) or a comma-joined value, server's choice. UI
  serializes whichever the backend prefers.
- **Date filters**: ISO-8601 in UTC. The UI converts workspace-local
  ranges to UTC bounds before sending.
- **Error shape**:
  ```json
  { "error": { "code": "WORKSPACE_FORBIDDEN", "message": "..." } }
  ```
  HTTP status follows REST conventions (4xx for client errors, 5xx for
  server). UI surfaces `error.message`; `error.code` is for telemetry.
- **Identifiers**: see prefix conventions in
  [data-shapes.md](./data-shapes.md).

---

## Auth

### `POST /auth/login`
Sign in with credentials. Today the mock accepts any non-empty email +
password. Backend should validate credentials and create a session.

**Request**
```json
{ "email": "admin@voltmoney.in", "password": "•••••••" }
```

**Response 200** → `User`

**Errors** — `401 INVALID_CREDENTIALS`, `429 TOO_MANY_ATTEMPTS`

UI source: `useAuth.login()` — wraps `getCurrentUser()` in the mock; the
real implementation will call this endpoint.

---

### `POST /auth/logout`
End the session. UI clears local session state regardless of response.

**Response 204**

---

### `GET /auth/me`
Hydrate the current user when the app boots and the session cookie is
already present.

**Response 200** → `User`

**Errors** — `401 NO_SESSION`

UI source: `getCurrentUser(id)`.

---

## Workspaces

### `GET /workspaces`
Workspaces the authenticated user can access.

**Response 200** → `Workspace[]`

UI source: `getWorkspaces(userId)`.

---

### `GET /workspaces/:id`
Fetch a single workspace.

**Response 200** → `Workspace`

**Errors** — `404 WORKSPACE_NOT_FOUND`, `403 WORKSPACE_FORBIDDEN`

UI source: `getWorkspace(id)`.

---

### `GET /workspaces/:id/members`
Members of a workspace.

**Response 200** → `User[]`

Used by the Settings page (Team table). Currently shows the calling user
only — the endpoint is general.

---

## Voice agents

### `GET /voice-agents`
**Headers**: `X-Workspace-Id`

**Response 200** → `VoiceAgent[]`

UI source: `getVoiceAgents(workspaceId)`. Used by:
- Campaign Initiation (agent picker)
- Campaign list / Campaign card (display agent name)
- Campaign Analytics + Agent Analytics (filter dropdown, comparison table)

---

## Campaigns

### `GET /campaigns`
List campaigns in the workspace.

**Headers**: `X-Workspace-Id`

**Query parameters**
| Param | Type | Notes |
| --- | --- | --- |
| `status` | `CampaignStatus[]` | repeatable; `active`, `scheduled`, `completed`, `paused`, `draft` |
| `voiceAgentId` | `string` | single |
| `search` | `string` | substring match on name |
| `sort` | `'recent' \| 'name' \| 'status'` | default `recent` |
| `offset` | `int` | default 0 |
| `limit` | `int` | default unlimited |

**Response 200**
```ts
{ items: Campaign[], total: number }
```

UI source: `getCampaigns(workspaceId, filters)`.

---

### `GET /campaigns/:id`
**Headers**: `X-Workspace-Id`

**Response 200** → `Campaign`

**Errors** — `404 CAMPAIGN_NOT_FOUND`, `403 WORKSPACE_FORBIDDEN`

UI source: `getCampaign(workspaceId, id)`. Used by Campaign Detail.

---

### `POST /campaigns`
Create a new campaign. Either persist as draft or launch immediately
based on the request.

**Headers**: `X-Workspace-Id`

**Request body** — `CampaignDraft + { mode: 'draft' | 'launch' }`
```ts
{
  name: string;
  voiceAgentId: string;
  contactList: ContactList;
  schedule: { type: 'immediate' | 'scheduled'; startsAt?: string; timezone: string };
  retryPolicy?: RetryPolicy;          // omit → backend uses DEFAULT_RETRY_POLICY
  goal?: { description: string; targetIntent: string };  // optional
  feedbackIntents?: string[];                              // optional
  mode: 'draft' | 'launch';
}
```

**Response 201** → `Campaign`

**Behavior**
- `mode: 'draft'` → status becomes `draft`, no calls scheduled.
- `mode: 'launch'` + `schedule.type: 'immediate'` → status becomes
  `active`, dialer starts immediately.
- `mode: 'launch'` + `schedule.type: 'scheduled'` → status becomes
  `scheduled`, dialer fires at `schedule.startsAt`.

**Errors** — `400 INVALID_CAMPAIGN`, `402 INSUFFICIENT_CREDIT`,
`403 WORKSPACE_FORBIDDEN`

UI source: `createCampaign(workspaceId, draft, asDraft)`.

---

### `POST /campaigns/:id/upload`  *(supersedes ContactList payload, optional)*
Phase 1 of campaign creation: upload the raw CSV. Backend parses,
validates, returns the `ContactList` shape so the frontend can show the
mapping panel.

**Headers**: `X-Workspace-Id`, `Content-Type: multipart/form-data`

**Body** — `file=<csv>`

**Response 201**
```ts
{
  uploadId: string;
  contactList: ContactList;
  /** preview rows (first 10) — UI displays these in the mapping table */
  previewRows: string[][];
  headers: string[];
}
```

> Today the UI parses CSV in the browser (see
> [`frontend/src/lib/csv.ts`](../frontend/src/lib/csv.ts)) and ships the
> derived `ContactList` inline with `POST /campaigns`. Backend can keep
> this two-step flow if it prefers server-side parsing — the UI swap is
> small.

---

### `POST /campaigns/:id/runs`
Queue a new run on an existing campaign — the operator typically uses
this to re-execute the same campaign against a fresh audience. The run
either starts immediately or is scheduled; analytics across all runs
roll up under the parent campaign.

**Headers**: `X-Workspace-Id`

**Request body**
```ts
{
  contactList: ContactList;   // shape: see data-shapes.md
  schedule: {
    type: 'immediate' | 'scheduled';
    startsAt?: string;        // required when type === 'scheduled'
    timezone: string;         // workspace timezone, denormalized
  };
  retryPolicy: RetryPolicy;   // shape: see data-shapes.md + retry table below
}
```

**Response 201**
```ts
{
  campaign: Campaign;         // updated campaign — metrics.baseUploaded grew
  run: CampaignRun;           // the newly created run record
}
```

**Behavior**
- A new `CampaignRun` is appended to `campaign.runs[]`.
- `campaign.contactList` is updated to point at the new run's list
  (the "most recent cut" stays denormalized for list views).
- `campaign.retryPolicy` is updated to the submitted policy (becomes
  the new default for any subsequent run).
- The `retryPolicy` is **snapshot** on the run record so the rules
  active at the moment of execution are preserved even if the
  campaign-level default later changes.
- `campaign.metrics.baseUploaded` grows by `run.contactList.validRows`.
- If the campaign was `completed` or `draft` and the new run is
  immediate, status flips back to `active`.
- Schedule semantics match the create flow: `immediate` → run starts
  right away; `scheduled` → run waits until `startsAt`.

**Errors** — `404 CAMPAIGN_NOT_FOUND`, `403 WORKSPACE_FORBIDDEN`,
`400 INVALID_RUN`, `402 INSUFFICIENT_CREDIT`

UI source: `startCampaignRun(workspaceId, campaignId, draft)` —
triggered from the **New run** drawer on Campaign Detail.

---

### Retry policy → Plivo `hangup_cause` mapping

The UI exposes simple categories. The backend resolves them to Plivo
hangup-cause codes when deciding whether to re-queue a call. Source:
[Plivo Hangup Causes](https://www.plivo.com/docs/voice/troubleshooting/hangup-causes).

| Retry condition | Triggers retry on |
| --- | --- |
| `retryOn.shortAnswer` | Any code where the call was answered but `duration < shortAnswerThresholdSec`. Evaluated from the call record, not from a hangup cause alone. |
| `retryOn.noAnswer` | `3000` (No Answer), `6010` (Ring Timeout Reached) |
| `retryOn.busy` | `3010` (Busy Line), `3100` (Busy Everywhere), `3090` (Network congestion from carrier) |
| `retryOn.carrierError` | `3070` (Request timeout), `3080` (Internal server error from carrier), `5000` (Network Error), `6020` (Media Timeout) |
| `retryOn.voicemail` | `9100` (Machine Detected) |

Cause codes that should **never** trigger a retry by policy (the UI
does not surface these as toggles): `3020` Rejected, `3040` Forbidden,
`3110` Declined, `3130` Spam block, `2000` Invalid destination, `2010`
Out of service, `2030` Country barred, `2040` Number barred, `3050`
Unallocated number, `3120` User doesn't exist, `4000` Normal Hangup.

A retry attempt MUST respect:
- `retryPolicy.maxAttempts` — total additional dials beyond the first
- `retryPolicy.intervalMinutes` — minimum wait before the next dial
- The campaign's overall workspace-level CPS / concurrency limits

The frontend canonical mapping lives in
[`frontend/src/lib/retryPolicy.ts`](../frontend/src/lib/retryPolicy.ts) —
backend devs should mirror that file as the source of truth.

---

### `GET /campaigns/:id/runs`  *(optional)*
List every run for a campaign. The UI today derives the list from
`campaign.runs[]` returned with `GET /campaigns/:id`, plus the implicit
"initial run" reconstructed from `campaign.contactList` and
`campaign.startedAt`. A dedicated endpoint isn't required for v1 but
backend may add it later if pagination is needed.

---

### `POST /campaigns/:id/launch` · `POST /campaigns/:id/pause` · `POST /campaigns/:id/resume`  *(future)*
Status transitions for campaigns that already exist (draft → active,
active → paused, paused → active).

Not used in v1 — the create endpoint covers the launch path. Listed here
so backend can plan the lifecycle.

---

## Calls

Calls are returned in two shapes:

- `CallSummary` for tables, charts, KPIs.
- `CallDetail` for the call drawer (transcript + insights + recording).

The split is intentional — the index is loaded eagerly, the detail is
loaded on click. See [data-shapes.md](./data-shapes.md).

### `GET /calls`
List calls in the workspace, with rich filters.

**Headers**: `X-Workspace-Id`

**Query parameters**
| Param | Type | Notes |
| --- | --- | --- |
| `campaignId` | `string[]` | repeatable |
| `voiceAgentId` | `string[]` | repeatable |
| `status` | `CallStatus[]` | repeatable |
| `failureReason` | `FailureReason[]` | repeatable |
| `intent` | `string[]` | repeatable; managed vocabulary |
| `sentiment` | `('positive' \| 'neutral' \| 'negative')[]` | repeatable |
| `minDuration` | `int` | seconds |
| `maxDuration` | `int` | seconds |
| `phoneSearch` | `string` | digit-only substring |
| `from` | ISO-8601 | inclusive |
| `to` | ISO-8601 | inclusive |
| `sort` | `'recent' \| 'duration' \| 'cost'` | default `recent` |
| `offset` | `int` | default 0 |
| `limit` | `int` | default 50 |

**Response 200**
```ts
{ items: CallSummary[], total: number }
```

UI source: `getCalls(workspaceId, filters)`. Used by Campaign Analytics
(date-bound) and Agent Analytics (full filter set).

> Performance note: Agent Analytics may request up to ~50K rows in a
> single call when no filters are applied. Backend should:
> - Return paginated by default with a sensible cap (e.g. `limit` clamps
>   to 200).
> - Provide aggregation endpoints (see below) so the UI never needs the
>   full set just to draw a chart.

---

### `GET /calls/:id`
Fetch a single call summary.

**Headers**: `X-Workspace-Id`

**Response 200** → `CallSummary`

**Errors** — `404 CALL_NOT_FOUND`, `403 WORKSPACE_FORBIDDEN`

---

### `GET /calls/:id/detail`
Fetch the heavy call detail (transcript, insights, recording metadata).

**Headers**: `X-Workspace-Id`

**Response 200** → `CallDetail`

**Errors** — `404 CALL_NOT_FOUND`, `403 WORKSPACE_FORBIDDEN`

UI source: `getCallDetail(workspaceId, id)`. Lazy-loaded when the user
opens the Call Detail Drawer.

---

### `GET /calls/:id/recording`
Stream the audio recording.

**Headers**: `X-Workspace-Id`

**Response 200** — audio/mpeg or audio/wav

UI uses the `recording.url` from `CallDetail` — the URL may be a presigned
S3 link or a direct backend stream; the UI doesn't care.

---

### `PATCH /calls/:id`
Mutate flags / notes / tags on a call.

**Headers**: `X-Workspace-Id`

**Request body**
```ts
{
  reviewed?: boolean;
  flagged?: boolean;
  notes?: string | null;
  tags?: string[];
}
```

**Response 200** → `CallSummary`

UI source: footer actions in the Call Detail Drawer ("Mark reviewed",
"Flag"). Today the UI updates local state only and shows a toast — wire
this endpoint to persist.

---

### `POST /calls/:ids/export`  *(stubbed)*
Bulk export a set of calls (CSV / JSON). v1 UI shows a toast only.

**Request body**
```ts
{ ids: string[]; format: 'csv' | 'json'; include?: ('transcript' | 'insights')[] }
```

**Response 202** — `{ jobId: string }` plus a link to download once ready.

---

## Aggregates / dashboard

Aggregations the UI fetches as separate, cheap endpoints rather than
slicing call summaries client-side. Backend can implement them with
materialized views or roll-up tables.

### `GET /dashboard/kpis`
**Headers**: `X-Workspace-Id`

**Response 200** → `DashboardKpis`
```ts
{
  activeCampaigns: number;
  scheduledCampaigns: number;
  callsToday: number;
  callsYesterday: number;
  connectedRate7d: number;       // 0..1
  connectedRatePrev7d: number;
  avgDuration7d: number;         // seconds
  avgDurationPrev7d: number;
}
```

UI source: `getDashboardKpis(workspaceId)`. Drives the 4 KPI tiles on the
Dashboard.

---

### `GET /dashboard/intents-today`
**Headers**: `X-Workspace-Id`

**Response 200** → `{ intent: string; count: number }[]` — top 5

UI source: `getIntentsToday(workspaceId)`. Drives "Top intents today".

---

### `GET /dashboard/failures-today`
**Headers**: `X-Workspace-Id`

**Response 200** → `{ reason: FailureReason; count: number }[]` — top 3

UI source: `getFailureReasonsToday(workspaceId)`. Drives "Top failure
reasons today".

---

### `GET /analytics/campaigns/aggregate`  *(future, optional)*
The Campaign Analytics page currently aggregates client-side from
`getCalls()`. If row volumes grow, replace it with a server aggregation.

**Headers**: `X-Workspace-Id`

**Query** — same as `GET /calls` (campaignId, voiceAgentId, from, to)

**Response 200**
```ts
{
  metrics: AggregateMetrics;            // see analytics.ts
  series: { date: string; initiated: number; connected: number; answered: number; failed: number }[];
  failures: { total: number; items: { reason: FailureReason; count: number; share: number }[] };
  perCampaign: { campaign: Campaign; metrics: AggregateMetrics }[];
}
```

UI source: `aggregate()` + `dailySeries()` + `failureBreakdown()` +
`perCampaignRows()` in
[`frontend/src/lib/analytics.ts`](../frontend/src/lib/analytics.ts) —
backend can lift these definitions verbatim.

---

### `GET /analytics/agents/aggregate`  *(future, optional)*
Same idea for Agent Analytics: intent / sentiment / duration histograms.

**Response 200**
```ts
{
  metrics: AggregateMetrics;
  intents: IntentBucket[];
  sentiment: SentimentMix;
  duration: DurationBucket[];
}
```

UI source: `intentDistribution()`, `sentimentDistribution()`,
`durationHistogram()`.

---

## Endpoint summary

| # | Method | Path | Purpose | UI source |
| --- | --- | --- | --- | --- |
|  1 | POST | `/auth/login` | Sign in | `useAuth.login` |
|  2 | POST | `/auth/logout` | Sign out | `useAuth.logout` |
|  3 | GET  | `/auth/me` | Hydrate session | `getCurrentUser` |
|  4 | GET  | `/workspaces` | User's workspaces | `getWorkspaces` |
|  5 | GET  | `/workspaces/:id` | Fetch workspace | `getWorkspace` |
|  6 | GET  | `/workspaces/:id/members` | Team list | Settings page |
|  7 | GET  | `/voice-agents` | List agents | `getVoiceAgents` |
|  8 | GET  | `/campaigns` | List campaigns | `getCampaigns` |
|  9 | GET  | `/campaigns/:id` | Fetch campaign | `getCampaign` |
| 10 | POST | `/campaigns` | Create / launch / save draft | `createCampaign` |
| 11 | POST | `/campaigns/:id/runs` | Queue a new run (CSV + schedule + retry) | `startCampaignRun` |
| 12 | GET  | `/campaigns/:id/runs` | (optional) list runs | — |
| 13 | POST | `/campaigns/:id/upload` | (optional) server-side CSV parse | — |
| 14 | POST | `/campaigns/:id/launch` | Lifecycle (future) | — |
| 15 | POST | `/campaigns/:id/pause` | Lifecycle (future) | — |
| 16 | POST | `/campaigns/:id/resume` | Lifecycle (future) | — |
| 17 | GET  | `/calls` | List calls | `getCalls` |
| 18 | GET  | `/calls/:id` | Call summary | `getCallSummary` |
| 19 | GET  | `/calls/:id/detail` | Transcript + insights | `getCallDetail` |
| 20 | GET  | `/calls/:id/recording` | Audio stream | drawer audio player |
| 21 | PATCH | `/calls/:id` | Flag / review / notes / tags | drawer footer |
| 22 | POST | `/calls/export` | Bulk export (stubbed) | drawer / table bulk action |
| 23 | GET  | `/dashboard/kpis` | Dashboard KPIs | `getDashboardKpis` |
| 24 | GET  | `/dashboard/intents-today` | Top intents (today) | `getIntentsToday` |
| 25 | GET  | `/dashboard/failures-today` | Top failure reasons (today) | `getFailureReasonsToday` |
| 26 | GET  | `/analytics/campaigns/aggregate` | (optional) campaign rollup | `lib/analytics.ts` |
| 27 | GET  | `/analytics/agents/aggregate` | (optional) agent rollup | `lib/analytics.ts` |

Endpoints 1–11, 17–25 are required for v1. 12–16, 26–27 are listed for
backend planning and will be wired in later iterations.
