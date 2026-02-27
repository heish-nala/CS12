---
phase: 04-org-context-and-settings-ui
plan: 03
subsystem: ui
tags: [react, nextjs, shadcn, settings, org, dso-access]

# Dependency graph
requires:
  - phase: 04-01
    provides: GET /api/orgs/[id]/dsos, GET/POST/DELETE /api/orgs/[id]/dso-access
  - phase: 04-02
    provides: OrgContext, useOrg hook, org.role field

provides:
  - OrgSettings component — Organization tab in settings with member list and DSO assignments
  - DsoAssignmentDialog component — modal for admin to add/remove DSO access per member
  - Organization tab in settings/page.tsx (4th tab: Team, Organization, Workspace, Notifications)

affects: [05-org-model-migration]

# Tech tracking
tech-stack:
  added: []
  patterns: [role-based-ui-from-context, parallel-data-fetch, diff-based-save]

key-files:
  created:
    - src/components/settings/org-settings.tsx
    - src/components/settings/dso-assignment-dialog.tsx
  modified:
    - src/app/settings/page.tsx

key-decisions:
  - "canManage derives from org.role via useOrg() — NOT hardcoded — satisfies UI-03 role gating"
  - "Admin/owner fetches all 3 endpoints in parallel; member fetches only members list (least-privilege fetch)"
  - "DsoAssignmentDialog computes toAdd/toRemove diff before saving — only touches changed assignments"
  - "409 on duplicate add is possible if UI gets out of sync; handled by onSave refetch"

patterns-established:
  - "Parallel data fetch with Promise.all for related settings data"
  - "Diff-based save: compute toAdd/toRemove from Set comparison before making API calls"
  - "Role-based UI: read org.role from OrgContext, never hardcode admin checks"

# Metrics
duration: 2min
completed: 2026-02-27
---

# Phase 4 Plan 03: Org Settings UI Summary

**Organization settings tab with member list, DSO assignment badges, and admin dialog to add/remove per-member DSO access using OrgContext role-based controls**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-27T21:55:20Z
- **Completed:** 2026-02-27T21:57:32Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- OrgSettings component fetches members, DSO access matrix, and all org DSOs in parallel for admin/owner users
- Each member row shows name, email, org role badge, and DSO assignment badges with Building2 icons
- DsoAssignmentDialog presents all org DSOs as checkboxes, computes diff, and saves only changed assignments via POST/DELETE
- Settings page has 4 tabs — Team, Organization, Workspace, Notifications — Organization tab is additive, no existing tabs removed
- Full `npm run build` passes (31 pages, TypeScript clean)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create OrgSettings component with member list and DSO assignments** - `76b76a2` (feat)
2. **Task 2: Create DsoAssignmentDialog and add Organization tab to settings page** - `45d67f8` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/components/settings/org-settings.tsx` — OrgSettings component; fetches 3 endpoints in parallel for admin, shows member list with role badges and DSO assignment badges, role-based Edit DSOs button
- `src/components/settings/dso-assignment-dialog.tsx` — DsoAssignmentDialog; checkbox list of all org DSOs, diff-based POST/DELETE save, toast feedback
- `src/app/settings/page.tsx` — Added Organization tab (Building2 icon), OrgSettings import, updated header subtitle

## Decisions Made
- `canManage` derived from `org.role` via `useOrg()` — not hardcoded — satisfies the plan requirement for role-based UI from OrgContext
- Admin/owner path fetches all 3 endpoints in parallel; member path fetches only members list (no admin-gated data exposed to members)
- DsoAssignmentDialog computes toAdd/toRemove diff before making any API calls — avoids unnecessary requests when nothing changes
- Used `Promise.all` for both batch adds and removes, with a single `anyFailed` check for error feedback

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- Phase 4 is now complete: all 3 plans done (01: backend DSO routes, 02: OrgContext + sidebar, 03: settings UI)
- Phase 5 (org model migration) can begin — 31 routes need audit before updating to org-scoped access model
- Product decision still open: does org membership grant access to all DSOs, or does user_dso_access remain permanent? Must resolve before Phase 5 planning.

## Self-Check: PASSED

All files confirmed on disk:
- `src/components/settings/org-settings.tsx` — FOUND
- `src/components/settings/dso-assignment-dialog.tsx` — FOUND
- `.planning/phases/04-org-context-and-settings-ui/04-03-SUMMARY.md` — FOUND

All commits confirmed in git log:
- `76b76a2` (Task 1: OrgSettings component) — FOUND
- `45d67f8` (Task 2: DsoAssignmentDialog + settings page) — FOUND

---
*Phase: 04-org-context-and-settings-ui*
*Completed: 2026-02-27*
