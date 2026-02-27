---
phase: 02-auth-helpers-and-org-api
plan: 03
subsystem: api
tags: [supabase, postgres, nextjs, org-management, triggers, members]

# Dependency graph
requires:
  - phase: 02-01
    provides: requireOrgAccess, checkOrgMembership, OrgRole types, isValidOrgRole
  - phase: 01-database-foundation
    provides: org_members table, organizations table, user_profiles table

provides:
  - GET /api/orgs/[id]/members — list members with user_profiles join
  - POST /api/orgs/[id]/members — add member with role validation (owner/admin only)
  - DELETE /api/orgs/[id]/members — remove member with zero-owner guard (owner/admin only)
  - handle_new_user_signup() PostgreSQL trigger function (SECURITY DEFINER)
  - on_auth_user_created trigger (AFTER INSERT ON auth.users)

affects:
  - 02-04 (if any)
  - 03-team-invites (org-scoped invites will build on these member management endpoints)
  - 05-route-migration (all 31 routes audit — org_members now fully manageable)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "requireOrgAccess with requireOwnerOrAdmin=true flag gates owner/admin-only operations"
    - "DELETE uses URL search params (?user_id=) — no body parsing needed"
    - "Zero-owner guard: count owners before deleting, reject with 403 if last"
    - "Signup trigger uses SECURITY DEFINER so it can INSERT into auth schema tables"
    - "Trigger slug uniqueness: WHILE loop with counter suffix (email-1, email-2, ...)"

key-files:
  created:
    - src/app/api/orgs/[id]/members/route.ts
    - supabase/migrations/20260227000001_org_signup_trigger.sql
  modified:
    - supabase/seed.sql

key-decisions:
  - "DELETE reads user_id from URL search params (not body) — consistent with REST conventions for DELETE with params"
  - "POST defaults role to 'member' if not provided — least-privilege default"
  - "Signup trigger inserts user_profiles with ON CONFLICT DO NOTHING — seed.sql uses DO UPDATE to win"
  - "Trigger auto-org slug derived from email prefix — demo user gets 'demo' slug (differs from manual 'demo-org')"
  - "seed.sql org_members uses ON CONFLICT DO NOTHING for idempotent repeated seed runs"

patterns-established:
  - "Pattern: Zero-owner guard — always check owner count before deleting any owner-role member"
  - "Pattern: Signup trigger SECURITY DEFINER — allows postgres-owned function to write to auth schema"

# Metrics
duration: 8min
completed: 2026-02-27
---

# Phase 2 Plan 03: Member Management API and Auto-Org Signup Trigger Summary

**Member CRUD endpoints (GET/POST/DELETE with zero-owner guard) plus PostgreSQL AFTER INSERT trigger that auto-creates an organization for every new user signup**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-27T14:55:57Z
- **Completed:** 2026-02-27T15:04:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Member management route handles listing (with user_profiles join), adding (role validation), and removing (zero-owner guard)
- Auto-org trigger fires on every auth.users insert — new users get an org with unique slug derived from email prefix, and are added as owner
- seed.sql updated to be consistent with trigger: user_profiles uses DO UPDATE for predictability, org_members uses DO NOTHING for idempotency

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /api/orgs/[id]/members route** - `501da55` (feat)
2. **Task 2: Create auto-org signup trigger migration and update seed.sql** - `ebe90b8` (feat)

**Plan metadata:** (to be committed with SUMMARY.md and STATE.md)

## Files Created/Modified

- `src/app/api/orgs/[id]/members/route.ts` - GET (list members + profiles), POST (add member), DELETE (remove with zero-owner guard)
- `supabase/migrations/20260227000001_org_signup_trigger.sql` - handle_new_user_signup() SECURITY DEFINER function + on_auth_user_created AFTER INSERT trigger
- `supabase/seed.sql` - Added comment explaining dual-org in local dev, org_members ON CONFLICT DO NOTHING, user_profiles ON CONFLICT DO UPDATE

## Decisions Made

- DELETE accepts `user_id` as URL search param (`?user_id=<uuid>`) rather than request body — REST convention for DELETE with targeting param, avoids body parsing
- POST defaults `role` to `'member'` when not provided — least-privilege default, consistent with safe defaults
- Trigger inserts user_profiles with `ON CONFLICT DO NOTHING` (trigger runs first, seed.sql uses `DO UPDATE` so seed data always wins)
- Demo user will have two orgs in local dev: trigger-created "demo's Organization" (slug: "demo") and manual "Demo Organization" (slug: "demo-org") — acceptable for testing, slugs are distinct so no conflict

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added ON CONFLICT DO NOTHING to seed.sql org_members INSERT**
- **Found during:** Task 2 (seed.sql update)
- **Issue:** Plan specified adding only a comment, but the org_members INSERT had no conflict protection. Repeated seed runs or trigger-created rows could cause failures
- **Fix:** Added `ON CONFLICT DO NOTHING` to the org_members INSERT in seed.sql
- **Files modified:** supabase/seed.sql
- **Verification:** seed.sql reviewed, pattern consistent with other idempotent inserts
- **Committed in:** ebe90b8 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Minor addition for seed correctness — no scope creep.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Migration will run via `supabase db push` or `supabase db reset`.

## Next Phase Readiness

- Member management (MBR-07, MBR-08) complete with full CRUD and zero-owner guard
- Auto-org creation (ORG-01) complete via database trigger
- Phase 2 is now complete — all three plans (02-01, 02-02, 02-03) delivered
- Ready for Phase 3: Team Invites (org-scoped invite system)
- Before Phase 3: The existing invite bug (inviter's ALL DSOs granted on invite) must be fixed first to prevent cross-org data leak (flagged in STATE.md)

---
*Phase: 02-auth-helpers-and-org-api*
*Completed: 2026-02-27*
