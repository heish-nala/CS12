# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-26)

**Core value:** A team of customer success agents can manage a portfolio of DSOs within one organization, with admins controlling who has access to which DSOs
**Current focus:** Phase 2 — Auth Helpers and Org API

## Current Position

Phase: 2 of 5 (Auth Helpers and Org API)
Plan: 1 of 3 complete in current phase
Status: In progress — 02-01 complete, proceed with 02-02 (org CRUD routes)
Last activity: 2026-02-27 — Completed 02-01: org auth helpers, types, and slug utility

Progress: [███░░░░░░░] 30%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 5.7 min
- Total execution time: ~17 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-database-foundation | 2 | ~9 min | ~4.5 min |
| 02-auth-helpers-and-org-api | 1 | 8 min | 8 min |

**Recent Trend:**
- Last 5 plans: 4 min, ~5 min, 8 min
- Trend: (baseline)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Arch]: Service_role + application-level auth throughout — NOT RLS-first. All 31 routes use supabaseAdmin; new org routes follow the same pattern. RLS-first is a future separate milestone.
- [Arch]: Org stored in context/localStorage — NOT in URL segments. Avoids refactoring all 31 route fetch calls for this milestone.
- [Constraint]: Zero-downtime required — user_dso_access must stay in place until ALL 31 routes are verified on the new org model (Phase 5).
- [Risk]: Existing invite bug (inviter's ALL DSOs granted on invite) must be fixed in Phase 3 BEFORE building org-scoped invites, or it becomes a cross-org data leak.
- [Risk]: ADD COLUMN NOT NULL on live dsos table requires three-step pattern: add nullable → backfill → constrain separately.
- [Phase 01-database-foundation]: No RLS on organizations/org_members/user_profiles — supabaseAdmin bypasses RLS, dead code
- [Phase 01-database-foundation]: Three-step NOT NULL pattern on dsos.org_id to avoid ACCESS EXCLUSIVE lock on production
- [Phase 01-database-foundation]: Slug-based subquery for org references within migration — avoids hardcoded UUID
- [Phase 01-database-foundation]: Valentina cleanup in Phase 1 — removes erroneous access before Phase 3 builds org-scoped invites
- [Phase 01-02]: Zero downtime confirmed — new tables + org_id column addition did not affect any existing routes or queries
- [Phase 02-01]: OrgRole defined in both types.ts (DB contract) and org-utils.ts (runtime const for validation) — identical values, different purposes
- [Phase 02-01]: checkOrgMembership fails closed — returns { isMember: false, role: null } on any error rather than throwing
- [Phase 02-01]: requireOrgAccess uses requireOwnerOrAdmin boolean flag (not a separate function) — avoids function sprawl
- [Phase 02-01]: OrgMemberWithProfile uses user_profiles key — matches Supabase join key for .select('*, user_profiles(*)')

### Pending Todos

None yet.

### Blockers/Concerns

- **Phase 5 pre-work**: 31 routes need individual audit before Phase 5 planning — complexity varies. Research flags this as needing a route inventory pass. Flag for plan-phase to address.
- **Open product decision**: Does org membership grant access to all DSOs in the org, or does per-DSO access control (user_dso_access) remain permanent? If permanent, Phase 5 is more nuanced. Resolve before Phase 5 planning begins.
- **Local Supabase / Docker**: Docker Desktop is not running on this machine. supabase db reset could not be run. Validation was performed against local PostgreSQL 17 instead. When Docker is available, run supabase db reset to confirm with full Supabase CLI stack.
- **Valentina cleanup**: RESOLVED — Valentina's erroneous user_dso_access rows deleted in 20260226000000_add_org_tables.sql migration.

## Session Continuity

Last session: 2026-02-27
Stopped at: Completed 02-01-PLAN.md — org auth helpers, TypeScript types, slug utility
Resume file: None — proceed with 02-02 (org CRUD routes)
