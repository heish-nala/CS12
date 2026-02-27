---
phase: 04-org-context-and-settings-ui
plan: 02
subsystem: ui
tags: [react-context, org, sidebar, provider, hooks]

# Dependency graph
requires:
  - phase: 02-auth-helpers-and-org-api
    provides: GET /api/orgs endpoint returning { orgs: Array<Organization & { role: OrgRole }> }
  - phase: 03-invite-system
    provides: auth-context with useAuth hook (user, loading)
provides:
  - OrgContext provider (org, loading, refreshOrg) shared across all Phase 4 UI components
  - Sidebar now displays dynamic org name from context (not hardcoded 'CS12')
affects: [04-03, 04-04, settings-ui, any component needing org id/name/role]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "OrgContext mirrors ClientsContext — single-fetch, auth-gated, shared via provider"
    - "Provider nesting order: AuthProvider > ClientsProvider > OrgProvider > OnboardingProvider"

key-files:
  created:
    - src/contexts/org-context.tsx
  modified:
    - src/app/layout.tsx
    - src/components/layout/notion-sidebar.tsx

key-decisions:
  - "OrgContext fetches /api/orgs with no user_id param — route reads from session, not URL"
  - "v1 uses first org only (orgs[0]) with console.warn for multi-org users — MORG-02 for v2"
  - "OrgProvider placed inside ClientsProvider but wrapping OnboardingProvider — clean nesting, both depend on auth but not each other"
  - "Sidebar falls back to 'CS12' when org is null (loading state or edge case) — no flash of empty content"

patterns-established:
  - "Context fetch guard: !authLoading && user?.id before API call — prevents premature 401"
  - "truncate class on org name span — prevents long names from breaking sidebar layout"

# Metrics
duration: 2min
completed: 2026-02-27
---

# Phase 4 Plan 02: Org Context and Sidebar Summary

**React OrgContext provider fetching /api/orgs after auth is ready, wired into layout.tsx and surfacing the org name dynamically in the sidebar header**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-27T21:50:42Z
- **Completed:** 2026-02-27T21:51:55Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created `org-context.tsx` following exact ClientsContext pattern — single fetch, auth-gated, shared state
- OrgProvider added to layout.tsx provider tree: `AuthProvider > ClientsProvider > OrgProvider > OnboardingProvider`
- Sidebar header replaced hardcoded "CS12" with `{org?.name ?? 'CS12'}` with `truncate` for layout safety
- TypeScript compiles clean (`npx tsc --noEmit` passes)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create OrgContext provider and useOrg hook** - `1c96f12` (feat)
2. **Task 2: Wire OrgProvider into layout and show org name in sidebar** - `82bf43a` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `src/contexts/org-context.tsx` - OrgProvider + useOrg hook, fetches /api/orgs after auth, exposes { org, loading, refreshOrg }
- `src/app/layout.tsx` - Added OrgProvider import and nesting in provider tree
- `src/components/layout/notion-sidebar.tsx` - Added useOrg import, org destructure, dynamic org name in header

## Decisions Made
- OrgContext fetches `/api/orgs` (no user_id param) — the route reads from session, matching the server-side auth pattern
- v1 uses `orgs[0]` with a `console.warn` for multi-org users — explicit v2 placeholder via MORG-02 comment
- OrgProvider placed inside `ClientsProvider` but wrapping `OnboardingProvider` — mirrors the existing nesting convention
- Sidebar falls back to `'CS12'` when `org` is null — handles loading state and edge case (new user without org) gracefully

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- OrgContext is ready for all Phase 4 components (settings pages, org member management UI) to call `useOrg()` and access `org.id`, `org.name`, `org.role`
- No blockers for 04-03 or 04-04

---
*Phase: 04-org-context-and-settings-ui*
*Completed: 2026-02-27*

## Self-Check: PASSED

- FOUND: src/contexts/org-context.tsx
- FOUND: src/app/layout.tsx
- FOUND: src/components/layout/notion-sidebar.tsx
- FOUND commit: 1c96f12
- FOUND commit: 82bf43a
