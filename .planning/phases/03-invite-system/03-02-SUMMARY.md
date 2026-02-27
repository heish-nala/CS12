---
phase: 03-invite-system
plan: 02
subsystem: auth
tags: [supabase, invite, org-members, auth-context, otp, ssr]

# Dependency graph
requires:
  - phase: 03-01
    provides: org_invites table + ISO-04 bug fix (safe foundation for org-scoped invites)
  - phase: 02-01
    provides: requireOrgAccess, isValidOrgRole, org_members table helpers
provides:
  - POST /api/orgs/[id]/invites — org-scoped invite send (existing user direct-add, new user email)
  - GET /api/orgs/[id]/invites — list pending org invites
  - GET /auth/confirm — verifyOtp handler for invite email links, establishes session
  - POST /api/orgs/accept-invite — accept all pending org_invites for a user's email
  - auth-context checkAndAcceptOrgInvites — fires on SIGNED_IN, adds user to org_members
affects: [04-dso-scoping, 05-cutover]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - verifyOtp for Supabase invite links (not exchangeCodeForSession — PKCE unsupported for invites)
    - Dual-branch invite: existing users added directly to org_members, new users get email + org_invites row
    - Rollback pattern: delete org_invites row if inviteUserByEmail fails
    - Parallel invite acceptance: auth-context calls both checkAndAcceptInvites and checkAndAcceptOrgInvites on SIGNED_IN

key-files:
  created:
    - src/app/api/orgs/[id]/invites/route.ts
    - src/app/api/orgs/accept-invite/route.ts
    - src/app/auth/confirm/route.ts
  modified:
    - src/contexts/auth-context.tsx

key-decisions:
  - "verifyOtp (not exchangeCodeForSession) for invite links — Supabase does not support PKCE for type=invite"
  - "Existing users added directly to org_members, no inviteUserByEmail call — avoids Supabase error for registered users"
  - "inviteUserByEmail rollback on failure — delete org_invites row to prevent orphaned pending invites"
  - "Both checkAndAcceptInvites (team/DSO) and checkAndAcceptOrgInvites (org) share inviteCheckDone ref guard — fires together on SIGNED_IN"
  - "accept-invite queries by email, inserts by user_id — no cross-org leakage, invite scoped only to user's email"

patterns-established:
  - "Auth confirm route: use createServerClient with awaited cookies() from next/headers for session writes"
  - "Invite dual-branch: check user_profiles first; direct org_members insert if found; org_invites + email if not"

# Metrics
duration: 3min
completed: 2026-02-27
---

# Phase 3 Plan 02: Org Invite Send, Confirm, and Accept Summary

**Complete org-scoped invite flow: send endpoint with existing/new user branching, verifyOtp confirm route for invite email links, accept-invite endpoint, and auth-context integration**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-27T19:58:11Z
- **Completed:** 2026-02-27T20:01:07Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- POST /api/orgs/[id]/invites: owner/admin can invite by email — existing users added directly to org_members, new users get Supabase invite email with org_invites row; rollback on email failure; 409 on duplicate pending invite
- GET /auth/confirm: verifyOtp handler for invite email links establishes session correctly (not PKCE — Supabase unsupported for invite type)
- POST /api/orgs/accept-invite: accepts all pending non-expired org_invites for a user's email on SIGNED_IN; idempotent on duplicate membership
- auth-context updated to call checkAndAcceptOrgInvites alongside checkAndAcceptInvites on both initial load and SIGNED_IN

## Task Commits

Each task was committed atomically:

1. **Task 1: Create org invite send and list endpoints** - `b6d0e5f` (feat)
2. **Task 2: Create auth confirm route + accept-invite endpoint + auth-context integration** - `d19289a` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `src/app/api/orgs/[id]/invites/route.ts` - POST send invite (dual-branch) + GET list pending invites
- `src/app/auth/confirm/route.ts` - GET verifyOtp handler for invite email links
- `src/app/api/orgs/accept-invite/route.ts` - POST accept all pending org_invites by email
- `src/contexts/auth-context.tsx` - Added checkAndAcceptOrgInvites, called on SIGNED_IN

## Decisions Made
- **verifyOtp not exchangeCodeForSession**: Supabase invite links do not support PKCE flow; must use verifyOtp with token_hash + type
- **Existing users bypass email**: inviteUserByEmail fails for already-registered users; checking user_profiles first and direct-inserting into org_members avoids that error
- **Rollback on email failure**: if inviteUserByEmail errors after org_invites insert, the invite row is deleted to prevent orphaned pending records
- **Shared inviteCheckDone guard**: both team and org invite checks share the same per-user-id ref guard so they always fire together, preventing double-fire on token refresh

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- MBR-01 (admin can invite by email) and MBR-02 (invited user can accept and join) are complete
- Phase 3 invite system is fully built (Plans 01 + 02 both complete)
- Ready to proceed to Phase 4 (DSO scoping / org-context wiring)
- Note: inviteUserByEmail requires a valid Supabase email provider to be configured in production (default Supabase email works for local/staging)

---
*Phase: 03-invite-system*
*Completed: 2026-02-27*

## Self-Check: PASSED

- FOUND: src/app/api/orgs/[id]/invites/route.ts
- FOUND: src/app/auth/confirm/route.ts
- FOUND: src/app/api/orgs/accept-invite/route.ts
- FOUND: src/contexts/auth-context.tsx
- FOUND: .planning/phases/03-invite-system/03-02-SUMMARY.md
- FOUND commit: b6d0e5f (Task 1)
- FOUND commit: d19289a (Task 2)
