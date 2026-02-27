---
phase: 03-invite-system
plan: 01
subsystem: api
tags: [supabase, postgres, invites, multi-tenant, security]

# Dependency graph
requires:
  - phase: 02-auth-helpers-and-org-api
    provides: user_profiles table (used to replace listUsers() anti-pattern), organizations table (FK target for org_invites), supabaseAdmin pattern
  - phase: 01-database-foundation
    provides: org_members/organizations schema, gen_random_uuid() migration pattern, no-RLS decision

provides:
  - Fixed POST /api/team/invite — existing user branch grants only the requested dso_id (not all inviter DSOs)
  - Fixed POST /api/team/accept-invite — grants only invite.dso_id per invite (not all inviter DSOs)
  - org_invites table migration ready for Plan 02 send/accept endpoints

affects:
  - 03-02 (org invite send/accept endpoints depend on org_invites table)
  - 03-03 (auth/confirm route depends on correct invite acceptance behavior)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - user_profiles lookup by email instead of listUsers() for existing user checks
    - Single-DSO insert pattern replacing multi-DSO expansion on invite accept

key-files:
  created:
    - supabase/migrations/20260227100000_add_org_invites.sql
  modified:
    - src/app/api/team/invite/route.ts
    - src/app/api/team/accept-invite/route.ts

key-decisions:
  - "ISO-04 bug fix: existing user invite now inserts only { user_id, dso_id, role } for the single requested DSO"
  - "Accept-invite duplicate access (23505) is silently skipped — idempotent, correct for retry scenarios"
  - "org_invites table uses org_id FK (not dso_id) — org roles (owner/admin/member), separate from team_invites"
  - "No RLS on org_invites — consistent with Phase 1 supabaseAdmin bypass decision"
  - "team_invites table and routes preserved — Phase 5 will deprecate old DSO-scoped model"

patterns-established:
  - "Invite scope: always insert only the explicitly requested dso_id or org_id — never expand to all inviter resources"
  - "Existing user check: query user_profiles.email, not auth.admin.listUsers()"

# Metrics
duration: 2min
completed: 2026-02-27
---

# Phase 3 Plan 01: Fix Invite Bug + org_invites Migration Summary

**Closed ISO-04 cross-org data leak: invite routes now grant only the specific requested DSO, and org_invites migration is ready for Plan 02's send/accept endpoints.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-27T19:53:43Z
- **Completed:** 2026-02-27T19:55:51Z
- **Tasks:** 2
- **Files modified:** 3 (2 route files fixed, 1 migration created)

## Accomplishments
- Removed "all inviter's DSOs" expansion logic from both invite routes — invitees now get access to exactly the one DSO they were invited to
- Replaced `auth.admin.listUsers()` anti-pattern with `user_profiles` table lookup by email in the invite sender route
- Created `org_invites` table migration with correct org-scoped schema, FK references, indexes, and no RLS

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix existing invite bug in team invite and accept-invite routes** - `a25d985` (fix)
2. **Task 2: Create org_invites table migration** - `63016a2` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/app/api/team/invite/route.ts` - Replaced listUsers()+all-DSOs logic with user_profiles lookup + single dso_id insert
- `src/app/api/team/accept-invite/route.ts` - Replaced inviterAccess+allDsoIds loop with single invite.dso_id insert per invite
- `supabase/migrations/20260227100000_add_org_invites.sql` - New org_invites table: org_id FK, email, role (owner/admin/member), invited_by FK, status, expires_at, UNIQUE(org_id, email, status), 3 indexes

## Decisions Made
- Accept-invite duplicate (error code 23505) is silently skipped rather than aborting the whole loop — an invitee who already has access should still have the invite marked accepted
- org_invites schema omits a `user_id` column for the invitee — acceptance flow looks up by email, adding nullable user_id would be unused complexity
- No RLS on org_invites — consistent with the supabaseAdmin-only pattern established in Phase 1

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required. Migration will be applied in the normal `supabase db push` flow.

## Next Phase Readiness
- org_invites table schema is ready for Plan 02's `POST /api/orgs/[id]/invites` and `POST /api/orgs/accept-invite` endpoints
- The existing invite bug (ISO-04) is fully closed — safe to build org-scoped invites without cross-org data leak risk
- team_invites and its routes are untouched — still operational for the existing DSO-level invite UI

---
*Phase: 03-invite-system*
*Completed: 2026-02-27*

## Self-Check: PASSED

- FOUND: src/app/api/team/invite/route.ts
- FOUND: src/app/api/team/accept-invite/route.ts
- FOUND: supabase/migrations/20260227100000_add_org_invites.sql
- FOUND: .planning/phases/03-invite-system/03-01-SUMMARY.md
- FOUND commit: a25d985 (fix invite bug)
- FOUND commit: 63016a2 (org_invites migration)
