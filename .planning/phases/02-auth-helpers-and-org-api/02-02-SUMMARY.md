---
phase: 02-auth-helpers-and-org-api
plan: 02
subsystem: api
tags: [nextjs, supabase, organizations, crud, typescript]

# Dependency graph
requires:
  - phase: 02-01
    provides: requireAuth, requireOrgAccess, checkOrgMembership, generateOrgSlug, OrgRole types

provides:
  - GET /api/orgs — list organizations the authenticated user belongs to with role
  - POST /api/orgs — create organization with unique slug, insert creator as owner, 409 on duplicate
  - GET /api/orgs/[id] — get org detail for members only
  - PATCH /api/orgs/[id] — rename org (owner/admin only, slug unchanged)
  - Fixed POST /api/dsos — now includes org_id by looking up user's org membership

affects:
  - phase-04-org-context-provider (GET /api/orgs consumed by org context)
  - phase-05-route-audit (DSO creation now correctly scoped to org)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Org CRUD routes follow same supabaseAdmin + requireAuth pattern as existing DSO routes"
    - "Rollback pattern: delete parent if child insert fails (org_members rollback deletes org)"
    - "Stable slugs: PATCH /api/orgs/[id] only updates name, never regenerates slug"
    - "v1 single-org assumption: DSO create uses .limit(1).single() on org_members lookup"

key-files:
  created:
    - src/app/api/orgs/route.ts
    - src/app/api/orgs/[id]/route.ts
  modified:
    - src/app/api/dsos/route.ts

key-decisions:
  - "Slug is a stable identifier — PATCH /api/orgs/[id] only updates name, never regenerates slug on rename"
  - "DSO create uses .limit(1).single() on org_members — v1 single-org-per-user assumption, explicit not accidental"
  - "409 on duplicate slug (code 23505) — user-facing message says 'choose a different name' not expose constraint"

patterns-established:
  - "requireOrgAccess(request, id, true) — boolean flag for owner/admin check, same pattern as existing requireDsoAccess"
  - "Rollback pattern: delete org if org_members insert fails — mirrors dsos/user_dso_access pattern"

# Metrics
duration: 2min
completed: 2026-02-27
---

# Phase 2 Plan 02: Org API Routes Summary

**Organization CRUD API (GET/POST list+create, GET/PATCH detail+rename) and Phase 1 gap closure — POST /api/dsos now includes org_id**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-27T14:55:49Z
- **Completed:** 2026-02-27T14:57:32Z
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- GET and POST /api/orgs route: list user's orgs with role, create org with unique slug and owner membership
- GET and PATCH /api/orgs/[id] route: org detail for members, rename for owner/admin only (slug stays stable)
- POST /api/dsos fixed: looks up user's org via org_members and includes org_id in insert, closing the Phase 1 NOT NULL violation gap

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /api/orgs route (GET list + POST create)** - `387fc1f` (feat)
2. **Task 2: Create /api/orgs/[id] route (GET detail + PATCH rename)** - `559c7be` (feat)
3. **Task 3: Fix POST /api/dsos to include org_id** - `fc4323a` (fix)

## Files Created/Modified
- `src/app/api/orgs/route.ts` — GET lists user's org memberships with role; POST creates org + owner member row; 409 on slug collision; rollback on failed org_members insert
- `src/app/api/orgs/[id]/route.ts` — GET returns org detail (members only); PATCH renames org (owner/admin only); uses Next.js 16 async params
- `src/app/api/dsos/route.ts` — POST now queries org_members for user's org_id before inserting DSO; returns 400 if user has no org

## Decisions Made
- Slug is a stable identifier: PATCH only updates `name`, never regenerates the slug. Changing slug would break any bookmarks or integrations using slug-based URLs.
- DSO create uses `.limit(1).single()` on org_members — makes the v1 single-org assumption explicit in code rather than accidental.
- 409 response for duplicate slug uses a human-readable message ("choose a different name") — does not expose the constraint name.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- GET /api/orgs is ready for Phase 4 org context provider consumption
- POST /api/dsos gap is closed — creating a DSO now correctly includes org scoping
- PATCH /api/orgs/[id] enforces owner/admin — Phase 3 org-scoped invites can rely on this access pattern

---
*Phase: 02-auth-helpers-and-org-api*
*Completed: 2026-02-27*

## Self-Check: PASSED

- FOUND: src/app/api/orgs/route.ts
- FOUND: src/app/api/orgs/[id]/route.ts
- FOUND: 02-02-SUMMARY.md
- FOUND commit 387fc1f (feat: GET/POST /api/orgs)
- FOUND commit 559c7be (feat: GET/PATCH /api/orgs/[id])
- FOUND commit fc4323a (fix: org_id in POST /api/dsos)
