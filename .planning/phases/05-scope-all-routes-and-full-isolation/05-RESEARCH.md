# Phase 5: Scope All Routes and Full Isolation - Research

**Researched:** 2026-02-27
**Domain:** API auth middleware, multi-tenant data isolation, Next.js App Router route security
**Confidence:** HIGH — based entirely on direct codebase inspection (no external sources needed)

---

## Summary

Phase 5 completes the multi-tenancy story by migrating all 39 API routes from `user_dso_access`-based access control to `org_members`-based access control, and by adding four new org-management operations that Phase 4 did not implement. The work is purely application-level — no new database tables, no RLS changes, and no UI beyond what's needed for the four new member management endpoints.

The codebase has two distinct auth patterns today: the legacy "DSO-scoped" pattern (checking `user_dso_access`) used by 31 legacy routes, and the new "org-scoped" pattern (checking `org_members`) used by 8 org routes added in Phases 2-4. Phase 5's job is to rewire the 31 legacy routes to use org membership as the primary gate, while keeping `user_dso_access` alive as the per-DSO filter (for ISO-02 — members only see DSOs they're assigned to within the org). This is NOT a removal of `user_dso_access` — it's a deprecation flag plus a documented cleanup migration for a future milestone.

The open product decision must be resolved before planning can finalize: does org membership alone grant access to all DSOs in the org, or does per-DSO access via `user_dso_access` remain the permanent gate? The success criteria (SC-5: a user cannot reach a DSO they're not assigned to) implies `user_dso_access` stays as the per-DSO filter. This research assumes that interpretation and flags it explicitly.

**Primary recommendation:** Migrate the 31 legacy routes in three categories — (A) routes where DSO ID is always provided in the request, (B) routes that enumerate what the user can see across all their DSOs, and (C) routes with no DSO context at all — and add the four missing member management operations as new route handlers.

---

## Standard Stack

### Core (no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/ssr` | already installed | Session auth (cookie) | Existing pattern |
| `supabaseAdmin` (service role) | already installed | All DB writes/reads | Pre-existing decision: no RLS |
| `lib/auth.ts` | in-repo | Auth middleware helpers | All routes already use it |

### No New Libraries Needed

This phase is entirely auth middleware wiring — no new npm packages. All helpers needed either already exist in `lib/auth.ts` or will be added to it.

---

## Architecture Patterns

### Pattern 1: The Three Route Categories

Every legacy route falls into exactly one of these categories. The migration strategy differs per category.

#### Category A: DSO-scoped routes (DSO ID always provided)

These routes require a DSO ID in the request and currently call `checkDsoAccess` or `requireDsoAccessWithFallback`. Under the new model, they need TWO checks:
1. The user is an org member (proves the DSO belongs to their org)
2. The user has `user_dso_access` for that specific DSO (proves per-DSO assignment — ISO-02)

The key insight: if a DSO belongs to the org and the user has `user_dso_access` for it, both conditions are satisfied simultaneously. The existing `requireDsoAccessWithFallback` already checks `user_dso_access`, but does NOT verify org membership. The fix is to add an org membership check upstream, OR to verify the DSO's `org_id` matches the user's org when checking `user_dso_access`.

**Simplest safe approach:** Add `checkOrgMembership` after the user is identified but before the DSO check. If the DSO's `dsos.org_id` matches the user's org (from `org_members`), the org boundary is enforced.

#### Category B: Enumeration routes (user sees all their accessible DSOs)

These routes query `user_dso_access` to enumerate what the user can see. Under the new model, they must ALSO filter by org — so `user_dso_access` rows that belong to DSOs outside the user's current org are excluded.

**The fix:** Join `user_dso_access` with `dsos` and filter by `dsos.org_id = user_org_id`.

#### Category C: Routes with no DSO context

These routes either have no auth at all (mock data, disabled features) or use a different table. They need to be individually assessed — some need no changes, some need org membership added.

### Pattern 2: The `requireOrgDsoAccess` Helper (new)

The planner should create a new function in `lib/auth.ts` that combines org membership check + DSO access check in one call. This avoids duplicating the two-step check across 20+ routes:

```typescript
// Source: lib/auth.ts (to be created)
export async function requireOrgDsoAccess(
    request: NextRequest,
    dsoId: string,
    requireWrite = false,
    parsedBody?: { user_id?: string }
): Promise<
    { userId: string; orgId: string; role: string; response?: never } |
    { userId?: never; orgId?: never; role?: never; response: NextResponse }
> {
    // 1. Identify userId (session or fallback)
    // 2. Fetch DSO to get org_id
    // 3. Verify user is org member (checkOrgMembership)
    // 4. Verify user has DSO access (checkDsoAccess)
    // Return combined result or 403
}
```

### Pattern 3: Org-Filtered Enumeration

For Category B routes that enumerate DSOs, the new pattern is:

```typescript
// Source: pattern derived from existing orgs/[id]/dso-access route
// Step 1: get user's org from org_members
const { data: membership } = await supabaseAdmin
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .limit(1)
    .single();

// Step 2: get only DSOs in that org that the user has access to
const { data: accessRecords } = await supabaseAdmin
    .from('user_dso_access')
    .select('dso_id, dsos!inner(org_id)')
    .eq('user_id', userId)
    .eq('dsos.org_id', membership.org_id);
```

### Recommended File Structure (no changes)

The existing structure handles everything. All work is in:
```
src/
├── lib/auth.ts          # Add requireOrgDsoAccess helper
├── app/api/             # Migrate 31 routes; add PATCH to members route
└── (no new files)
```

### Anti-Patterns to Avoid

- **Removing `user_dso_access` checks entirely:** ISO-02 requires per-DSO assignment. The org check gates org boundary; the DSO check gates which DSOs within the org the user can see. Both must stay.
- **Adding org_id to URL params:** Prior decision — org stored in context/localStorage, not URL segments.
- **Touching RLS:** Prior decision — service_role + application-level auth throughout.
- **Removing the `user_id` fallback pattern prematurely:** The phase description says zero-downtime; the fallback stays until the overall auth is stable.

---

## Full Route Audit

This is the most critical output of this research. Every route is classified with its current auth status and what change Phase 5 requires.

### Category A: DSO-Scoped Routes (need org check added)

| Route | Method | Current Auth | What Needs to Change |
|-------|--------|-------------|----------------------|
| `GET /api/dsos` | GET | `requireAuth` + manual `user_dso_access` query | Add org filter to the `user_dso_access` query (join with `dsos.org_id`) |
| `POST /api/dsos` | POST | `requireAuth` + `org_members` lookup (already does this!) | No change needed — already checks org |
| `PATCH /api/dsos` | PATCH | `requireAuth` + `user_dso_access` check | Add org membership check before DSO access check |
| `GET /api/doctors` | GET (with dso_id) | `requireAuthWithFallback` + `requireDsoAccessWithFallback` | Add org check — use `requireOrgDsoAccess` |
| `POST /api/doctors` | POST | `requireDsoAccessWithFallback` | Add org check — use `requireOrgDsoAccess` |
| `GET /api/doctors/[id]` | GET | `requireAuthWithFallback` + `checkDsoAccess` | Add org membership check |
| `PATCH /api/doctors/[id]` | PATCH | `requireAuthWithFallback` + `checkDsoAccess` | Add org membership check |
| `DELETE /api/doctors/[id]` | DELETE | `requireAuthWithFallback` + `checkDsoAccess` | Add org membership check |
| `GET /api/doctors/[id]/periods` | GET | `requireDsoAccessWithFallback` | Add org check — use `requireOrgDsoAccess` |
| `PATCH /api/doctors/[id]/periods` | PATCH | `requireDsoAccessWithFallback` + manual fallback | Add org check |
| `GET /api/activities` | GET | `requireAuthWithFallback` + `checkDsoAccess` (if client_id) | Add org membership check |
| `POST /api/activities` | POST | `requireAuth` + `checkDsoAccess` (if client_id) | Add org check |
| `GET /api/tasks` | GET | `requireAuthWithFallback` + `checkDsoAccess` | Add org membership check |
| `POST /api/tasks` | POST | `requireAuthWithFallback` + `checkDsoAccess` | Add org check |
| `GET /api/progress` | GET | `requireDsoAccessWithFallback` | Add org check — use `requireOrgDsoAccess` |
| `GET /api/data-tables` | GET | `requireDsoAccessWithFallback` | Add org check — use `requireOrgDsoAccess` |
| `POST /api/data-tables` | POST (in route) | `requireDsoAccess` (direct session, no fallback) | Add org check |
| `GET /api/data-tables/[id]` | GET | `requireDsoAccessWithFallback` | Add org check |
| `PATCH /api/data-tables/[id]` | PATCH (in route) | `requireDsoAccess` | Add org check |
| `DELETE /api/data-tables/[id]` | DELETE (in route) | `requireDsoAccess` | Add org check |
| `GET /api/data-tables/[id]/columns` | GET | `requireDsoAccessWithFallback` | Add org check |
| `POST /api/data-tables/[id]/columns` | POST | `requireDsoAccessWithFallback` (write=true) | Add org check |
| `PUT /api/data-tables/[id]/columns/[columnId]` | PUT | `requireDsoAccessWithFallback` (write=true) | Add org check |
| `DELETE /api/data-tables/[id]/columns/[columnId]` | DELETE | `requireDsoAccessWithFallback` | Add org check |
| `GET /api/data-tables/[id]/rows` | GET | `requireDsoAccessWithFallback` | Add org check |
| `POST /api/data-tables/[id]/rows` | POST | `requireDsoAccessWithFallback` (write=true) + body fallback | Add org check |
| `PUT /api/data-tables/[id]/rows/[rowId]` | PUT | `requireDsoAccessWithFallback` (write=true) | Add org check |
| `DELETE /api/data-tables/[id]/rows/[rowId]` | DELETE | `requireDsoAccessWithFallback` | Add org check |
| `GET /api/data-tables/[id]/rows/[rowId]/periods` | GET | `requireDsoAccessWithFallback` | Add org check |
| `POST /api/data-tables/[id]/rows/[rowId]/periods` | POST (in route) | `requireDsoAccessWithFallback` (write=true) | Add org check |
| `GET /api/data-tables/[id]/rows/[rowId]/periods/[periodId]` | GET | `requireDsoAccessWithFallback` | Add org check |
| `PUT /api/data-tables/[id]/rows/[rowId]/periods/[periodId]` | PUT | `requireDsoAccessWithFallback` (write=true) | Add org check |
| `GET /api/data-tables/[id]/periods/batch` | GET | `requireDsoAccessWithFallback` | Add org check |
| `POST /api/data-tables/format-phones` | POST | `requireDsoAccessWithFallback` + body fallback | Add org check |

### Category B: Enumeration Routes (need org-filtered DSO list)

| Route | Method | Current Auth | What Needs to Change |
|-------|--------|-------------|----------------------|
| `GET /api/clients/overview` | GET | `requireAuth` + `user_dso_access` query | Filter `user_dso_access` by `dsos.org_id` |
| `GET /api/dashboard/metrics` | GET | `requireAuthWithFallback` + `user_dso_access` query | Filter by org |
| `GET /api/search` | GET | `requireAuthWithFallback` + `user_dso_access` query | Filter by org |
| `GET /api/tasks` | GET | Also enumeration when no dso_id provided | Filter by org |
| `GET /api/team` | GET | `requireAuth` + `user_dso_access` across DSOs | Migrate to org_members query instead |

### Category C: No DSO Context (assess individually)

| Route | Method | Current Auth | Assessment |
|-------|--------|-------------|------------|
| `GET /api/orgs` | GET | `requireAuth` | Already correct — returns user's orgs |
| `POST /api/orgs` | POST | `requireAuth` | Already correct |
| `GET /api/orgs/[id]` | GET | `requireOrgAccess` | Already correct |
| `PATCH /api/orgs/[id]` | PATCH | `requireOrgAccess` (admin) | Already correct |
| `GET /api/orgs/[id]/members` | GET | `requireOrgAccess` | Already correct |
| `POST /api/orgs/[id]/members` | POST | `requireOrgAccess` (admin) | Already correct |
| `DELETE /api/orgs/[id]/members` | DELETE | `requireOrgAccess` (admin) | Already correct |
| **`PATCH /api/orgs/[id]/members`** | **PATCH** | **DOES NOT EXIST** | **Must create — MBR-06** |
| `GET /api/orgs/[id]/dsos` | GET | `requireOrgAccess` | Already correct |
| `GET /api/orgs/[id]/dso-access` | GET | `requireOrgAccess` (admin) | Already correct |
| `POST /api/orgs/[id]/dso-access` | POST | `requireOrgAccess` (admin) | Already correct |
| `DELETE /api/orgs/[id]/dso-access` | DELETE | `requireOrgAccess` (admin) | Already correct |
| `POST /api/orgs/[id]/invites` | POST | `requireOrgAccess` (admin) | Already correct |
| `GET /api/orgs/[id]/invites` | GET | (read route to check) | Likely correct |
| `DELETE /api/orgs/[id]/invites` | DELETE | (check) | Likely correct |
| `POST /api/orgs/accept-invite` | POST | `requireAuth` + body fallback | Already correct |
| `GET /api/team` | GET | `requireAuth` (but lists via `user_dso_access`) | Needs migration — see Category B |
| `POST /api/team` | POST | `requireAuth` | Returns 501 — disabled |
| `PATCH /api/team/[id]` | PATCH | `requireAuthWithFallback` + `checkDsoAccess` | Uses old role system — evaluate |
| `DELETE /api/team/[id]` | DELETE | `requireAuthWithFallback` + `checkDsoAccess` | Uses old role system — evaluate |
| `POST /api/team/invite` | POST | `requireAuth` + `checkDsoAccess` | Old system — keep or deprecate |
| `GET /api/team/invite` | GET | `requireAuthWithFallback` + `checkDsoAccess` | Old system — keep or deprecate |
| `DELETE /api/team/invite` | DELETE | `requireAuthWithFallback` + `checkDsoAccess` | Old system — keep or deprecate |
| `POST /api/team/accept-invite` | POST | `requireAuth` + body fallback | Works on `team_invites` table — keep |
| `GET /api/dashboard/config` | GET | **NO AUTH** — mock in-memory data | No auth needed (mock, no real data) |
| `POST /api/dashboard/config` | POST | **NO AUTH** — mock in-memory data | No auth needed (mock, no real data) |
| `GET /api/metrics/config` | GET | **NO AUTH** — mock in-memory data | No auth needed (mock, no real data) |
| `POST /api/metrics/config` | POST | **NO AUTH** — mock in-memory data | No auth needed (mock, no real data) |
| `GET /api/metrics/performance` | GET | **NO AUTH** | Internal monitoring — low risk, accept |
| `GET /api/overview-widgets` | GET | `requireAuthWithFallback` + `checkDsoAccess` | Mock data only — verify |
| `GET /api/overview-widgets/[id]` | GET | **NO AUTH** | Mock data only — no real tenant data |
| `PATCH /api/overview-widgets/[id]` | PATCH | **NO AUTH** | Mock data only |
| `DELETE /api/overview-widgets/[id]` | DELETE | **NO AUTH** | Mock data only |
| `GET /api/overview-widgets/columns` | GET | **NO AUTH** | Mock data only |
| `GET /api/templates` | GET | **NO AUTH** | Returns templates — not tenant-sensitive |
| `POST /api/chat` | POST | **Disabled (503)** | Skip — returns error response |

---

## The Four Missing Operations (MBR-03 through MBR-06)

### MBR-03: Assign member to specific DSOs within org

**Already exists:** `POST /api/orgs/[id]/dso-access` with body `{ user_id, dso_id, role }`

Phase 4 built this. No new code needed.

### MBR-04: Remove member's access to specific DSO

**Already exists:** `DELETE /api/orgs/[id]/dso-access?user_id=...&dso_id=...`

Phase 4 built this. No new code needed.

### MBR-05: Remove member from org entirely

**Already exists:** `DELETE /api/orgs/[id]/members?user_id=...`

Phase 4 built this (with zero-owner guard). No new code needed.

**Side effect consideration:** When a user is removed from the org, their `user_dso_access` rows for that org's DSOs are NOT automatically cleaned up. The phase description says to document this as a cleanup migration — but the system should still work (they lose org_members entry, so any org-gated route will reject them on next call, even if stale `user_dso_access` rows exist).

### MBR-06: Change member's org-level role

**DOES NOT EXIST.** The `PATCH /api/orgs/[id]/members` handler is missing.

Must be created. Pattern:
- Auth: `requireOrgAccess(request, id, true)` — only admins/owners
- Body: `{ user_id: string, role: 'owner' | 'admin' | 'member' }`
- Logic: validate role, guard against demoting last owner, update `org_members` row
- This is analogous to the existing `PATCH /api/team/[id]` which changes `user_dso_access` roles — but targets `org_members` instead

---

## The `user_dso_access` Deprecation Strategy

Per the phase description: "deprecated (flag set) and a cleanup migration is documented."

**What "flag set" means:** Add a SQL comment or a separate `_deprecated_tables` tracking mechanism. No code removal in this phase — the table stays active.

**Cleanup migration to document:**

```sql
-- FUTURE: Remove user_dso_access after org-scoped auth is fully validated
-- Step 1: Verify all routes have been migrated to org_members-based auth
-- Step 2: Remove checkDsoAccess from lib/auth.ts
-- Step 3: Remove requireDsoAccess* functions from lib/auth.ts
-- Step 4: Drop user_dso_access table
-- Step 5: Remove user_dso_access references from team routes
```

This migration does NOT run in Phase 5. It is documented in a CONTEXT.md or migration file for a follow-on milestone.

---

## The `team` Route Decision Point

The legacy `/api/team/*` routes are ambiguous. They existed before the org model and use `user_dso_access` for both auth and data. In Phase 5:

- `GET /api/team` should migrate to query `org_members` instead of `user_dso_access` (it lists team members of the organization — that's `org_members` territory now)
- `PATCH /api/team/[id]` changes `user_dso_access` roles — this is distinct from `org_members` roles. If kept, it needs org membership check added. Alternatively, it gets superseded by `PATCH /api/orgs/[id]/members`.
- `DELETE /api/team/[id]` removes from `user_dso_access` — distinct from removing from org. Keep with org check added, or deprecate.
- `POST /api/team/invite`, `GET/DELETE /api/team/invite`: DSO-scoped invites (old system). These still work independently of the org invite system. They need org membership checks to prevent cross-org abuse.

**Recommended resolution:** Migrate `GET /api/team` to use `org_members`. Leave other `/api/team/*` routes with added org membership check (don't remove them — they may still be called by frontend).

---

## Common Pitfalls

### Pitfall 1: The Empty `user_dso_access` Trap

**What goes wrong:** Several routes return empty results (not 403) when `user_dso_access` is empty — e.g., `GET /api/clients/overview` returns `{ clients: [] }` if no access records. Under the new model, after adding org filtering, the same behavior must be preserved — but if the org filter is applied incorrectly, a member with valid `user_dso_access` rows might see empty results because the org join fails.

**How to avoid:** Test with a user who has `user_dso_access` rows and confirm the org filter includes them, not excludes them. The query must join `dsos` on `user_dso_access.dso_id = dsos.id` and filter `dsos.org_id = user's_org_id`.

### Pitfall 2: The `user_id` Body Fallback Is Unauthenticated

**What goes wrong:** Many routes accept `user_id` from the request body as a fallback when cookie auth fails. This means any caller who knows a valid user UUID can impersonate them. This is a pre-existing issue, not introduced by Phase 5 — but Phase 5 must not make it worse.

**How to avoid:** When adding org checks using the fallback userId, verify org membership for that userId just as strictly as for session-authenticated users. Do not skip the org check because auth came from a fallback path.

### Pitfall 3: Cross-Org DSO Access via Crafted Requests

**What goes wrong:** Route checks `checkDsoAccess(userId, dsoId)` — this verifies `user_dso_access` exists for that pair. But if a future admin adds a cross-org `user_dso_access` row (e.g., via a bug or direct DB access), this check would succeed even though the DSO is in a different org.

**How to avoid:** In `requireOrgDsoAccess`, after getting the DSO's `org_id`, verify it matches the user's org from `org_members`. This double-check eliminates the attack surface.

### Pitfall 4: Missing PATCH `/api/orgs/[id]/members` (MBR-06)

**What goes wrong:** The route does not exist. Any plan that assumes it exists will fail to test SC-4 (admin can change a member's org-level role).

**How to avoid:** Create the PATCH handler as the first task in the phase.

### Pitfall 5: `GET /api/doctors` Without `dso_id`

**What goes wrong:** When `dso_id` is not provided to `GET /api/doctors`, the route returns ALL doctors from ALL DSOs the user has access to (via `user_dso_access`). Without an org filter, this could include doctors from other orgs if a cross-org `user_dso_access` row exists.

**How to avoid:** Even when `dso_id` is absent, the `user_dso_access`-derived DSO list must be filtered by the user's org. Apply the org-filtered enumeration pattern (Category B) as a baseline.

### Pitfall 6: Mock Routes Masking Real Security Gaps

**What goes wrong:** Several routes (`/api/dashboard/config`, `/api/metrics/config`, `/api/overview-widgets/*`) have no auth because they use in-memory mock data. The plan might skip these. But if they are ever wired to real data without auth, they become immediate vulnerabilities.

**How to avoid:** Note these explicitly in the plan. They are out of scope for Phase 5 (mock data poses no isolation risk) but should be flagged for any future real-data migration.

---

## Code Examples

### New Helper: `requireOrgDsoAccess`

```typescript
// Source: lib/auth.ts (to be created in Phase 5)
export async function requireOrgDsoAccess(
    request: NextRequest,
    dsoId: string,
    requireWrite = false,
    parsedBody?: { user_id?: string }
): Promise<
    { userId: string; orgId: string; role: string; response?: never } |
    { userId?: never; orgId?: never; role?: never; response: NextResponse }
> {
    // Step 1: identify user (session or fallback)
    const { user } = await getAuthUser(request);
    let userId: string;
    if (user) {
        userId = user.id;
    } else {
        const { searchParams } = new URL(request.url);
        const userIdParam = searchParams.get('user_id') || parsedBody?.user_id;
        if (!userIdParam) {
            return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
        }
        userId = userIdParam;
    }

    // Step 2: get DSO with its org_id
    const { data: dso } = await supabaseAdmin
        .from('dsos')
        .select('org_id')
        .eq('id', dsoId)
        .single();

    if (!dso) {
        return { response: NextResponse.json({ error: 'DSO not found' }, { status: 404 }) };
    }

    // Step 3: verify user is member of the DSO's org
    const { isMember } = await checkOrgMembership(userId, dso.org_id);
    if (!isMember) {
        return { response: NextResponse.json({ error: 'Access denied' }, { status: 403 }) };
    }

    // Step 4: verify user has per-DSO access (ISO-02)
    const { hasAccess, role } = await checkDsoAccess(userId, dsoId);
    if (!hasAccess) {
        return { response: NextResponse.json({ error: 'Access denied to this workspace' }, { status: 403 }) };
    }

    if (requireWrite && !hasWriteAccess(role)) {
        return { response: NextResponse.json({ error: 'Write access required' }, { status: 403 }) };
    }

    return { userId, orgId: dso.org_id, role: role! };
}
```

### New Route: `PATCH /api/orgs/[id]/members` (MBR-06)

```typescript
// Source: pattern from existing DELETE /api/orgs/[id]/members
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const authResult = await requireOrgAccess(request, id, true); // admin required
    if (authResult.response) return authResult.response;

    const body = await request.json();
    const { user_id, role } = body;

    if (!user_id || !role) {
        return NextResponse.json({ error: 'user_id and role are required' }, { status: 400 });
    }

    if (!isValidOrgRole(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Get current role for zero-owner guard
    const { data: targetMember } = await supabaseAdmin
        .from('org_members')
        .select('role')
        .eq('org_id', id)
        .eq('user_id', user_id)
        .single();

    if (!targetMember) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Zero-owner guard: can't demote the last owner
    if (targetMember.role === 'owner' && role !== 'owner') {
        const { count } = await supabaseAdmin
            .from('org_members')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', id)
            .eq('role', 'owner');
        if (count !== null && count <= 1) {
            return NextResponse.json(
                { error: 'Cannot demote the last owner. Transfer ownership first.' },
                { status: 403 }
            );
        }
    }

    const { error } = await supabaseAdmin
        .from('org_members')
        .update({ role })
        .eq('org_id', id)
        .eq('user_id', user_id);

    if (error) {
        return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
    }

    return NextResponse.json({ success: true, role });
}
```

### Org-Filtered Enumeration Pattern (Category B routes)

```typescript
// Source: pattern derived from existing code; used in clients/overview, dashboard/metrics, search
// Replace existing user_dso_access-only queries with this:

// Get user's org
const { data: membership } = await supabaseAdmin
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .limit(1)
    .single();

if (!membership) {
    return NextResponse.json({ clients: [] }); // or appropriate empty response
}

// Get accessible DSOs within the org only
const { data: accessRecords } = await supabaseAdmin
    .from('user_dso_access')
    .select('dso_id, dsos!inner(org_id)')
    .eq('user_id', userId)
    .eq('dsos.org_id', membership.org_id);

const accessibleDsoIds = accessRecords?.map(r => r.dso_id) || [];
```

---

## State of the Art

| Old Approach | Current Approach (Phase 5) | Impact |
|--------------|---------------------------|--------|
| `checkDsoAccess` only | `checkOrgMembership` + `checkDsoAccess` | Cross-org attacks blocked |
| Enumerate all `user_dso_access` rows globally | Enumerate filtered by `org_id` | Cross-org data leak closed |
| No PATCH on org members | `PATCH /api/orgs/[id]/members` | MBR-06 satisfied |
| `user_dso_access` as source of truth | `org_members` gates org boundary, `user_dso_access` gates per-DSO | Two-level isolation |

**Deprecated (flagged, not removed):**
- `checkDsoAccess` as the sole auth check on DSO routes: replaced by `requireOrgDsoAccess`
- `user_dso_access` as the sole access list: replaced by org-filtered query

---

## Open Questions

1. **Product decision: Does org membership grant all-DSO access, or does `user_dso_access` remain permanent?**
   - What we know: Success criteria SC-5 says "a user cannot reach any DSO data by crafting a direct API request to a DSO they are not assigned to within the org" — this implies `user_dso_access` remains as per-DSO filter (ISO-02)
   - What's unclear: If an admin is added to the org but has no `user_dso_access` rows, should they see all org DSOs by default, or none?
   - Recommendation: Assume `user_dso_access` remains the per-DSO gate; org membership alone does not grant DSO access. Admins use the DSO assignment dialog (Phase 4) to explicitly grant access.

2. **What happens to `user_dso_access` rows when a user is removed from the org?**
   - What we know: `DELETE /api/orgs/[id]/members` removes the `org_members` row but does NOT cascade to `user_dso_access`
   - What's unclear: With org membership gate in place, this is safe (the route will reject them at org check), but stale rows accumulate
   - Recommendation: Document in the cleanup migration. Optionally add a DB-level trigger or application-level cleanup in the DELETE handler — but this is low priority since the org gate makes the stale rows harmless.

3. **Should `/api/team/*` routes be deprecated or migrated?**
   - What we know: `GET /api/team` lists members via `user_dso_access` — this is now duplicate of `GET /api/orgs/[id]/members`
   - What's unclear: Whether the frontend still calls `/api/team` or has been migrated to org routes
   - Recommendation: Migrate `GET /api/team` to use `org_members`, keep other team routes with org checks added for now, document for deprecation in a future phase.

4. **Do mock routes (`/api/dashboard/config`, etc.) need auth added?**
   - What we know: They use in-memory data with no real tenant data at risk
   - What's unclear: When will they be wired to real data?
   - Recommendation: Out of scope for Phase 5. Flag in plan as "no real data, no isolation risk."

---

## Sources

### Primary (HIGH confidence)

All findings are from direct code inspection of the codebase. No external sources consulted — the codebase is the authoritative source for this phase.

- `/Users/alan/Desktop/Claude Code Projects/ASC/CS12/cs12-app/src/lib/auth.ts` — all auth helpers
- `/Users/alan/Desktop/Claude Code Projects/ASC/CS12/cs12-app/src/app/api/` — all 39 route files
- `/Users/alan/Desktop/Claude Code Projects/ASC/CS12/cs12-app/supabase/migrations/20260226000000_add_org_tables.sql` — schema
- `/Users/alan/Desktop/Claude Code Projects/ASC/CS12/cs12-app/.planning/phases/04-org-context-and-settings-ui/04-VERIFICATION.md` — Phase 4 verified state

---

## Metadata

**Confidence breakdown:**
- Route audit: HIGH — every route file read directly
- Required new code (MBR-06 PATCH): HIGH — confirmed by absence of PATCH in members route
- `requireOrgDsoAccess` helper design: HIGH — derived directly from existing auth.ts patterns
- Mock route assessment: HIGH — code confirmed they use in-memory data only
- Product decision (org vs per-DSO access): MEDIUM — inferred from success criteria; needs explicit confirmation before planning locks it

**Research date:** 2026-02-27
**Valid until:** Stable (this codebase is the source; no external dependencies)
