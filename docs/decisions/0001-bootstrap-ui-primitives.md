# ADR 0001 — Bootstrap `components/ui/` primitives in Pi-commerce style

**Status:** accepted
**Date:** 2026-04-30
**Phase:** 0

## Context

The brief states: *"The token file and `/components/ui/` primitives are
being copied in before you start."* In practice, Pi-commerce organizes
components by feature (`components/agents/`, `components/campaign/`, etc.)
and does not have a dedicated `components/ui/` folder. There was nothing
to copy.

## Decision

Bootstrap a fresh `components/ui/` set inside the new project, written in
Pi-commerce's design language:

- Same color tokens (Paytm navy + bright blue, cool slate neutrals).
- Same type system (Inter / Instrument Serif / JetBrains Mono).
- Same hover patterns (4px lift, accent border, soft glow).
- Same logo treatment (π gradient mark + intro animation + breathing).

Phase 0 ships these primitives:

- `Button` — primary / secondary / ghost / danger × sm / md / lg
- `Card` — interactive variant with hover lift
- `Input`, `Label`, `HelperText`
- `Badge` — neutral / brand / info / success / warning / danger, with dot variant
- `Logo` — π mark + Volt Voice wordmark, with intro and breathing
- `Skeleton`

Later phases add as needed: `Select`, `Modal`, `Drawer`, `Tabs`, `Tooltip`,
`Toast`, `Table`, `Progress`, `EmptyState`. Each new primitive gets its own
ADR or is logged inline in this file.

## Consequences

- Volt Voice owns its primitive library and is not blocked on a Pi-commerce
  refactor.
- When Pi-commerce eventually extracts a shared design-system package, both
  projects can migrate to it without breaking — these primitives are thin
  enough that the API surface is small.
- A reviewer comparing the two products side-by-side will see continuity in
  visual language but may see API drift between the primitive sets. That is
  acceptable for now.

## Alternatives considered

- **Wait for Pi-commerce to extract a shared package.** Rejected — blocks
  Phase 0 indefinitely on a refactor outside this project's scope.
- **Copy the feature components from Pi-commerce wholesale.** Rejected —
  they're tightly coupled to Pi-commerce's data model and would drag in
  unrelated dependencies.
