# Volt Voice — Voice Agent Portal

A focused single-client portal for **Volt Money**. Voice-only outbound
campaigns from CSV upload, with campaign-level and agent-level analytics.

This is a **UI mock for backend handoff** — every screen, state, and data
shape is locked so the dev team can build APIs against it. All data is
mocked locally in `frontend/src/mocks/data/*.json`.

## Stack

- React 18 + TypeScript
- Vite 5
- React Router 6
- Tailwind CSS v4 (token-driven)
- Lucide React icons
- Recharts

## Local development

```sh
cd frontend
npm install
npm run dev          # → http://localhost:5174
npm run generate-mocks   # regenerate the mock JSON dataset (deterministic)
```

Login with any non-empty email + password to enter the demo workspace
(Volt Money). The email is pre-filled to `admin@voltmoney.in`.

## Routes

| Path | Page | Phase |
| --- | --- | --- |
| `/login` | Sign in | 0 |
| `/select-workspace` | Workspace picker (skipped when 1 ws) | 0 |
| `/` | Dashboard | 2 |
| `/campaigns` | Campaigns list | 3 |
| `/campaigns/new` | Campaign Initiation | 3 |
| `/campaigns/:id` | Campaign Detail (= Analytics filtered) | 4 |
| `/analytics/campaigns` | Campaign Analytics | 4 |
| `/analytics/agents` | Agent Analytics | 5 |
| `/analytics/agents/:callId` | Agent Analytics with drawer pre-opened | 5 |
| `/settings` | Settings | 6 |

## Project structure

```
volt-voice-portal/
  frontend/
    src/
      app/                 routing, layout shell, route guards
      pages/               page components, one per route
      components/
        ui/                primitives (Button, Card, Modal, Drawer, ...)
        features/          app-specific (Sidebar, Charts, Drawer body, ...)
      hooks/               useAuth, useWorkspace, useAsyncData
      lib/                 api client, csv parser, format, analytics, labels
      mocks/data/          generated JSON dataset
      types/               shared TS types
      styles/tokens.css    design tokens (inherited from Pi-commerce)
    public/mocks/          placeholder audio file
    scripts/
      generate-mocks.mjs   deterministic mock dataset generator
  docs/
    auth-flow.md           auth model + screens
    multi-tenancy.md       how tenant context flows through the app
    data-shapes.md         TS interfaces for every entity (canonical)
    api-contracts.md       every implied REST endpoint
    decisions/             architecture decisions
```

## Docs index for backend handoff

Read in this order:
1. **[multi-tenancy.md](docs/multi-tenancy.md)** — workspace boundary
   model and how the UI sends tenant context.
2. **[auth-flow.md](docs/auth-flow.md)** — sign-in, session, workspace
   resolution.
3. **[data-shapes.md](docs/data-shapes.md)** — every TypeScript type with
   sample records. The contract.
4. **[api-contracts.md](docs/api-contracts.md)** — REST endpoints derived
   from what the UI reads/writes. 21 endpoints required for v1.

Source-of-truth pointers:
- Mock API client: [frontend/src/lib/api.ts](frontend/src/lib/api.ts) —
  every function names the implied REST endpoint in its doc comment.
- Data shapes: [frontend/src/types/index.ts](frontend/src/types/index.ts).
- Analytics aggregations: [frontend/src/lib/analytics.ts](frontend/src/lib/analytics.ts) —
  pure functions; backend can lift them verbatim.
- Mock dataset: [frontend/src/mocks/data/](frontend/src/mocks/data) —
  inspect actual records to ground the contracts.

## Demo conveniences

- **Deterministic mock data**: same seed every run. 14,504 calls across
  25 campaigns. Reproduce with `npm run generate-mocks`.
- **Mock NOW anchor**: the dataset is anchored to `2026-04-30T11:00:00Z`,
  and the analytics pages use that anchor for default ranges so demos
  always land on data.
- **Simulated latency**: mock API calls take 80–450ms so the UI's
  loading skeletons surface during dev.
- **Fault injection**: turn on "Simulate API failures" in
  `/settings → Developer`, or pass `?simulateError=1` on any URL — every
  API call rejects, and you can step through error states + retry on
  every page.

## Build phases

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Project setup, auth flow, sidebar shell, routing | ✅ |
| 1 | Mock data generation, mock API client, data shapes | ✅ |
| 2 | Dashboard | ✅ |
| 3 | Campaigns list + Campaign Initiation | ✅ |
| 4 | Campaign Analytics + Campaign Detail | ✅ |
| 5 | Agent Analytics + Call Detail Drawer | ✅ |
| 6 | Polish, error states, Settings page, handoff docs | ✅ |

## Not in scope for v1

Captured in the brief and intentionally absent: SMS / WhatsApp / Email
channels, journey builder, A/B testing, segments, audience builder,
knowledge base, evals, real-time data refresh, audio auto-play.
