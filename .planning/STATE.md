# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-26)

**Core value:** A team of customer success agents can manage a portfolio of DSOs within one organization, with admins controlling who has access to which DSOs
**Current focus:** Phase 5 in progress — 05-01 complete (auth helpers + PATCH member role handler)

## Current Position

Phase: 5 of 5 in progress (Scope All Routes and Full Isolation)
Plan: 1 of 3 complete in Phase 5
Status: 05-01 complete — requireOrgDsoAccess and getUserOrg helpers in lib/auth.ts; PATCH /api/orgs/[id]/members (MBR-06) with zero-owner guard
Last activity: 2026-02-28 — Completed 05-01: auth foundation helpers and PATCH member role handler

Progress: [██░░░░░░░░] ~33% (Phase 5, Plan 1 of 3 complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: ~5 min
- Total execution time: ~27 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-database-foundation | 2 | ~9 min | ~4.5 min |
| 02-auth-helpers-and-org-api | 3 | ~18 min | ~6 min |
| 03-invite-system | 2 (in progress) | ~5 min | ~2.5 min |
| 04-org-context-and-settings-ui | 3 (complete) | ~6 min | ~2 min |
| 05-scope-all-routes-and-full-isolation | 1 of 3 complete | ~2 min | ~2 min |

**Recent Trend:**
- Last 8 plans: 4 min, ~5 min, 8 min, ~2 min, ~8 min, ~2 min, ~3 min, ~2 min
- Trend: consistent ~4 min average

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
- [Phase 02-02]: Slug is a stable identifier — PATCH /api/orgs/[id] only updates name, never regenerates slug on rename
- [Phase 02-02]: DSO create uses .limit(1).single() on org_members — v1 single-org-per-user assumption, explicit not accidental
- [Phase 02-02]: 409 on duplicate slug (code 23505) — user-facing message says 'choose a different name' not expose constraint
- [Phase 02-03]: DELETE reads user_id from URL search params (?user_id=<uuid>) — REST convention, avoids body parsing on DELETE
- [Phase 02-03]: POST defaults role to 'member' when not provided — least-privilege default
- [Phase 02-03]: Signup trigger inserts user_profiles with ON CONFLICT DO NOTHING; seed.sql uses DO UPDATE to win
- [Phase 02-03]: Demo user gets two orgs in local dev (trigger-created "demo" slug + manual "demo-org") — slugs differ, no conflict, acceptable for testing
- [Phase 03-01]: ISO-04 bug fix — existing user invite now inserts only { user_id, dso_id, role } for the single requested DSO
- [Phase 03-01]: Accept-invite duplicate (23505) silently skipped — idempotent, correct for retry scenarios
- [Phase 03-01]: org_invites uses org_id FK (not dso_id) with org roles (owner/admin/member) — separate from team_invites
- [Phase 03-01]: No RLS on org_invites — consistent with Phase 1 supabaseAdmin bypass decision
- [Phase 03-01]: team_invites table and routes preserved — Phase 5 will deprecate old DSO-scoped model
- [Phase 03-02]: verifyOtp (not exchangeCodeForSession) for invite links — Supabase does not support PKCE for type=invite
- [Phase 03-02]: Existing users added directly to org_members, no inviteUserByEmail — avoids Supabase error for registered users
- [Phase 03-02]: inviteUserByEmail rollback on failure — delete org_invites row to prevent orphaned pending invites
- [Phase 03-02]: Both checkAndAcceptInvites (team/DSO) and checkAndAcceptOrgInvites (org) share inviteCheckDone ref guard
- [Phase 04-02]: OrgContext fetches /api/orgs (no user_id param) — route reads from session, matching server-side auth pattern
- [Phase 04-02]: v1 uses orgs[0] with console.warn for multi-org users — explicit v2 placeholder via MORG-02 comment
- [Phase 04-02]: OrgProvider placed inside ClientsProvider but wrapping OnboardingProvider — mirrors existing nesting convention
- [Phase 04-02]: Sidebar falls back to 'CS12' when org is null — handles loading state and edge case gracefully
- [Phase 04-01]: GET /api/orgs/[id]/dso-access requires owner/admin; GET /api/orgs/[id]/dsos requires only org membership
- [Phase 04-01]: Empty dsoIds guard returns { access: [] } before .in() query to avoid Supabase error
- [Phase 04-01]: POST /api/orgs/[id]/dso-access validates DSO belongs to org AND user is org member before insert (cross-org security)
- [Phase 04-01]: DELETE /api/orgs/[id]/dso-access uses URL search params for user_id and dso_id (Phase 2 REST convention)
- [Phase 04-03]: canManage derives from org.role via useOrg() — NOT hardcoded — satisfies UI-03 role gating requirement
- [Phase 04-03]: Admin/owner fetches all 3 endpoints in parallel; member fetches only members list (least-privilege fetch pattern)
- [Phase 04-03]: DsoAssignmentDialog computes toAdd/toRemove diff before saving — only touches changed assignments via Promise.all
- [Phase 04-03]: 409 on duplicate add is possible if UI gets out of sync; handled by onSave refetch
- [Phase 05-01]: requireOrgDsoAccess preserves user_id body fallback — fallback userId gets same org+DSO checks as session users
- [Phase 05-01]: getUserOrg uses .limit(1).single() — explicit v1 single-org-per-user assumption

### Pending Todos

None yet.

### Blockers/Concerns

- **Phase 5 pre-work**: 31 routes need individual audit before Phase 5 planning — complexity varies. Research flags this as needing a route inventory pass. Flag for plan-phase to address.
- **Open product decision**: Does org membership grant access to all DSOs in the org, or does per-DSO access control (user_dso_access) remain permanent? If permanent, Phase 5 is more nuanced. Resolve before Phase 5 planning begins.
- **Local Supabase / Docker**: Docker Desktop is not running on this machine. supabase db reset could not be run. Validation was performed against local PostgreSQL 17 instead. When Docker is available, run supabase db reset to confirm with full Supabase CLI stack.
- **Valentina cleanup**: RESOLVED — Valentina's erroneous user_dso_access rows deleted in 20260226000000_add_org_tables.sql migration.
- **Phase 3 pre-condition**: RESOLVED — Invite bug (ISO-04) fixed in 03-01. Safe to build org-scoped invites in 03-02.

## Session Continuity

Last session: 2026-02-28
Stopped at: Completed 05-01-PLAN.md — requireOrgDsoAccess, getUserOrg, PATCH /api/orgs/[id]/members
Resume file: None — ready for 05-02-PLAN.md (Category A route migrations)
