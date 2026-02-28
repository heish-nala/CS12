---
phase: 05-scope-all-routes-and-full-isolation
plan: 02
subsystem: api-routes
tags: [supabase, typescript, nextjs, org-membership, multi-tenancy, security]

# Dependency graph
requires:
  - phase: 05-scope-all-routes-and-full-isolation
    plan: 01
    provides: requireOrgDsoAccess and getUserOrg helpers in lib/auth.ts
provides:
  - All 17 Category A DSO-scoped routes use requireOrgDsoAccess or getUserOrg
  - Cross-org access blocked at all DSO data endpoints
  - GET /api/dsos enumerates only org-filtered DSOs
  - PATCH /api/dsos verifies org membership before update
affects: [all DSO data endpoints, SC-5 cross-org access requirement]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "requireOrgDsoAccess as universal replacement for requireDsoAccessWithFallback across all Category A routes"
    - "getUserOrg + org-filtered user_dso_access join for Category B enumeration (tasks, dsos GET)"
    - "POST double-fallback pattern eliminated — requireOrgDsoAccess handles body fallback internally"

key-files:
  created: []
  modified:
    - src/app/api/doctors/route.ts
    - src/app/api/doctors/[id]/route.ts
    - src/app/api/doctors/[id]/periods/route.ts
    - src/app/api/activities/route.ts
    - src/app/api/tasks/route.ts
    - src/app/api/progress/route.ts
    - src/app/api/dsos/route.ts
    - src/app/api/data-tables/route.ts
    - src/app/api/data-tables/[id]/route.ts
    - src/app/api/data-tables/[id]/columns/route.ts
    - src/app/api/data-tables/[id]/columns/[columnId]/route.ts
    - src/app/api/data-tables/[id]/rows/route.ts
    - src/app/api/data-tables/[id]/rows/[rowId]/route.ts
    - src/app/api/data-tables/[id]/rows/[rowId]/periods/route.ts
    - src/app/api/data-tables/[id]/rows/[rowId]/periods/[periodId]/route.ts
    - src/app/api/data-tables/[id]/periods/batch/route.ts
    - src/app/api/data-tables/format-phones/route.ts

key-decisions:
  - "POST double-fallback in data-tables/route.ts and data-tables/[id]/rows/route.ts collapsed to single requireOrgDsoAccess call — helper handles body fallback internally, manual user_dso_access query removed"
  - "GET /api/tasks enumeration path uses getUserOrg + inner join on dsos.org_id — prevents users from seeing tasks from DSOs in other orgs via crafted requests"
  - "GET /api/dsos uses getUserOrg + dsos!inner(org_id) join — org boundary enforced on DSO listing"
  - "activities/route.ts POST restructured into two paths: client_id provided (requireOrgDsoAccess) vs not provided (requireAuth fallback) — preserves legacy activities without client_id"

# Metrics
duration: 6min
completed: 2026-02-28
---

# Phase 5 Plan 02: Category A Route Migration to requireOrgDsoAccess Summary

**17 DSO-scoped routes migrated from requireDsoAccessWithFallback/checkDsoAccess to requireOrgDsoAccess — cross-org access now blocked at every DSO data endpoint**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-02-28T02:47:11Z
- **Completed:** 2026-02-28T02:53:15Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments

- **Task 1 (7 files):** Migrated all core DSO-scoped routes: doctors (list, create, get, update, delete, periods), activities (list, create), tasks (list, create), progress (list), dsos (list with org filter, update)
- **Task 2 (10 files):** Migrated all data-tables routes: table CRUD, column CRUD, row CRUD, period data (individual + batch), and format-phones utility
- **Double-fallback eliminated:** Two routes (POST /api/data-tables, POST /api/data-tables/[id]/rows) had manual body-fallback code after requireDsoAccessWithFallback — replaced with single requireOrgDsoAccess call (helper handles body fallback internally)
- **Category B hardened:** GET /api/tasks and GET /api/dsos now filter enumerated DSOs by org — prevents cross-org task/DSO visibility without a specific dsoId

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate core DSO-scoped routes to requireOrgDsoAccess** - `890e350` (feat)
2. **Task 2: Migrate all data-tables routes to requireOrgDsoAccess** - `5f3d68d` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

**Task 1 — Core routes (7 files):**
- `src/app/api/doctors/route.ts` — GET uses requireOrgDsoAccess for dsoId check; POST body fallback
- `src/app/api/doctors/[id]/route.ts` — GET/PATCH/DELETE replaced auth+checkDsoAccess with requireOrgDsoAccess
- `src/app/api/doctors/[id]/periods/route.ts` — GET/PATCH replaced requireDsoAccessWithFallback with requireOrgDsoAccess
- `src/app/api/activities/route.ts` — GET uses requireOrgDsoAccess per client_id; POST restructured
- `src/app/api/tasks/route.ts` — dsoId path uses requireOrgDsoAccess; enumeration uses getUserOrg+org-filtered join
- `src/app/api/progress/route.ts` — replaced requireDsoAccessWithFallback with requireOrgDsoAccess
- `src/app/api/dsos/route.ts` — GET uses getUserOrg+org-filtered join; PATCH uses requireOrgDsoAccess

**Task 2 — Data-tables routes (10 files):**
- `src/app/api/data-tables/route.ts` — GET/POST both use requireOrgDsoAccess; POST double-fallback simplified
- `src/app/api/data-tables/[id]/route.ts` — GET/PUT/DELETE all use requireOrgDsoAccess
- `src/app/api/data-tables/[id]/columns/route.ts` — GET/POST use requireOrgDsoAccess
- `src/app/api/data-tables/[id]/columns/[columnId]/route.ts` — PUT/DELETE use requireOrgDsoAccess
- `src/app/api/data-tables/[id]/rows/route.ts` — GET/POST use requireOrgDsoAccess; POST simplified
- `src/app/api/data-tables/[id]/rows/[rowId]/route.ts` — PUT/DELETE use requireOrgDsoAccess
- `src/app/api/data-tables/[id]/rows/[rowId]/periods/route.ts` — GET uses requireOrgDsoAccess
- `src/app/api/data-tables/[id]/rows/[rowId]/periods/[periodId]/route.ts` — GET/PUT/DELETE use requireOrgDsoAccess
- `src/app/api/data-tables/[id]/periods/batch/route.ts` — GET uses requireOrgDsoAccess
- `src/app/api/data-tables/format-phones/route.ts` — POST replaced manual double-fallback with requireOrgDsoAccess

## Decisions Made

- **POST double-fallback collapsed:** The original `POST /api/data-tables` and `POST /api/data-tables/[id]/rows` routes had a two-step auth pattern (try requireDsoAccessWithFallback, then manually query user_dso_access if that fails). This was replaced with a single `requireOrgDsoAccess(request, dsoId, true, body)` call — the helper already handles session → query param → body fallback sequence internally and adds org boundary enforcement.
- **GET /api/tasks enumeration hardened:** The bare `user_dso_access` query was replaced with a Supabase inner join `user_dso_access.select('dso_id, dsos!inner(org_id)').eq('dsos.org_id', orgInfo.orgId)` — this prevents cross-org task visibility when no dsoId is specified.
- **activities/route.ts POST restructured:** The original flow used `requireAuth` + `checkDsoAccess`. Since `requireOrgDsoAccess` requires a dsoId upfront, POST was restructured: when `client_id` is provided, `requireOrgDsoAccess` runs first; when no `client_id`, falls back to `requireAuth`. This preserves the legacy behavior of activities without a client_id association.
- **format-phones body parsing:** The original implementation parsed the body after auth failure, which risks consuming the request stream. Refactored to parse body before calling requireOrgDsoAccess so it can be passed as parsedBody argument for the fallback case.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] activities/route.ts POST restructured for client_id-less activities**

- **Found during:** Task 1 (activities/route.ts)
- **Issue:** Original `POST /api/activities` used `requireAuth` + `checkDsoAccess(userId, client_id)`. Simply replacing with `requireOrgDsoAccess` would require a `client_id` to exist, but the route allows activity creation without a client_id (doctor-only activities). A blanket requireOrgDsoAccess call would break that path.
- **Fix:** Split POST handler into two paths: (a) when `client_id` provided → `requireOrgDsoAccess(request, client_id, true, body)` for full org+DSO gating; (b) when no `client_id` → `requireAuth` fallback for legacy doctor-only activities. Org gating applies whenever a DSO is referenced.
- **Files modified:** `src/app/api/activities/route.ts`
- **Commit:** `890e350`

**2. [Rule 1 - Bug] format-phones body parsing moved before auth call**

- **Found during:** Task 2 (format-phones/route.ts)
- **Issue:** Original code parsed `request.json()` inside the auth failure branch (after the request stream may have been read by requireDsoAccessWithFallback). Restructured to parse body before calling requireOrgDsoAccess so parsedBody can be passed as the 4th argument — consistent with how all other routes handle body fallback.
- **Fix:** Parse body before auth call, catch parse errors, pass body to requireOrgDsoAccess.
- **Files modified:** `src/app/api/data-tables/format-phones/route.ts`
- **Commit:** `5f3d68d`

## Issues Encountered

None blocking — TypeScript check and build both passed cleanly after each task.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 03 can now proceed — all Category A routes are migrated; Plan 03 handles any remaining Category B enumeration routes and final validation
- `GET /api/overview-widgets` intentionally excluded (mock data only, no real persistence, no cross-org risk)
- Build passes cleanly (`npm run build` zero errors, `npx tsc --noEmit` zero errors)

## Self-Check: PASSED

- src/app/api/doctors/route.ts: FOUND
- src/app/api/doctors/[id]/route.ts: FOUND
- src/app/api/doctors/[id]/periods/route.ts: FOUND
- src/app/api/activities/route.ts: FOUND
- src/app/api/tasks/route.ts: FOUND
- src/app/api/progress/route.ts: FOUND
- src/app/api/dsos/route.ts: FOUND
- src/app/api/data-tables/route.ts: FOUND
- src/app/api/data-tables/[id]/route.ts: FOUND
- src/app/api/data-tables/[id]/columns/route.ts: FOUND
- src/app/api/data-tables/[id]/columns/[columnId]/route.ts: FOUND
- src/app/api/data-tables/[id]/rows/route.ts: FOUND
- src/app/api/data-tables/[id]/rows/[rowId]/route.ts: FOUND
- src/app/api/data-tables/[id]/rows/[rowId]/periods/route.ts: FOUND
- src/app/api/data-tables/[id]/rows/[rowId]/periods/[periodId]/route.ts: FOUND
- src/app/api/data-tables/[id]/periods/batch/route.ts: FOUND
- src/app/api/data-tables/format-phones/route.ts: FOUND
- Commit 890e350 (Task 1): FOUND
- Commit 5f3d68d (Task 2): FOUND
- npx tsc --noEmit: PASSED (zero errors)
- npm run build: PASSED (zero errors)

---
*Phase: 05-scope-all-routes-and-full-isolation*
*Completed: 2026-02-28*
