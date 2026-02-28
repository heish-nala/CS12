---
phase: 05-scope-all-routes-and-full-isolation
plan: 01
subsystem: auth
tags: [supabase, typescript, nextjs, org-membership, multi-tenancy]

# Dependency graph
requires:
  - phase: 02-auth-helpers-and-org-api
    provides: checkOrgMembership, checkDsoAccess, requireOrgAccess helpers in lib/auth.ts
  - phase: 04-org-context-and-settings-ui
    provides: org_members table populated, DSO assignment endpoints operational
provides:
  - requireOrgDsoAccess helper (org membership + per-DSO access check in one call)
  - getUserOrg helper (returns user's org_id from org_members for enumeration routes)
  - PATCH /api/orgs/[id]/members (MBR-06 role change handler with zero-owner guard)
affects: [05-02, 05-03, all DSO-scoped routes in Category A and B]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "requireOrgDsoAccess: two-level isolation — org boundary check then per-DSO access check"
    - "getUserOrg: single-org assumption (v1) with explicit .limit(1).single() pattern"
    - "Zero-owner guard for PATCH mirrors existing DELETE guard in same file"

key-files:
  created: []
  modified:
    - src/lib/auth.ts
    - src/app/api/orgs/[id]/members/route.ts

key-decisions:
  - "requireOrgDsoAccess preserves user_id body fallback — fallback userId gets same org+DSO checks as session users"
  - "getUserOrg uses .limit(1).single() — explicit v1 single-org-per-user assumption"
  - "Zero-owner guard message matches DELETE handler exactly: 'Cannot demote the last owner. Transfer ownership first.'"
  - "requireOrgDsoAccess placed after requireDsoAccessWithFallback to preserve forward-reference to checkOrgMembership"

patterns-established:
  - "Pattern: requireOrgDsoAccess as standard Category A replacement for requireDsoAccessWithFallback"
  - "Pattern: getUserOrg as Category B enumeration helper for org-filtered DSO queries"

# Metrics
duration: 2min
completed: 2026-02-28
---

# Phase 5 Plan 01: Auth Foundation and MBR-06 Summary

**`requireOrgDsoAccess` and `getUserOrg` helpers added to lib/auth.ts; PATCH role-change handler with zero-owner guard added to /api/orgs/[id]/members**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-28T02:42:26Z
- **Completed:** 2026-02-28T02:44:06Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `getUserOrg(userId)` — returns `{ orgId, role }` from `org_members`, the enumeration helper Category B routes need to filter DSO data to the user's org
- `requireOrgDsoAccess(request, dsoId, requireWrite?, parsedBody?)` — replaces `requireDsoAccessWithFallback` as the standard auth check for all 20+ DSO-scoped routes; adds org boundary enforcement upstream of per-DSO access check
- `PATCH /api/orgs/[id]/members` — completes member management CRUD (MBR-06); validates role, looks up current role, enforces zero-owner guard before updating

## Task Commits

Each task was committed atomically:

1. **Task 1: Add requireOrgDsoAccess and getUserOrg helpers to lib/auth.ts** - `fa74c2a` (feat)
2. **Task 2: Add PATCH handler to /api/orgs/[id]/members for role changes (MBR-06)** - `adad0b5` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `src/lib/auth.ts` - Added `getUserOrg` and `requireOrgDsoAccess` exports (111 lines added)
- `src/app/api/orgs/[id]/members/route.ts` - Added `PATCH` export for MBR-06 (93 lines added)

## Decisions Made
- `requireOrgDsoAccess` preserves the `user_id` body fallback from `requireDsoAccessWithFallback` — the fallback userId receives identical org membership and per-DSO access checks as session-authenticated users (no security downgrade)
- `getUserOrg` uses `.limit(1).single()` explicitly — v1 single-org-per-user assumption, same as Phase 02-02 DSO create pattern
- PATCH zero-owner guard message uses exact same wording as the DELETE zero-owner guard (`'Cannot demote the last owner. Transfer ownership first.'`) for UI consistency
- Functions placed after `requireDsoAccessWithFallback` and before `checkOrgMembership` — `requireOrgDsoAccess` calls `checkOrgMembership` internally; TypeScript module scope allows this ordering

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 02 and 03 can now proceed — `requireOrgDsoAccess` is available for all Category A route migrations
- `getUserOrg` is available for all Category B enumeration route migrations
- `PATCH /api/orgs/[id]/members` is live for MBR-06 (role change)
- Build passes cleanly (`npm run build` zero errors, `npx tsc --noEmit` zero errors)

## Self-Check: PASSED

- src/lib/auth.ts: FOUND
- src/app/api/orgs/[id]/members/route.ts: FOUND
- .planning/phases/05-scope-all-routes-and-full-isolation/05-01-SUMMARY.md: FOUND
- Commit fa74c2a (Task 1): FOUND
- Commit adad0b5 (Task 2): FOUND

---
*Phase: 05-scope-all-routes-and-full-isolation*
*Completed: 2026-02-28*
