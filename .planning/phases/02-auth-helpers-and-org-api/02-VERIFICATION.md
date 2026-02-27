---
phase: 02-auth-helpers-and-org-api
verified: 2026-02-27T15:00:56Z
status: passed
score: 6/6 must-haves verified
re_verification: false
---

# Phase 2: Auth Helpers and Org API Verification Report

**Phase Goal:** Every org operation has a secure, testable API endpoint, and every API route has access to org membership helpers that work the same way as the existing DSO access helpers
**Verified:** 2026-02-27T15:00:56Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `requireOrgAccess()` and `checkOrgMembership()` exist in `lib/auth.ts` and return consistent discriminated unions matching the existing helper pattern | VERIFIED | Both functions present at lines 252 and 278; return type `{ user: AuthUser; role: string; response?: never } \| { user?: never; role?: never; response: NextResponse }` matches `requireDsoAccess` exactly |
| 2 | New user who signs up gets an organization auto-created (becomes owner) — verifiable via Supabase dashboard | VERIFIED (DB only) | `supabase/migrations/20260227000001_org_signup_trigger.sql` creates `handle_new_user_signup()` with `AFTER INSERT ON auth.users` trigger; inserts into `organizations` + `org_members` with role `owner` |
| 3 | Organization has a name and unique slug — duplicate slugs are rejected with a 409 response | VERIFIED | `POST /api/orgs` generates slug via `generateOrgSlug()`, checks `error.code === '23505'` and returns status 409 (lines 54-76 of `orgs/route.ts`) |
| 4 | Org owner can rename the organization via `PATCH /api/orgs/[id]` and the change persists on refresh | VERIFIED | `PATCH /api/orgs/[id]` calls `requireOrgAccess(request, id, true)` then `supabaseAdmin.from('organizations').update({ name })` — only name changes (slug stable), returns updated org |
| 5 | Last owner cannot be removed — removing the sole owner returns a 403 with a clear error message | VERIFIED | `DELETE /api/orgs/[id]/members` contains zero-owner guard: counts owners, returns 403 with `"Cannot remove the last owner of an organization. Transfer ownership first."` (line 168) |
| 6 | Three org roles (owner, admin, member) are enforced — assigning an invalid role is rejected | VERIFIED | `VALID_ORG_ROLES = ['owner', 'admin', 'member']` in `org-utils.ts`; `isValidOrgRole()` used in `POST /api/orgs/[id]/members` line 76 — returns 400 on invalid role |

**Score: 6/6 truths verified**

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/auth.ts` | `checkOrgMembership` and `requireOrgAccess` exported | VERIFIED | Both present; `checkOrgMembership` at line 252, `requireOrgAccess` at line 278; query `supabaseAdmin.from('org_members')` confirmed |
| `src/lib/db/types.ts` | `OrgRole`, `Organization`, `OrgMember`, `UserProfile`, `OrgMemberWithProfile` types | VERIFIED | All 5 types present under `// ORGANIZATION TYPES (Phase 2)` section (lines 499-529); `OrgRole = 'owner' \| 'admin' \| 'member'` at line 9 |
| `src/lib/org-utils.ts` | `generateOrgSlug`, `VALID_ORG_ROLES`, `isValidOrgRole` exports | VERIFIED | All 3 exports present; slug function converts names to lowercase hyphenated strings |
| `src/app/api/orgs/route.ts` | `GET` and `POST` handlers | VERIFIED | Both exported; GET queries org_members joined with organizations; POST creates org + inserts owner |
| `src/app/api/orgs/[id]/route.ts` | `GET` and `PATCH` handlers | VERIFIED | Both exported; PATCH uses `requireOrgAccess(request, id, true)` for owner/admin only |
| `src/app/api/orgs/[id]/members/route.ts` | `GET`, `POST`, `DELETE` handlers with zero-owner guard | VERIFIED | All three exported; DELETE has zero-owner guard at line 159-172 |
| `src/app/api/dsos/route.ts` | `POST` includes `org_id` from user's org (Phase 1 gap fix) | VERIFIED | Queries `org_members` for `user_id`, includes `org_id: membership.org_id` in dsos insert at line 140 |
| `supabase/migrations/20260227000001_org_signup_trigger.sql` | `handle_new_user_signup()` function + `AFTER INSERT ON auth.users` trigger | VERIFIED | Migration present; trigger named `on_auth_user_created`; `SECURITY DEFINER`; slug uniqueness loop with counter; inserts org + owner member + user_profiles |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/auth.ts` | `org_members` table | `supabaseAdmin.from('org_members')` | WIRED | Line 258: `.from('org_members').select('role').eq('user_id', userId).eq('org_id', orgId)` |
| `src/lib/auth.ts` | `getAuthUser` → `checkOrgMembership` | `requireOrgAccess` calls both in sequence | WIRED | Lines 286-297: `getAuthUser(request)` then `checkOrgMembership(user.id, orgId)` |
| `src/app/api/orgs/route.ts` | `src/lib/auth.ts` | `requireAuth` import | WIRED | Line 3: `import { requireAuth } from '@/lib/auth'`; called in both handlers |
| `src/app/api/orgs/route.ts` | `org_members` table | `supabaseAdmin.from('org_members').insert` after org creation | WIRED | Lines 81-84: inserts `{ org_id: data.id, user_id: user.id, role: 'owner' }` |
| `src/app/api/orgs/[id]/route.ts` | `src/lib/auth.ts` | `requireOrgAccess` with `true` for PATCH | WIRED | Line 49: `requireOrgAccess(request, id, true)` — owner/admin only |
| `src/app/api/orgs/[id]/members/route.ts` | `src/lib/auth.ts` | `requireOrgAccess` with `true` for POST/DELETE | WIRED | Lines 50 and 129: both mutating handlers use `requireOrgAccess(request, id, true)` |
| `src/app/api/orgs/[id]/members/route.ts` | `org_members` table | zero-owner guard + delete | WIRED | Lines 144-178: counts owners before delete, rejects at <= 1 |
| `supabase/migrations/20260227000001_org_signup_trigger.sql` | `auth.users` table | `AFTER INSERT ON auth.users` trigger | WIRED | Line 69: `CREATE OR REPLACE TRIGGER on_auth_user_created AFTER INSERT ON auth.users` |
| `supabase/migrations/20260227000001_org_signup_trigger.sql` | `organizations` + `org_members` + `user_profiles` | `INSERT INTO public.organizations` | WIRED | Lines 46-57: inserts into all three tables; ON CONFLICT DO NOTHING on user_profiles |
| `src/app/api/dsos/route.ts` | `org_members` table | query user's org before DSO insert | WIRED | Lines 123-135: queries org_members, uses `membership.org_id` in dsos insert |

---

## Anti-Patterns Found

None. No TODO/FIXME/placeholder comments, no empty implementations, no stub handlers found in any of the 7 files modified in this phase.

---

## Human Verification Required

### 1. Signup trigger fires in production

**Test:** Create a new user account via the production signup flow.
**Expected:** A new organization is auto-created with the user as owner; visible in Supabase dashboard under `organizations` and `org_members`.
**Why human:** The trigger exists in the migration SQL but whether it was applied to the production database via `supabase db push` cannot be verified programmatically from the codebase alone.

### 2. PATCH rename persists across page refresh

**Test:** Rename an organization via `PATCH /api/orgs/[id]`, reload the page or call `GET /api/orgs/[id]`.
**Expected:** The new name is returned; the slug is unchanged.
**Why human:** Persistence behavior requires a live database round-trip.

### 3. 409 slug collision behavior

**Test:** Create two organizations with names that produce the same slug (e.g., "Acme Inc" and "acme-inc").
**Expected:** Second creation returns 409 with the error message.
**Why human:** Requires live database state to test the unique constraint trigger.

---

## Gaps Summary

No gaps. All 6 success criteria are satisfied by substantive, wired implementations. TypeScript compiles clean (`npx tsc --noEmit` produced no output). The three human verification items are operational confirmations, not code gaps.

---

_Verified: 2026-02-27T15:00:56Z_
_Verifier: Claude (gsd-verifier)_
