---
phase: 05-scope-all-routes-and-full-isolation
plan: 03
subsystem: auth
tags: [supabase, typescript, nextjs, org-membership, multi-tenancy, data-isolation]

# Dependency graph
requires:
  - phase: 05-01
    provides: getUserOrg, requireOrgDsoAccess helpers in lib/auth.ts
  - phase: 01-database-foundation
    provides: org_members table, user_dso_access table
provides:
  - Org-filtered enumeration in clients/overview, dashboard/metrics, search
  - GET /api/team migrated to org_members as source of truth
  - Org membership gates on all team sub-routes (PATCH/DELETE [id], invite POST/GET/DELETE, accept-invite)
  - user_dso_access and team_invites deprecation migration documented
affects: [frontend team-members component (response shape preserved), all enumeration consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Category B org-filter: getUserOrg then user_dso_access join with dsos.org_id filter"
    - "GET /api/team: org_members query with user_profiles join replaces user_dso_access team listing"
    - "Team sub-route guard: getUserOrg before DSO-level checkDsoAccess (layered org + DSO checks)"
    - "primaryDsoId backward-compat: single user_dso_access lookup preserved for invite flow"

key-files:
  created:
    - supabase/migrations/20260227000000_deprecate_user_dso_access.sql
  modified:
    - src/app/api/clients/overview/route.ts
    - src/app/api/dashboard/metrics/route.ts
    - src/app/api/search/route.ts
    - src/app/api/team/route.ts
    - src/app/api/team/[id]/route.ts
    - src/app/api/team/invite/route.ts
    - src/app/api/team/accept-invite/route.ts

key-decisions:
  - "GET /api/team switches from user_dso_access to org_members — response shape preserved (members + dso_id)"
  - "org role (owner/admin/member) replaces DSO role (admin/manager/viewer) in team listing — intended behavior"
  - "primaryDsoId kept for backward compat via single user_dso_access lookup — invite flow still needs a dso_id"
  - "dashboard/metrics dsoId-specific path uses requireOrgDsoAccess — not just getUserOrg — for full two-level check"
  - "team sub-route getUserOrg runs before DSO-level checkDsoAccess — org boundary closes cross-org PATCH/DELETE attacks"
  - "Deprecation migration is documentation-only (COMMENT ON TABLE only) — no schema or data changes"

# Metrics
duration: ~4min
completed: 2026-02-28
---

# Phase 5 Plan 03: Category B Enumeration Routes and Team Route Migration Summary

**Org-filtered enumeration routes (clients/overview, dashboard/metrics, search), GET /api/team migrated to org_members, all team sub-routes gated by org membership, user_dso_access deprecation documented**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-28T02:47:14Z
- **Completed:** 2026-02-28T02:50:57Z
- **Tasks:** 2
- **Files modified:** 7 routes + 1 migration created

## Accomplishments

- `GET /api/clients/overview`: `getUserOrg` + org-filtered `user_dso_access` join — cross-org DSO enumeration closed
- `GET /api/dashboard/metrics`: `getUserOrg` for enumeration path + `requireOrgDsoAccess` for dso_id-specific path — full two-level isolation
- `GET /api/search`: `getUserOrg` + org-filtered `user_dso_access` join — search results scoped to user's org
- `GET /api/team`: Rewritten to query `org_members` (with `user_profiles` join) instead of `user_dso_access` — org membership is now the authoritative team listing source; response shape preserved
- `PATCH/DELETE /api/team/[id]`: `getUserOrg` org boundary check added before existing `checkDsoAccess`
- `POST/GET/DELETE /api/team/invite`: `getUserOrg` org membership gate added
- `POST /api/team/accept-invite`: `getUserOrg` org membership gate added
- `supabase/migrations/20260227000000_deprecate_user_dso_access.sql`: Documents the cleanup path for `user_dso_access` and `team_invites` with a 7-step future milestone plan (SC-6 satisfied)

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate Category B enumeration routes and team routes to org-filtered queries** - `70ea2b2` (feat)
2. **Task 2: Create user_dso_access deprecation migration and document cleanup path** - `a8ba0d0` (chore)

## Files Created/Modified

- `src/app/api/clients/overview/route.ts` - Added `getUserOrg` import + org-filtered enumeration
- `src/app/api/dashboard/metrics/route.ts` - Added `getUserOrg` + `requireOrgDsoAccess`, org-filtered enumeration
- `src/app/api/search/route.ts` - Added `getUserOrg` import + org-filtered enumeration
- `src/app/api/team/route.ts` - GET handler rewritten to use `org_members` + `getUserOrg`
- `src/app/api/team/[id]/route.ts` - Added `getUserOrg` org check to PATCH and DELETE
- `src/app/api/team/invite/route.ts` - Added `getUserOrg` org check to POST, GET, DELETE
- `src/app/api/team/accept-invite/route.ts` - Added `getUserOrg` org check to POST
- `supabase/migrations/20260227000000_deprecate_user_dso_access.sql` - COMMENT ON TABLE statements only (documentation migration)

## Decisions Made

- `GET /api/team` response shape preserved exactly (`{ members: TeamMember[], dso_id }`) — the `role` field now carries org role (`owner/admin/member`) instead of DSO role (`admin/manager/viewer`); this is the intended behavior per the plan
- `primaryDsoId` backward-compat lookup retained — one `user_dso_access` row is still needed by the invite flow, which operates on the DSO-scoped `team_invites` system
- `dashboard/metrics` with `?dso_id=` uses `requireOrgDsoAccess` (not just `getUserOrg`) to ensure both org boundary AND per-DSO assignment are checked for the specific-DSO path
- Team sub-routes add `getUserOrg` as a pre-flight org gate before passing to the existing `checkDsoAccess` — this layered approach prevents cross-org PATCH/DELETE even if a `user_dso_access` row exists for a DSO in another org
- Deprecation migration is COMMENT-only — no `ALTER TABLE`, no `DROP`, no data changes; safe to run on production at any time

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Phase 5 Progress

- Plan 01: DONE — auth helpers (requireOrgDsoAccess, getUserOrg), PATCH members handler (MBR-06)
- Plan 02: Complete (per STATE.md note — Category A route migrations)
- Plan 03: DONE (this plan) — Category B routes + team routes + deprecation migration
- Phase 5 complete: all enumeration routes org-filtered, team routes migrated, deprecation documented

## Self-Check: PASSED

- src/app/api/clients/overview/route.ts: FOUND
- src/app/api/dashboard/metrics/route.ts: FOUND
- src/app/api/search/route.ts: FOUND
- src/app/api/team/route.ts: FOUND
- src/app/api/team/[id]/route.ts: FOUND
- src/app/api/team/invite/route.ts: FOUND
- src/app/api/team/accept-invite/route.ts: FOUND
- supabase/migrations/20260227000000_deprecate_user_dso_access.sql: FOUND
- Commit 70ea2b2 (Task 1): FOUND
- Commit a8ba0d0 (Task 2): FOUND

---
*Phase: 05-scope-all-routes-and-full-isolation*
*Completed: 2026-02-28*
