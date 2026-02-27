---
phase: 04-org-context-and-settings-ui
plan: 01
subsystem: api
tags: [nextjs, supabase, typescript, org-api, dso-access]

# Dependency graph
requires:
  - phase: 02-auth-helpers-and-org-api
    provides: requireOrgAccess middleware, org_members table, supabaseAdmin pattern
  - phase: 01-database-foundation
    provides: dsos table with org_id column, user_dso_access table
provides:
  - GET /api/orgs/[id]/dsos — org-scoped DSO listing (not user_dso_access filtered)
  - GET /api/orgs/[id]/dso-access — all user_dso_access rows for org's DSOs (admin/owner only)
  - POST /api/orgs/[id]/dso-access — grant member access to a DSO (admin/owner only)
  - DELETE /api/orgs/[id]/dso-access — revoke member's access to a DSO (admin/owner only)
affects:
  - 04-02-PLAN (OrgSettings component uses GET /api/orgs/[id]/dsos and GET /api/orgs/[id]/dso-access)
  - 04-03-PLAN (DSO assignment dialog uses POST/DELETE /api/orgs/[id]/dso-access)
  - 05-phase (these routes operate on user_dso_access bridge table, deprecated in Phase 5)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "org-scoped DSO listing pattern: query dsos WHERE org_id (not user_dso_access) for admin visibility"
    - "empty array guard before .in() query: avoids Supabase error on empty dsoIds"
    - "cross-org validation: validate DSO belongs to org before any access grant/revoke"
    - "user membership validation: validate user is org member before granting DSO access"

key-files:
  created:
    - src/app/api/orgs/[id]/dsos/route.ts
    - src/app/api/orgs/[id]/dso-access/route.ts
  modified: []

key-decisions:
  - "GET /api/orgs/[id]/dso-access requires owner/admin (not just member) — only admins manage assignments"
  - "GET /api/orgs/[id]/dsos requires only org membership — any member needs DSO list visibility"
  - "Empty dsoIds guard returns { access: [] } rather than running .in() with empty array"
  - "POST defaults role to 'viewer' (least-privilege) when not provided in body"
  - "DELETE uses URL search params for user_id and dso_id (consistent with Phase 2 REST convention)"
  - "Both write operations validate DSO belongs to org before touching user_dso_access (cross-org security)"
  - "POST validates user is org member before granting DSO access (prevents granting to outsiders)"

patterns-established:
  - "Pattern: org-scoped API routes always call requireOrgAccess(request, id) or requireOrgAccess(request, id, true)"
  - "Pattern: admin-only endpoints use requireOrgAccess(request, id, true) in all three handlers"
  - "Pattern: cross-resource validation (DSO in org) before any write to bridge tables"

# Metrics
duration: 2min
completed: 2026-02-27
---

# Phase 4 Plan 01: Org DSO API Routes Summary

**Two new org-scoped routes — org-level DSO listing and full user_dso_access CRUD — giving admins visibility and control over member DSO assignments without the user_dso_access filter blind spot.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-27T21:50:43Z
- **Completed:** 2026-02-27T21:52:21Z
- **Tasks:** 2
- **Files modified:** 2 (both new)

## Accomplishments
- Created `GET /api/orgs/[id]/dsos` — queries `dsos WHERE org_id` directly, not through `user_dso_access`, so admins see all org DSOs regardless of personal assignments
- Created `GET /api/orgs/[id]/dso-access` — fetches all `user_dso_access` rows for org's DSOs in a single query (avoids N+1 per member); guards against Supabase `.in()` error on empty array
- Created `POST /api/orgs/[id]/dso-access` — grants DSO access with cross-org validation (DSO must be in org, user must be org member) and duplicate detection (23505)
- Created `DELETE /api/orgs/[id]/dso-access` — revokes DSO access via URL search params, with same cross-org validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GET /api/orgs/[id]/dsos route** - `bd717ee` (feat)
2. **Task 2: Create GET/POST/DELETE /api/orgs/[id]/dso-access route** - `999a670` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `src/app/api/orgs/[id]/dsos/route.ts` - GET handler; org-scoped DSO listing not filtered by user_dso_access
- `src/app/api/orgs/[id]/dso-access/route.ts` - GET/POST/DELETE handlers; user_dso_access CRUD scoped to org

## Decisions Made
- GET /api/orgs/[id]/dso-access requires `requireOwnerOrAdmin=true` because the full member-to-DSO matrix is sensitive admin data — regular members don't need to see who else is assigned where
- GET /api/orgs/[id]/dsos only requires org membership (no admin flag) — any org member may need to see the DSO list (e.g., for their own context display)
- POST defaults role to `'viewer'` (least-privilege) when body omits role — consistent with Phase 2-03 POST defaulting org role to `'member'`
- DELETE reads params from URL search params to match Phase 2-03 REST convention (not from request body)
- Both POST and DELETE validate DSO belongs to org before any write — prevents cross-org data manipulation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `GET /api/orgs/[id]/dsos` ready for use by OrgSettings component (Phase 4 Plan 02/03)
- `GET /api/orgs/[id]/dso-access` ready for use by OrgSettings to build member-to-DSO lookup map
- `POST/DELETE /api/orgs/[id]/dso-access` ready for use by DSO assignment dialog (Phase 4 Plan 03)
- All routes follow the same requireOrgAccess pattern as all other org routes — no auth surprises

---
*Phase: 04-org-context-and-settings-ui*
*Completed: 2026-02-27*
