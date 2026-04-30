# Multi-tenancy

> The Volt Voice portal is architected multi-tenant from day one, even though
> only one workspace (Volt Money) exists today. Workspace context flows
> through every read and every write.

## Workspace = tenant

A `Workspace` represents one tenant. Its id (`ws_volt`) appears on every
domain entity:

```ts
Campaign.workspaceId
VoiceAgent.workspaceId
Call.workspaceId
```

When more workspaces exist, this id is the **only** thing that changes
between two tenants seeing their own data.

## How tenant context flows in the UI

1. `WorkspaceProvider` (in `src/hooks/useWorkspace.tsx`) wraps the entire
   authenticated app inside the auth provider.
2. After login, the provider:
   - Reads the user's `workspaces[]` array.
   - Picks the active workspace from `localStorage` (`volt.activeWorkspace`)
     or auto-selects when only one exists, or routes to
     `/select-workspace` when more than one.
3. Every page reads `useWorkspace()` to get `activeWorkspace`.
4. Every mock data fetch (Phase 1+) is scoped to
   `activeWorkspace.id` — the mock API client filters records by this id.

## The switcher

The workspace switcher lives at the bottom of the sidebar. It always
renders the active workspace name; clicking opens a dropdown of all
workspaces the user can access. Switching:

- Updates the active workspace in localStorage.
- Triggers a context update — every component reading `useWorkspace()`
  re-renders.
- Pages that load tenant-scoped data must re-fetch when `activeWorkspace.id`
  changes (Phase 1+ mock client does this automatically).

## Backend contract

Every API the backend builds must accept (or implicitly enforce via auth) a
workspace boundary. The UI sends workspace context one of two ways:

- **Header**: `X-Workspace-Id: ws_volt` on every request (preferred, simpler
  for the UI).
- **Path**: `/workspaces/:workspaceId/...` on tenant-scoped endpoints.

We use the header model in `src/lib/api.ts` (built in Phase 1).

The backend **must reject** any request whose authenticated user does not
belong to the requested workspace. This is the tenant boundary; the UI
trusts but does not enforce it.

## Currency, timezone, locale

Each workspace declares its own `currency`, `region`, and `timezone`.
Number formatting, date formatting, and phone number formatting in the UI
**must read from the active workspace**, not from a global constant.

For Volt Money:
- currency: `INR` (₹)
- region: `IN`
- timezone: `Asia/Kolkata`

Helpers in `src/lib/format.ts` (Phase 1+) take the active workspace as
input.

## What MUST NOT happen

- A page hard-codes the workspace id `ws_volt`.
- A mock data fetch returns records from a different workspace.
- A formatter assumes INR / IST without reading from the active workspace.
- The sidebar switcher is hidden because "there's only one workspace".

These are all easy traps in a single-tenant-today, multi-tenant-tomorrow
build. The reviewer should be able to add a second workspace to
`MOCK_WORKSPACES` and have the entire app continue to work without any
other changes.
