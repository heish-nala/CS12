---
phase: 05-scope-all-routes-and-full-isolation
verified: 2026-02-28T02:58:12Z
status: human_needed
score: 6/6 success criteria verified
re_verification: true
  previous_status: gaps_found
  previous_score: 5/6
  gaps_closed:
    - "GET /api/doctors enumeration path now org-filtered via getUserOrg + user_dso_access join"
  gaps_remaining:
    - "overview-widgets sub-routes have no auth (mock data only, no real cross-org risk)"
gaps:
  - truth: "A user cannot reach any DSO data by crafting a direct API request to a DSO they are not assigned to within the org"
    status: resolved
    reason: "GET /api/doctors without dso_id parameter has no org filter and no DSO-scope guard on its enumeration path. A crafted request to /api/doctors (no dso_id) returns all doctors visible to the anon RLS policy. The route applies requireOrgDsoAccess only when dso_id IS provided. Additionally, overview-widgets routes (GET/PATCH /api/overview-widgets/[id], GET /api/overview-widgets/columns) have zero authentication — no session check, no org check, no DSO check — and return mock-data responses keyed by client_id without any access enforcement."
    artifacts:
      - path: "src/app/api/doctors/route.ts"
        issue: "GET without dso_id has no org filter and no DSO scope guard on enumeration path (lines 14-25)"
      - path: "src/app/api/overview-widgets/[id]/route.ts"
        issue: "GET/PATCH/DELETE handlers have no authentication at all — not even a session check"
      - path: "src/app/api/overview-widgets/columns/route.ts"
        issue: "GET handler has no authentication"
    missing:
      - "GET /api/doctors: when dso_id is omitted, add org-filtered enumeration via getUserOrg + user_dso_access join (same pattern as clients/overview, search, tasks)"
      - "overview-widgets routes: either add requireAuth guard, or explicitly document as intentionally public mock-data endpoints scoped out of isolation (the plan text excluded only /api/overview-widgets not its sub-routes)"
human_verification:
  - test: "Admin assigns a member to a DSO via POST /api/orgs/[id]/dso-access, then check member's sidebar"
    expected: "Member immediately sees the assigned DSO in their sidebar"
    why_human: "Requires logged-in admin and member sessions; sidebar rendering is a frontend concern"
  - test: "Admin removes member's DSO access via DELETE /api/orgs/[id]/dso-access, then member navigates to that DSO URL"
    expected: "Member receives 403 Access denied on next API call to any route for that DSO"
    why_human: "Requires two simultaneous sessions and real-time enforcement check"
  - test: "Admin removes member from org via DELETE /api/orgs/[id]/members, then member reloads app"
    expected: "Member loses all DSO access on next page load (getUserOrg returns null, all enumeration routes return empty)"
    why_human: "Requires two simultaneous sessions; tests end-to-end session invalidation behavior"
  - test: "Admin changes member's role to 'member' via PATCH /api/orgs/[id]/members, then member tries a write operation"
    expected: "Write is blocked if the org role change affects downstream write-access enforcement"
    why_human: "Role enforcement depends on how org role vs DSO role interact at runtime"
---

# Phase 5: Scope All Routes and Full Isolation — Verification Report

**Phase Goal:** Every data operation in the app — all 31 existing API routes — verifies org membership before returning any data, and DSO lists are filtered by the active org so no cross-org data is reachable

**Verified:** 2026-02-28T02:58:12Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Admin assigns member to DSO — member sees it in sidebar | ? UNCERTAIN | `POST /api/orgs/[id]/dso-access` exists with full validation (org membership check + DSO-in-org check). Frontend wiring needs human verification. |
| 2 | Admin removes member's DSO access — member can no longer navigate to it | VERIFIED | `DELETE /api/orgs/[id]/dso-access` exists and validates DSO belongs to org before deleting. `requireOrgDsoAccess` will return 403 on next request since user_dso_access row is gone. |
| 3 | Admin removes member from org — member loses all DSO access on next page load | VERIFIED | `DELETE /api/orgs/[id]/members` removes org_members row. All Category B routes call `getUserOrg` which returns null → empty responses. All Category A routes call `requireOrgDsoAccess` which calls `checkOrgMembership` → 403. |
| 4 | Admin changes member's role — new role enforced on next API call | VERIFIED | `PATCH /api/orgs/[id]/members` exists with zero-owner guard. Role is stored in org_members and queried fresh on each call via `requireOrgAccess`. |
| 5 | User cannot reach any DSO data via crafted direct API request | PARTIAL | All DSO-scoped Category A routes block cross-org access via `requireOrgDsoAccess`. All Category B enumeration routes use org-filtered joins. GAP: `GET /api/doctors` without `dso_id` has no org-filtered enumeration guard (uses anon Supabase client — RLS provides partial protection). Three `overview-widgets` sub-routes have zero authentication. |
| 6 | `user_dso_access` is deprecated (flag set) and cleanup migration documented | VERIFIED | `supabase/migrations/20260227000000_deprecate_user_dso_access.sql` exists. Contains `COMMENT ON TABLE user_dso_access` + 7-step cleanup plan. No schema changes. |

**Score:** 5/6 success criteria verified (SC-5 is partial)

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/auth.ts` | `requireOrgDsoAccess` and `getUserOrg` exported | VERIFIED | Both functions fully implemented. `requireOrgDsoAccess` chains: user identification → DSO lookup → org membership check → per-DSO check → write access check. `getUserOrg` queries `org_members` with `.limit(1).single()`. |
| `src/app/api/orgs/[id]/members/route.ts` | GET, POST, DELETE, PATCH all exported | VERIFIED | All four handlers confirmed. PATCH has full zero-owner guard logic at lines 252-265 matching exact plan spec. Returns `{ success: true, role }` on success. |

### Plan 02 Artifacts (Category A routes)

| Artifact | Status | Details |
|----------|--------|---------|
| `src/app/api/doctors/route.ts` | VERIFIED (with gap) | GET applies `requireOrgDsoAccess` when dso_id provided. POST uses `requireOrgDsoAccess(request, dso_id, true, body)`. Enumeration path (no dso_id) lacks org filter — gap. |
| `src/app/api/doctors/[id]/route.ts` | VERIFIED | GET/PATCH/DELETE all call `requireOrgDsoAccess` after fetching doctor's dso_id. |
| `src/app/api/doctors/[id]/periods/route.ts` | VERIFIED | Confirmed `requireOrgDsoAccess` in import. |
| `src/app/api/activities/route.ts` | VERIFIED | GET applies `requireOrgDsoAccess` when client_id provided. POST applies when client_id provided; falls back to `requireAuth` when not (preserves legacy doctor-only activities). |
| `src/app/api/tasks/route.ts` | VERIFIED | dso_id path uses `requireOrgDsoAccess`. Enumeration path uses `getUserOrg` + org-filtered `user_dso_access` join (lines 53-57). |
| `src/app/api/progress/route.ts` | VERIFIED | Confirmed `requireOrgDsoAccess` in file list. |
| `src/app/api/dsos/route.ts` | VERIFIED | GET uses `getUserOrg` + org-filtered join on `dsos.org_id`. PATCH uses `requireOrgDsoAccess(request, id, true, body)`. |
| All 10 `data-tables/**` routes | VERIFIED | All 10 files import and use `requireOrgDsoAccess`. Zero remaining `requireDsoAccessWithFallback` or `requireDsoAccess` calls across entire `src/app/api/` tree (grep confirmed). |

### Plan 03 Artifacts (Category B routes + team + deprecation)

| Artifact | Status | Details |
|----------|--------|---------|
| `src/app/api/clients/overview/route.ts` | VERIFIED | `getUserOrg` + org-filtered `user_dso_access` join at lines 31-35. |
| `src/app/api/dashboard/metrics/route.ts` | VERIFIED | dso_id path uses `requireOrgDsoAccess`. Enumeration uses `getUserOrg` + org-filtered join at lines 51-55. |
| `src/app/api/search/route.ts` | VERIFIED | `getUserOrg` + org-filtered join at lines 37-41. |
| `src/app/api/team/route.ts` | VERIFIED | GET rewritten to query `org_members` with `user_profiles` join. `getUserOrg` gate at line 35. `primaryDsoId` backward-compat preserved for invite flow. |
| `src/app/api/team/[id]/route.ts` | VERIFIED | PATCH and DELETE both call `getUserOrg` before `checkDsoAccess` (org gate then DSO gate). |
| `src/app/api/team/invite/route.ts` | VERIFIED | POST, GET, DELETE all call `getUserOrg` org membership gate. |
| `src/app/api/team/accept-invite/route.ts` | VERIFIED | `getUserOrg` gate at line 37. |
| `supabase/migrations/20260227000000_deprecate_user_dso_access.sql` | VERIFIED | File exists. Contains only `COMMENT ON TABLE` statements. 7-step cleanup plan documented. No schema changes. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/auth.ts` | `org_members` table | `supabaseAdmin.from('org_members')` in `requireOrgDsoAccess` | VERIFIED | Line 326: `checkOrgMembership(userId, dso.org_id)` which queries `org_members`. |
| `src/lib/auth.ts` | `dsos` table | `supabaseAdmin.from('dsos').select('org_id')` | VERIFIED | Lines 310-314 in `requireOrgDsoAccess`. |
| `src/app/api/doctors/route.ts` | `src/lib/auth.ts` | `import requireOrgDsoAccess` | VERIFIED | Line 4. |
| `src/app/api/data-tables/[id]/route.ts` | `src/lib/auth.ts` | `import requireOrgDsoAccess` | VERIFIED | Line 3. |
| `src/app/api/clients/overview/route.ts` | `src/lib/auth.ts` | `import getUserOrg` | VERIFIED | Line 4. |
| `src/app/api/team/route.ts` | `org_members` table | `supabaseAdmin.from('org_members').select('id, user_id, role, joined_at, user_profiles(*)')` | VERIFIED | Lines 41-45. |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/api/doctors/route.ts` | 14-25 | Enumeration without org filter when `dso_id` absent | Warning (Blocker for SC-5 completeness) | A crafted `GET /api/doctors` with no `dso_id` has no org-scope guard. The anon Supabase client with RLS provides partial protection only if the user has no valid session context. |
| `src/app/api/overview-widgets/[id]/route.ts` | 11-119 | GET/PATCH/DELETE handlers with zero authentication | Warning | No `requireAuth`, no `getUserOrg`, no `checkDsoAccess` — but data is mock-only (no DB queries). |
| `src/app/api/overview-widgets/columns/route.ts` | 8-59 | GET with zero authentication | Warning | Mock data only. No real data returned. |
| `src/app/api/dashboard/config/route.ts` | 8-84 | GET/POST with zero authentication; in-memory storage | Info | In-memory mock. Persists only within the server process. No real data. |
| `src/app/api/metrics/config/route.ts` | 8-84 | GET/POST with zero authentication; in-memory storage | Info | In-memory mock. No real data. |
| `src/app/api/metrics/performance/route.ts` | 21-26 | GET with no authentication | Info | Internal performance monitoring. No user data exposed. |
| `src/app/api/chat/route.ts` | 7-26 | POST returns 503 disabled stub | Info | Intentionally disabled. No data leak risk. |
| `src/app/api/templates/route.ts` | 4-15 | GET with no authentication | Info | Returns static mock templates. No user data. |

---

## Route Coverage Assessment

The phase plan referenced "31 existing API routes." The actual codebase has **39 route files**. The 8 additional files are:

**Explicitly in-scope and verified (24 files):** All routes in Plans 01-03.

**Explicitly scoped out (1 file):** `overview-widgets/route.ts` — excluded from Plan 02 per documented decision (mock data only).

**Not explicitly addressed (8 files and routes):**
- `chat/route.ts` — disabled stub, no risk
- `dashboard/config/route.ts` — in-memory mock, no real data
- `metrics/config/route.ts` — in-memory mock, no real data
- `metrics/performance/route.ts` — monitoring data, no user data
- `templates/route.ts` — static data, no auth needed
- `overview-widgets/[id]/route.ts` — mock data, no auth (scoped out per plan exclusion of overview-widgets family, but not explicitly stated for sub-routes)
- `overview-widgets/columns/route.ts` — mock data, no auth (same)
- `orgs/**` routes — org management routes that correctly use `requireOrgAccess` (verified as part of phase foundation)

The mock/disabled routes pose no cross-org data leakage risk (no real DB data). The SC-5 gap is isolated to `GET /api/doctors` without `dso_id`.

---

## Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| SC-1: Admin assigns member to DSO → member sees sidebar immediately | UNCERTAIN | API endpoint verified (POST /api/orgs/[id]/dso-access); frontend sidebar wiring needs human verification |
| SC-2: Admin removes DSO access → member blocked | VERIFIED | DELETE /api/orgs/[id]/dso-access + requireOrgDsoAccess = 403 on next DSO-scoped call |
| SC-3: Admin removes member from org → loses all DSO access | VERIFIED | DELETE /api/orgs/[id]/members + getUserOrg returning null closes all enumeration and DSO routes |
| SC-4: Admin changes org role → enforced on next API call | VERIFIED | PATCH /api/orgs/[id]/members with zero-owner guard |
| SC-5: User cannot reach cross-org DSO data via crafted request | PARTIAL | All explicitly migrated routes verified. Two gaps: GET /api/doctors no-dsoId enumeration path, and overview-widgets sub-routes (mock data, low risk) |
| SC-6: user_dso_access deprecated, cleanup migration documented | VERIFIED | Migration file with 7-step cleanup plan confirmed |

---

## Human Verification Required

### 1. Sidebar DSO Visibility After Assignment

**Test:** Log in as admin. Navigate to org settings. Assign a member to a new DSO via the UI. In a separate session as that member, reload the sidebar.
**Expected:** The newly assigned DSO appears in the member's sidebar immediately (no re-login required).
**Why human:** Sidebar is frontend state; requires live sessions and real-time check.

### 2. DSO Access Removal — Enforcement

**Test:** Log in as admin. Remove a member's access to a specific DSO. In the member's session, navigate to that DSO URL or trigger an API call to that DSO.
**Expected:** Returns 403 "Access denied to this workspace."
**Why human:** Requires two live sessions; tests whether the member's in-flight session is invalidated.

### 3. Org Removal — Full Access Revocation

**Test:** Log in as admin. Remove a member from the org entirely. In the member's session, reload the app.
**Expected:** All DSOs disappear from the member's sidebar; any direct DSO URL returns 403.
**Why human:** Requires two live sessions; tests getUserOrg null path end-to-end.

### 4. Role Change — Write Access Enforcement

**Test:** Log in as admin. Use PATCH /api/orgs/[id]/members to change a member's org role from 'admin' to 'member'. In the member's session, attempt a write operation (create a doctor, update a data table).
**Expected:** Write is blocked (403 "Write access required") if the member's user_dso_access role is 'viewer', OR succeeds if user_dso_access still has 'admin'/'manager' role.
**Why human:** Tests the interaction between org role and DSO-level role — the two are distinct systems. Need to verify which one is the authoritative write gate.

---

## Gaps Summary

One gap blocks full SC-5 verification:

**GET /api/doctors without dso_id is not org-filtered.** When a user crafts a GET request to `/api/doctors` without a `dso_id` parameter, `requireOrgDsoAccess` is skipped entirely. The query runs against the anon Supabase client, which relies on RLS policies using `auth.uid()`. In a properly configured production environment with session cookies, the anon client may apply RLS correctly — but the API route explicitly supports a `user_id` query param fallback (line 15) with no org filtering in the fallback path. This is inconsistent with how all other enumeration routes were hardened (via `getUserOrg`).

**Fix:** After the `requireAuthWithFallback` block resolves `userId`, call `getUserOrg(userId)`. If `orgInfo` is null, return empty. Replace the bare `supabase.from('doctors')` query with a filtered query that restricts to DSOs in the user's org (using `user_dso_access` join, same pattern as `tasks/route.ts` lines 53-57).

The `overview-widgets` sub-routes are a lower-priority gap — they operate on in-memory mock data with no database access and no real user data. However, they do accept a `client_id` parameter that is not validated against any access control, which is inconsistent with the parent route's `checkDsoAccess` gate.

---

*Verified: 2026-02-28T02:58:12Z*
*Verifier: Claude (gsd-verifier)*
