# Roadmap: CS12 Multi-Tenant Organization Layer

## Overview

CS12 is a live production app that currently manages DSO access at the user level via a flat `user_dso_access` table. This milestone lifts the access model one level up: DSOs belong to an organization, users belong to an organization, and admins control who sees which DSOs within their org. The build follows a strict dependency order — database first, auth helpers second, invite system third, UI context fourth, full route coverage last. Existing users (Alan, Claudia) must never lose access during the transition. Both access models run in parallel until all 31 routes are verified on the new system.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Database Foundation** - Create org tables, add org_id to DSOs, migrate existing data into a default org
- [ ] **Phase 2: Auth Helpers and Org API** - Extend lib/auth.ts with org helpers, build /api/orgs route group, enforce org-level roles
- [ ] **Phase 3: Invite System** - Fix existing DSO-scoping invite bug, then build org-scoped invite flow
- [ ] **Phase 4: Org Context and Settings UI** - OrgContext provider, org switcher in sidebar, org settings page
- [ ] **Phase 5: Scope All Routes and Full Isolation** - Update all 31 existing API routes to enforce org membership, filter DSOs by org, deprecate user_dso_access

## Phase Details

### Phase 1: Database Foundation
**Goal**: The database schema supports organizations — tables exist, DSOs belong to an org, and existing data is migrated so no production records are orphaned
**Depends on**: Nothing (first phase)
**Requirements**: DB-01, DB-02, DB-03, DB-04, DB-05, ORG-04, ISO-01
**Success Criteria** (what must be TRUE):
  1. `organizations`, `org_members`, and `user_profiles` tables exist in production Supabase with correct columns and indexes
  2. All 5 existing DSOs (NADG, 7to7, Smile Partners x2, Pure Smiles) have a non-null `org_id` pointing to Alan's default org
  3. Alan and Claudia appear in `org_members` for the default org with correct roles
  4. `user_dso_access` table still exists and all existing routes continue to work (zero downtime verified)
  5. Local migration runs cleanly via `supabase db reset` before production push
**Plans**: 2 plans
Plans:
- [ ] 01-01-PLAN.md — Write migration + update seed.sql + local verification
- [ ] 01-02-PLAN.md — Push to production + human verification (zero downtime)

### Phase 2: Auth Helpers and Org API
**Goal**: Every org operation has a secure, testable API endpoint, and every API route has access to org membership helpers that work the same way as the existing DSO access helpers
**Depends on**: Phase 1
**Requirements**: DB-06, ISO-03, MBR-07, MBR-08, ORG-01, ORG-02, ORG-03
**Success Criteria** (what must be TRUE):
  1. `requireOrgAccess()` and `checkOrgMembership()` helpers exist in `lib/auth.ts` and return consistent discriminated unions matching the existing helper pattern
  2. New user who signs up gets an organization auto-created (becomes owner) — verifiable via Supabase dashboard
  3. Organization has a name and unique slug — duplicate slugs are rejected with a 409 response
  4. Org owner can rename the organization via PATCH /api/orgs/[id] and the change persists on refresh
  5. Last owner cannot be removed — removing the sole owner returns a 403 with a clear error message
  6. Three org roles (owner, admin, member) are enforced — assigning an invalid role is rejected
**Plans**: TBD

### Phase 3: Invite System
**Goal**: An admin can invite a user to the organization by email, the invite is scoped only to that org (not all the inviter's DSOs), and the invited user can accept and join
**Depends on**: Phase 2
**Requirements**: MBR-01, MBR-02, ISO-04
**Success Criteria** (what must be TRUE):
  1. Inviting a new user creates an `org_invites` row scoped to the org — the invitee is NOT automatically granted access to all of the inviter's DSOs (existing bug is fixed)
  2. Invited user receives an email, clicks the link, logs in or signs up, and lands with correct org membership in `org_members`
  3. A user invited to Org A cannot see DSOs belonging to Org B
**Plans**: TBD

### Phase 4: Org Context and Settings UI
**Goal**: Users can see which organization they are in, admins can manage members and DSO assignments from a settings page, and the sidebar reflects the current org
**Depends on**: Phase 3
**Requirements**: UI-01, UI-02, UI-03
**Success Criteria** (what must be TRUE):
  1. Org settings page shows: org name, list of all members with their roles, and which DSOs each member is assigned to
  2. A member viewing the app can see exactly which DSOs they have access to — no DSOs from other orgs appear
  3. An admin can add or remove a member's access to a specific DSO from the settings page and the change takes effect immediately on next page load
**Plans**: TBD

### Phase 5: Scope All Routes and Full Isolation
**Goal**: Every data operation in the app — all 31 existing API routes — verifies org membership before returning any data, and DSO lists are filtered by the active org so no cross-org data is reachable
**Depends on**: Phase 4
**Requirements**: MBR-03, MBR-04, MBR-05, MBR-06, ISO-02
**Success Criteria** (what must be TRUE):
  1. An admin can assign a member to a specific DSO within the org — the member immediately sees that DSO in their sidebar
  2. An admin can remove a member's access to a specific DSO — the member can no longer navigate to that DSO
  3. An admin can remove a member from the org entirely — the member loses access to all DSOs in that org on next page load
  4. An admin can change a member's org-level role (e.g., member to admin) and the new role is enforced on the next API call
  5. A user cannot reach any DSO data by crafting a direct API request to a DSO they are not assigned to within the org
  6. `user_dso_access` is deprecated (flag set) and a cleanup migration is documented for the follow-on milestone
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Database Foundation | 0/2 | Planned | - |
| 2. Auth Helpers and Org API | 0/TBD | Not started | - |
| 3. Invite System | 0/TBD | Not started | - |
| 4. Org Context and Settings UI | 0/TBD | Not started | - |
| 5. Scope All Routes and Full Isolation | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-26*
*Requirements mapped: 25/25*
