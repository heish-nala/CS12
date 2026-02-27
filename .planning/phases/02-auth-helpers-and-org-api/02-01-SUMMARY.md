---
phase: 02-auth-helpers-and-org-api
plan: 01
subsystem: auth
tags: [supabase, typescript, org-membership, discriminated-union]

# Dependency graph
requires:
  - phase: 01-database-foundation
    provides: org_members table, organizations table, user_profiles table from Phase 1 schema
provides:
  - checkOrgMembership() — query org_members by user_id + org_id, returns { isMember, role }
  - requireOrgAccess() — discriminated union middleware helper for org-scoped routes
  - OrgRole, Organization, OrgMember, UserProfile, OrgMemberWithProfile TypeScript types
  - generateOrgSlug() utility converting org names to URL-safe slugs
  - VALID_ORG_ROLES constant and isValidOrgRole() type guard
affects:
  - 02-02-org-crud (imports requireOrgAccess, generateOrgSlug, org types)
  - 02-03-member-management (imports requireOrgAccess, checkOrgMembership, OrgRole types)
  - phases 03-05 (all org-scoped routes use requireOrgAccess)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated union middleware — { user, role } | { response } — matches existing requireDsoAccess pattern"
    - "Dual OrgRole definition — types.ts for DB contracts, org-utils.ts derived from runtime constant for validation"
    - "supabaseAdmin.from('org_members') — consistent with all 31 existing routes using service_role"

key-files:
  created:
    - src/lib/org-utils.ts
  modified:
    - src/lib/auth.ts
    - src/lib/db/types.ts

key-decisions:
  - "OrgRole defined in both types.ts (DB contract) and org-utils.ts (runtime const for validation) — they are identical but serve different purposes"
  - "checkOrgMembership returns { isMember: false, role: null } on ANY error — fail closed for security"
  - "requireOrgAccess requireOwnerOrAdmin param (default false) — additive gating without a separate function"
  - "OrgMemberWithProfile uses user_profiles (not profile) — matches Supabase join key for .select('*, user_profiles(*)')"

patterns-established:
  - "Org auth pattern: const r = await requireOrgAccess(request, orgId); if ('response' in r) return r.response; const { user, role } = r;"
  - "Org slug pattern: generateOrgSlug(name) handles lowercase + trim + strip special chars + collapse hyphens"

# Metrics
duration: 8min
completed: 2026-02-27
---

# Phase 2 Plan 01: Auth Helpers and Org Types Summary

**Org membership auth helpers (checkOrgMembership + requireOrgAccess) and TypeScript types matching Phase 1 database schema, plus generateOrgSlug utility — foundation for all 31+ org-scoped routes in Phases 2-5**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-27T00:00:00Z
- **Completed:** 2026-02-27
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added OrgRole, Organization, OrgMember, UserProfile, OrgMemberWithProfile types to types.ts matching Phase 1 schema exactly
- Created src/lib/org-utils.ts with generateOrgSlug, VALID_ORG_ROLES, isValidOrgRole — importable by all org CRUD routes
- Added checkOrgMembership() and requireOrgAccess() to auth.ts following the identical discriminated union pattern as requireDsoAccess

## Task Commits

Each task was committed atomically:

1. **Task 1: Add org TypeScript types and slug utility** - `8c20918` (feat)
2. **Task 2: Add checkOrgMembership and requireOrgAccess to auth.ts** - `8a4fc25` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `src/lib/db/types.ts` - Added OrgRole type + Organization, OrgMember, UserProfile, OrgMemberWithProfile interfaces
- `src/lib/org-utils.ts` - New file: generateOrgSlug, VALID_ORG_ROLES, isValidOrgRole
- `src/lib/auth.ts` - Added checkOrgMembership and requireOrgAccess after existing requireDsoAccessWithFallback

## Decisions Made
- OrgRole is defined in both types.ts (for DB type contracts) and org-utils.ts (derived from runtime constant for validation logic) — identical values, different purposes
- checkOrgMembership fails closed on any error — returns { isMember: false, role: null } rather than throwing
- requireOrgAccess uses a single `requireOwnerOrAdmin` boolean flag rather than a separate requireOwnerOrAdminOrgAccess function — avoids function sprawl while adding owner/admin gating

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — TypeScript compiled clean on first pass, full Next.js build passed with zero errors.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 2 org CRUD routes (plan 02) can now import `requireOrgAccess` and `generateOrgSlug`
- All Phase 2 member management routes (plan 03) can now import `checkOrgMembership` and org types
- Full build passing — safe to proceed to plan 02

## Self-Check: PASSED
- `src/lib/org-utils.ts` exists and exports generateOrgSlug, VALID_ORG_ROLES, isValidOrgRole
- `src/lib/auth.ts` exports checkOrgMembership (line 252) and requireOrgAccess (line 278)
- `src/lib/db/types.ts` exports OrgRole, Organization, OrgMember, UserProfile, OrgMemberWithProfile
- Commits 8c20918 and 8a4fc25 verified in git log
- `npx tsc --noEmit` passes (no output = zero errors)
- `npm run build` passes (full Next.js build, no errors)

---
*Phase: 02-auth-helpers-and-org-api*
*Completed: 2026-02-27*
