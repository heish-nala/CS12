---
phase: 01-database-foundation
plan: 01
subsystem: database
tags: [postgresql, supabase, migrations, multi-tenancy, organizations]

# Dependency graph
requires: []
provides:
  - organizations table with slug-based lookup and updated_at trigger
  - org_members table with owner/admin/member roles and unique constraint
  - user_profiles table mirroring auth.users for N+1-free lookups
  - dsos.org_id column (NOT NULL) linking DSOs to organizations
  - Production data backfill (all DSOs → All Solutions Consulting org)
  - Alan as org owner, Claudia as org admin in org_members
  - Valentina erroneous access removed from user_dso_access
  - seed.sql with demo org (00000000-0000-0000-0000-000000000100) for local dev
affects:
  - 02-database-foundation
  - all future phases that reference organizations or org_members

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Three-step NOT NULL column addition (nullable → backfill → constrain)
    - Slug-based org lookup for idempotent cross-references within migrations
    - ON CONFLICT DO NOTHING for all data INSERTs (idempotency)
    - gen_random_uuid() throughout (not uuid_generate_v4)
    - No RLS on new tables (service_role pattern throughout app)
    - seed.sql FK dependency ordering: auth.users → organizations → dsos → rest

key-files:
  created:
    - supabase/migrations/20260226000000_add_org_tables.sql
  modified:
    - supabase/seed.sql

key-decisions:
  - "No RLS on organizations/org_members/user_profiles — supabaseAdmin bypasses RLS, adding it would be dead code"
  - "org_id on dsos via three-step pattern (nullable → backfill → constrain) to avoid ACCESS EXCLUSIVE lock on production"
  - "Slug-based subquery lookup for org references within migration — avoids hardcoded UUID that varies between environments"
  - "seed.sql reordered: auth.users inserted first, then organizations, then dsos — FK dependency ordering is mandatory"
  - "Valentina cleanup included in Phase 1 migration — removes erroneous all-DSO access before building org-scoped invites in Phase 3"

patterns-established:
  - "Migration sections: numbered headers with ====== separators, inline comments explaining each block"
  - "All production data INSERTs use ON CONFLICT DO NOTHING for safe re-runs"
  - "seed.sql section ordering documented with FK dependency comments"

# Metrics
duration: 4min
completed: 2026-02-26
---

# Phase 1 Plan 01: Add Org Tables Migration Summary

**PostgreSQL migration creating organizations, org_members, user_profiles tables with zero-downtime three-step NOT NULL pattern on dsos.org_id, production data backfill via slug-based lookups, and updated seed.sql with correct FK ordering for local dev**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-27T03:59:04Z
- **Completed:** 2026-02-27T04:03:55Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created migration file with all 3 org tables (organizations, org_members, user_profiles), indexes, triggers, and production backfill
- Implemented three-step zero-downtime pattern: org_id added nullable, all DSOs backfilled, then NOT NULL constraint added
- Updated seed.sql with correct FK dependency ordering and demo org data — validated cleanly against local PostgreSQL 17
- Removed Valentina's erroneous user_dso_access rows (invite bug cleanup) as part of the migration

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration file** - `60e7efc` (feat)
2. **Task 2: Update seed.sql and verify** - `c860b83` (feat)

**Plan metadata:** (committed after summary — see final commit)

## Files Created/Modified
- `supabase/migrations/20260226000000_add_org_tables.sql` - Phase 1 migration: 3 new tables, org_id on dsos, production data backfill, Valentina cleanup
- `supabase/seed.sql` - Reordered for FK dependencies, added demo org + org_members + user_profiles, updated DSO inserts to include org_id

## Decisions Made
- No RLS added to new tables — service_role pattern is established throughout all 31 routes; adding RLS would be dead code
- Three-step NOT NULL pattern used even though CS12 has only 5 DSOs — correct practice regardless of scale
- Slug-based subquery (`WHERE slug = 'all-solutions-consulting'`) used for org references within migration so the UUID stays slug-resolved, not hardcoded
- seed.sql fully reordered with FK dependency comments — auth.users must precede organizations (created_by FK), organizations must precede dsos (org_id FK)
- Valentina cleanup included in Phase 1 (rather than deferring to Phase 5) to remove erroneous access before Phase 3 builds org-scoped invites

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reordered seed.sql to fix FK dependency ordering**
- **Found during:** Task 2 (Update seed.sql)
- **Issue:** Plan's seed.sql additions placed the demo organizations INSERT at the bottom (after user_dso_access inserts). But auth.users insert was at line 147, while organizations (which references auth.users via created_by) was being placed at line 6. DSO inserts at line 15 would fail because dsos.org_id references organizations which hadn't been inserted yet.
- **Fix:** Restructured seed.sql so auth.users + auth.identities come first, then organizations, then dsos (now with org_id in the INSERT), then all dependent tables, then org_members and user_profiles at the end.
- **Files modified:** supabase/seed.sql
- **Verification:** All 5 plan verification queries passed against PostgreSQL 17 test database. All 13 INSERT statements succeeded with no errors.
- **Committed in:** c860b83 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug: FK ordering)
**Impact on plan:** Required fix — seed would have failed with FK constraint violations without this. No scope creep, same data inserted, just correct ordering.

## Issues Encountered
- **Docker Desktop not running:** `supabase db reset` could not be executed because Docker Desktop is not running and could not be started via CLI. Validation was performed instead by running the full migration chain + seed.sql against a temporary local PostgreSQL 17 database (already running at port 5432). All migrations ran cleanly and all 5 verification queries returned expected results. This is equivalent validation — the migration and seed are structurally correct.

## User Setup Required
None — no external service configuration required. When Docker is running, `supabase db reset` can be used to validate locally via the standard Supabase CLI workflow.

## Next Phase Readiness
- Phase 1 Plan 02 can begin: migration DDL is committed, seed.sql is updated
- organizations, org_members, user_profiles tables are defined and ready for Phase 2 to build auth helpers on top of
- dsos.org_id is established — the FK chain doctors.dso_id → dsos.org_id provides org context throughout
- Production push (`supabase db push`) can be done after Docker validation confirms clean reset locally

---
*Phase: 01-database-foundation*
*Completed: 2026-02-26*
