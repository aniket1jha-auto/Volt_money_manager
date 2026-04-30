# Auth flow

> Mock auth model for the Volt Voice portal. The UI assumes this contract;
> backend builds the real implementation against the same shape.

## Concept

Every user belongs to one or more **workspaces**. A workspace = one tenant.
For v1, only Volt Money exists (`ws_volt`). The model is multi-tenant from day
one.

## Screens

| Route | Purpose | Notes |
| --- | --- | --- |
| `/login` | Email + password sign-in | Any non-empty creds succeed in the mock |
| `/select-workspace` | Workspace picker | Auto-skipped when user has exactly one workspace |
| `*` (under `/`) | Authenticated app | Redirects to `/login?returnTo=...` if no session |

## Session

Stored in `localStorage` under `volt.session` (the full `User` object). Active
workspace is stored under `volt.activeWorkspace` (id only). On `logout()`, both
keys are cleared.

## State machine

```
unauthenticated  ──login()──▶  authenticated, 1 workspace      ──▶ /
                          ╲
                           ──▶ authenticated, N workspaces      ──▶ /select-workspace
                                                                       │
                                                                  pick workspace
                                                                       ▼
                                                                       /
authenticated   ──logout()──▶ unauthenticated  ──▶ /login
```

## RequireAuth guard

`<RequireAuth>` wraps every protected route. It:

1. Shows a breathing-π loader while session is loading from localStorage.
2. Redirects to `/login?returnTo=<path>` if no user.
3. Redirects to `/select-workspace` if user has > 1 workspace and no active
   workspace is set.
4. Otherwise renders children.

## Mock user

```ts
{
  id: 'user_001',
  email: 'admin@voltmoney.in',
  name: 'Priya Sharma',
  role: 'admin',
  workspaces: ['ws_volt'],
}
```

The login form pre-fills the email so the demo path is one click away. Any
non-empty email + password succeeds.

## Roles

```ts
type Role = 'admin' | 'manager' | 'analyst' | 'viewer';
```

For v1, only `admin` is exercised. The role appears in the user menu but
gates nothing yet — backend should treat `role` as the source of truth when
permissioning is added.

## Implied API contract

When backend takes over, the UI calls these endpoints:

- `POST /auth/login` → `{ email, password }` → `User`
- `POST /auth/logout` → 204
- `GET /auth/me` → `User` (called on app load to hydrate session)
- `GET /workspaces` → `Workspace[]` (workspaces the current user can access)

The mock today reads from `localStorage` and `MOCK_USER` / `MOCK_WORKSPACES`.
Drop-in replacement: swap `useAuth` and `useWorkspace` to fetch from these
endpoints. UI does not change.
