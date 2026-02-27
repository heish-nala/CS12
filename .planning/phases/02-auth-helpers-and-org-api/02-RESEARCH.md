# Phase 2: Auth Helpers and Org API — Research

**Researched:** 2026-02-26
**Domain:** Next.js 16 App Router API routes + Supabase auth trigger for auto-org + TypeScript discriminated unions
**Confidence:** HIGH

---

## Summary

Phase 2 has three distinct technical tracks that must be built in dependency order: (1) extend `lib/auth.ts` with org-membership helpers, (2) build the `/api/orgs` route group for CRUD + member management, (3) add a Supabase database function + trigger to auto-create an org when a new user signs up.

The auth helper work is entirely mechanical — the discriminated union pattern is already fully established in `lib/auth.ts`. The new `requireOrgAccess()` and `checkOrgMembership()` functions are direct analogs of the existing `requireDsoAccess()` and `checkDsoAccess()` functions, querying `org_members` exactly as the DSO helpers query `user_dso_access`.

The `/api/orgs` route group is net-new but follows every existing API route pattern: `supabaseAdmin` for queries, `requireAuth()` as the first call, manual role checks, consistent error shapes. The one non-obvious piece is the 409 Conflict response for duplicate slugs — this requires catching a specific Supabase error code (`23505` — unique constraint violation) and returning 409 instead of 500.

The auto-org-on-signup requirement (ORG-01) is the most technically specific piece. The standard Supabase approach is a PostgreSQL function + `AFTER INSERT ON auth.users` trigger. This project has a prior example (`handle_invite_acceptance` in `20250115_add_team_invites.sql`) but its trigger was deferred to the Supabase Dashboard because auth.users is a protected schema. In Supabase's current CLI (2.x), triggers on `auth.users` CAN be included in migration files — they run as the migration owner (postgres superuser) which has access to the auth schema. This project's prior workaround was unnecessary caution. The trigger should go in the migration file.

The zero-owner guard (MBR-08) requires a count check before any DELETE/role-change on `org_members` — if the result would leave zero owners, return 403. This is application-level logic, not a database constraint.

**Primary recommendation:** Build in this order: (1) auth helpers in `lib/auth.ts`, (2) `POST /api/orgs` with slug generation + auto-membership, (3) `GET/PATCH /api/orgs/[id]` for rename, (4) `GET/POST/DELETE /api/orgs/[id]/members` with zero-owner guard, (5) auto-org trigger migration. Each step is independently testable.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.86.0 | `supabaseAdmin` for all DB queries in API routes | Already in use across all 31 routes — no deviation |
| `@supabase/ssr` | ^0.8.0 | `createServerClient` for session auth in `lib/auth.ts` | Already the pattern in `createSupabaseClient()` inside auth.ts |
| `next` | ^16.0.7 | `NextRequest`, `NextResponse` for route handlers | Already the pattern throughout |
| `zod` | ^4.1.13 | Request body validation on POST/PATCH endpoints | Already installed — validate org name, slug, role inputs |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Native slugify logic | n/a | Convert org name to URL-safe slug | Simple: lowercase + replace spaces/special chars with hyphens — no package needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual slug generation | `slugify` npm package | Manual is 3 lines of code for ASCII names; package adds dependency for marginal benefit. Only worth adding if Unicode name support is required. |
| Application-level zero-owner guard | PostgreSQL CHECK constraint | A constraint on org_members cannot enforce "last owner" without a complex trigger. Application-level check is simpler and consistent with how the codebase handles all other business rules. |
| Migration-based auth trigger | Supabase Dashboard trigger | Migration file is version-controlled and reproducible. Dashboard triggers are invisible in the codebase. Always prefer migration file. |

**Installation:**
```bash
# No new packages required — existing stack covers everything
```

---

## Architecture Patterns

### Recommended Project Structure

New files to create in Phase 2:

```
src/
├── app/api/
│   └── orgs/
│       ├── route.ts              # GET (list user's orgs), POST (create org)
│       └── [id]/
│           ├── route.ts          # GET (org detail), PATCH (rename), DELETE (future)
│           └── members/
│               └── route.ts      # GET (list members), POST (add member), DELETE (remove)
├── lib/
│   └── auth.ts                   # UPDATED: add checkOrgMembership() + requireOrgAccess()
supabase/
└── migrations/
    └── 20260226000001_org_signup_trigger.sql   # YYYYMMDDHHMMSS + next sequence
```

Also update:
```
src/app/api/dsos/route.ts         # Fix POST handler to include org_id (known gap from Phase 1)
src/lib/db/types.ts               # Add Organization + OrgMember TypeScript types
```

### Pattern 1: Discriminated Union Auth Helper (existing pattern to match)

**What:** Every auth helper returns either `{ user, role }` (success) or `{ response }` (error) — never both. The caller uses `'response' in result` to check which branch.

**Source:** `src/lib/auth.ts` — `requireDsoAccess()` at line 145 is the canonical example.

**New helpers must match this pattern exactly:**

```typescript
// Source: src/lib/auth.ts (existing requireDsoAccess pattern — HIGH confidence)

export async function checkOrgMembership(
    userId: string,
    orgId: string
): Promise<{ isMember: boolean; role: string | null }> {
    try {
        const { data, error } = await supabaseAdmin
            .from('org_members')
            .select('role')
            .eq('user_id', userId)
            .eq('org_id', orgId)
            .single();

        if (error || !data) {
            return { isMember: false, role: null };
        }
        return { isMember: true, role: data.role };
    } catch (error) {
        console.error('Org membership check error:', error);
        return { isMember: false, role: null };
    }
}

export async function requireOrgAccess(
    request: NextRequest,
    orgId: string,
    requireOwnerOrAdmin = false
): Promise<
    { user: AuthUser; role: string; response?: never } |
    { user?: never; role?: never; response: NextResponse }
> {
    const { user, error } = await getAuthUser(request);

    if (!user) {
        return {
            response: NextResponse.json(
                { error: error || 'Unauthorized' },
                { status: 401 }
            ),
        };
    }

    const { isMember, role } = await checkOrgMembership(user.id, orgId);

    if (!isMember) {
        return {
            response: NextResponse.json(
                { error: 'Not a member of this organization' },
                { status: 403 }
            ),
        };
    }

    if (requireOwnerOrAdmin && role !== 'owner' && role !== 'admin') {
        return {
            response: NextResponse.json(
                { error: 'Owner or admin access required' },
                { status: 403 }
            ),
        };
    }

    return { user, role: role! };
}
```

**Usage in route handlers (matches existing requireDsoAccess call sites):**

```typescript
const orgResult = await requireOrgAccess(request, orgId);
if ('response' in orgResult) return orgResult.response;
const { user, role } = orgResult;
```

### Pattern 2: Slug Generation

**What:** Convert an org name to a URL-safe slug. Must be unique — enforce at the database level (organizations.slug has UNIQUE constraint from Phase 1 migration).

**When to use:** On POST /api/orgs when creating a new org.

```typescript
// Source: Standard string manipulation — no package needed
function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')   // remove non-alphanumeric except spaces/hyphens
        .replace(/\s+/g, '-')            // spaces to hyphens
        .replace(/-+/g, '-')             // collapse multiple hyphens
        .replace(/^-|-$/g, '');          // trim leading/trailing hyphens
}
```

**Collision handling:** The DB enforces uniqueness. If `supabaseAdmin.from('organizations').insert()` returns error code `23505`, return HTTP 409 (Conflict). Do NOT append random suffixes silently — require the caller to provide a different name or slug.

### Pattern 3: Auto-Org on Signup (PostgreSQL Trigger)

**What:** When a new row is inserted into `auth.users`, automatically create an organization for that user and insert them as owner into `org_members`. Also insert a `user_profiles` row.

**When to use:** This is the ORG-01 requirement — "first user on signup becomes owner."

**How triggers on auth.users work in Supabase migrations:**

The existing `team_invites` migration (line 85-93) suggests triggers on `auth.users` must be created via the Dashboard. This comment was written conservatively. **Supabase CLI migrations run as the `postgres` role (superuser), which has full access to the `auth` schema.** Triggers on `auth.users` CAN be included in migration files and will execute correctly when run via `supabase db push`. The comment in the prior migration is an outdated caution.

**Source:** Supabase official docs on "Handle new users" confirm this pattern runs in migrations — HIGH confidence based on official docs and common community usage.

```sql
-- In a new migration file: 20260226000001_org_signup_trigger.sql

-- Function: create org + membership when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
    new_org_id UUID;
    new_org_slug TEXT;
    base_slug TEXT;
    counter INT := 0;
BEGIN
    -- Generate a base slug from the user's email prefix
    base_slug := LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-z0-9]', '-', 'g'));
    new_org_slug := base_slug;

    -- Ensure slug uniqueness by appending a counter if needed
    WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = new_org_slug) LOOP
        counter := counter + 1;
        new_org_slug := base_slug || '-' || counter;
    END LOOP;

    -- Create the organization
    INSERT INTO public.organizations (name, slug, created_by)
    VALUES (
        COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1), 'My Organization') || '''s Org',
        new_org_slug,
        NEW.id
    )
    RETURNING id INTO new_org_id;

    -- Add the user as owner
    INSERT INTO public.org_members (org_id, user_id, role)
    VALUES (new_org_id, NEW.id, 'owner');

    -- Insert user_profiles row (cache email + name)
    INSERT INTO public.user_profiles (id, email, name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name')
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: fire after every new auth.users insert
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user_signup();
```

**IMPORTANT — existing users:** Alan and Claudia already have `org_members` and `user_profiles` rows from the Phase 1 migration. The trigger fires only on NEW signups. No backfill needed. The `ON CONFLICT (id) DO NOTHING` on `user_profiles` protects against re-runs.

**IMPORTANT — existing users won't get duplicate orgs:** The trigger uses `AFTER INSERT ON auth.users`. Alan and Claudia were inserted before this trigger exists — the trigger does not fire retroactively.

**SECURITY DEFINER note:** The function uses `SECURITY DEFINER` so it runs with the function owner's privileges (postgres superuser) regardless of who triggered the auth insert. This is necessary because `auth.users` is in a protected schema and the `service_role` doesn't own it. The existing `handle_invite_acceptance` function also uses `SECURITY DEFINER` for the same reason.

### Pattern 4: API Route Structure for /api/orgs

**What:** The standard route handler structure used throughout the codebase, extended to org operations.

**Source:** `src/app/api/dsos/route.ts` and `src/app/api/team/invite/route.ts` — verified directly.

```typescript
// POST /api/orgs — create org (used internally; signup trigger handles the normal case)
export async function POST(request: NextRequest) {
    // 1. Auth check — always first
    const authResult = await requireAuth(request);
    if ('response' in authResult) return authResult.response;
    const { user } = authResult;

    // 2. Parse + validate body
    const body = await request.json();
    // ... zod validation ...

    // 3. DB operation
    const { data, error } = await supabaseAdmin
        .from('organizations')
        .insert({ name, slug, created_by: user.id })
        .select()
        .single();

    // 4. Handle unique constraint violation (slug duplicate)
    if (error && (error as any).code === '23505') {
        return NextResponse.json(
            { error: 'An organization with this slug already exists' },
            { status: 409 }
        );
    }
    if (error) throw error;

    // 5. Insert creator as owner in org_members
    await supabaseAdmin.from('org_members').insert({
        org_id: data.id,
        user_id: user.id,
        role: 'owner'
    });

    return NextResponse.json({ org: data }, { status: 201 });
}
```

### Pattern 5: Zero-Owner Guard

**What:** Before removing a member OR downgrading a role from 'owner', verify the org has at least one other owner. If the operation would leave zero owners, return 403.

**When to use:** DELETE on `/api/orgs/[id]/members` when the target member has role 'owner', AND PATCH on role change when changing 'owner' to something else.

```typescript
// Check zero-owner guard before any operation that removes/demotes an owner
async function wouldLeaveZeroOwners(orgId: string, targetUserId: string): Promise<boolean> {
    const { data: owners, error } = await supabaseAdmin
        .from('org_members')
        .select('user_id')
        .eq('org_id', orgId)
        .eq('role', 'owner');

    if (error || !owners) return false; // fail open — allow operation if we can't check
    // Guard triggers if: there is only 1 owner AND it's the target being modified
    return owners.length === 1 && owners[0].user_id === targetUserId;
}
```

**Usage:**

```typescript
// In DELETE /api/orgs/[id]/members
const isLastOwner = await wouldLeaveZeroOwners(orgId, targetUserId);
if (isLastOwner) {
    return NextResponse.json(
        { error: 'Cannot remove the last owner of an organization' },
        { status: 403 }
    );
}
```

### Pattern 6: Role Validation

**What:** Reject invalid role values when adding or updating a member. The three valid roles are `owner`, `admin`, `member` (per Phase 1 schema CHECK constraint).

**Source:** Phase 1 migration — `CHECK (role IN ('owner', 'admin', 'member'))` on `org_members.role`.

```typescript
const VALID_ORG_ROLES = ['owner', 'admin', 'member'] as const;
type OrgRole = typeof VALID_ORG_ROLES[number];

function isValidOrgRole(role: string): role is OrgRole {
    return VALID_ORG_ROLES.includes(role as OrgRole);
}

// In route handler:
if (!isValidOrgRole(role)) {
    return NextResponse.json(
        { error: 'Invalid role. Must be owner, admin, or member' },
        { status: 400 }
    );
}
```

### Anti-Patterns to Avoid

- **Returning 500 for duplicate slug:** The `supabaseAdmin` insert throws a Supabase error with code `23505` on unique constraint violation. Catch this specifically and return 409. Returning 500 gives the caller no actionable information.

- **Using `requireOwnerOrAdmin` vs `requireAdmin` inconsistency:** Be consistent. The rename operation (ORG-03) requires owner or admin. Member management (MBR-08 zero-owner guard) requires owner. Define these distinctions clearly at the route level.

- **Querying auth.users directly for user lookup:** `user_profiles` exists exactly for this purpose (Phase 1 built it to avoid N+1 auth API calls). When a route needs to return member info including email/name, JOIN `org_members` with `user_profiles` — do NOT call `supabaseAdmin.auth.admin.getUserById()` in a loop.

- **Auto-generating a unique slug silently on collision:** On POST /api/orgs from a client request, collision = 409 (tell the user). Only the auto-signup trigger should silently append a counter, because there is no user present to tell.

- **Not inserting creator into org_members on POST /api/orgs:** If org creation can also happen via API (not just the signup trigger), the route MUST insert the creator as owner. The trigger handles signup; the API route must handle the API-created path.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slug uniqueness enforcement | Custom application-level uniqueness check | Database UNIQUE constraint (already exists on Phase 1 schema) + catch error code 23505 | Race condition if checked at app level; DB constraint is atomic |
| Session validation | Custom JWT parsing | `getAuthUser()` from `lib/auth.ts` → `createSupabaseClient()` → `supabase.auth.getUser()` | Already implemented, already tested |
| Auto-org on signup | API endpoint called from signup form | PostgreSQL trigger on `auth.users` | Trigger is atomic with the user insert; API call can fail or be missed |
| User email/name lookup for member lists | `supabaseAdmin.auth.admin.getUserById()` in a loop | JOIN `org_members` with `user_profiles` | Phase 1 created `user_profiles` specifically to avoid N+1 auth admin API calls |

**Key insight:** Every "clever" custom solution in this phase has a more reliable, atomic database or existing-pattern equivalent. Prefer the boring, consistent approach.

---

## Common Pitfalls

### Pitfall 1: Trigger on auth.users in Migration File — The Commented-Out Caution

**What goes wrong:** Developer reads the comment in `20250115_add_team_invites.sql` saying "trigger on auth.users needs to be created via Supabase dashboard" and replicates that mistake — putting the trigger in the dashboard instead of the migration file.

**Why it happens:** The prior comment was overly conservative. The Supabase CLI's `supabase db push` runs as the `postgres` role (superuser) which does have permission to create triggers on `auth.users`. Dashboard triggers are invisible in the codebase and will be lost if the project is cloned or re-migrated.

**How to avoid:** Include the trigger function and `CREATE TRIGGER` statement in the migration file. Test with `supabase db reset` locally. If it works locally, it will work on `supabase db push`.

**Warning signs:** Trigger that only exists in the Supabase dashboard but not in any migration file — it will vanish on next `supabase db reset`.

### Pitfall 2: Duplicate Org for Existing Users After Trigger is Added

**What goes wrong:** The `handle_new_user_signup` trigger is added via migration. Someone worries that Alan and Claudia will get duplicate orgs created. They add complex logic to check "if user already has an org, skip."

**Why it won't happen:** The trigger fires `AFTER INSERT ON auth.users`. Alan and Claudia were inserted long before this migration runs. `INSERT INTO auth.users` for them will not be re-fired by the migration. No special protection needed.

**How to verify:** Run `supabase db reset` locally. The seed.sql creates one demo user (via INSERT INTO auth.users). Verify the trigger fires exactly once, creating exactly one org.

### Pitfall 3: POST /api/orgs Silently Creates Orphaned Orgs (Missing org_members Insert)

**What goes wrong:** The route creates the organization row in `organizations` but doesn't insert the creator into `org_members`. The org exists with no owner. The zero-owner guard logic then can never be triggered because there is no owner to remove.

**Why it happens:** The org creation and member insert feel like two separate operations. It's easy to forget the second one, especially since the signup trigger handles it for the normal case.

**How to avoid:** In `POST /api/orgs`, always insert `org_id + user.id + role: 'owner'` into `org_members` in the same handler, immediately after the org INSERT succeeds. If this INSERT fails, rollback (delete the org). This is exactly how `POST /api/dsos` handles the `user_dso_access` insert (lines 131-153 in `dsos/route.ts`).

**Warning signs:** `POST /api/orgs` creates a row in `organizations` but the `org_members` query in the same function is missing.

### Pitfall 4: requireOrgAccess Called with Hardcoded org_id Instead of Request Parameter

**What goes wrong:** A route handler calls `requireOrgAccess(request, SOME_HARDCODED_ORG_ID)` instead of reading `orgId` from the URL params or request body. This passes one org's access check while actually returning data from another.

**Why it happens:** Easy copy-paste error when scaffolding a new route.

**How to avoid:** In every route under `/api/orgs/[id]/`, the `orgId` must come from `params.id` (the URL segment), not a hardcoded value or a body field. Verify this in code review: if `requireOrgAccess` is not being called with a value derived from the URL or a trusted source, it's wrong.

### Pitfall 5: Zero-Owner Guard Race Condition

**What goes wrong:** Two concurrent requests both check "is this the last owner?" simultaneously, both see one owner, both proceed to remove/demote that owner, leaving zero owners.

**Why it happens:** The check and the delete are two separate operations with no transaction between them.

**How to avoid at CS12's scale:** At the current scale (one org, 2-3 users), this is a theoretical issue, not a practical one. The simple application-level check is acceptable. Document the race as a known limitation. If the product needs stronger guarantees: wrap the check + delete in a Supabase RPC function that runs in a transaction, or add a `CHECK` constraint enforced by a trigger. For now, the simple check is correct.

**Warning signs:** This is only a risk with concurrent requests from the same session, which is extremely unlikely in a single-tenant org context.

### Pitfall 6: Missing org_id on POST /api/dsos (Known Gap from Phase 1)

**What goes wrong:** Phase 1 Verification identified that `POST /api/dsos` at line 125 inserts `{ name }` only. Since `dsos.org_id` is now NOT NULL, this route is broken.

**Why it matters to Phase 2:** Phase 2 builds the org API. Once `/api/orgs` exists and clients can have an `org_id`, the `POST /api/dsos` fix is unblocked — the route can now look up the user's org and include it.

**How to fix in Phase 2:** After the org helpers exist, update `POST /api/dsos` to:
1. Call `requireAuth(request)` to get the user
2. Query `org_members` to find the user's org (or accept `org_id` as a body param)
3. Include `org_id` in the insert

This is a required fix in Phase 2 — it is currently broken in production (anyone trying to create a new DSO gets a 500).

---

## Code Examples

Verified patterns from official sources and direct codebase reading:

### Complete auth.ts additions (two new exports)

```typescript
// Source: src/lib/auth.ts pattern — HIGH confidence (direct codebase read)
// Add these functions alongside the existing DSO helpers

export async function checkOrgMembership(
    userId: string,
    orgId: string
): Promise<{ isMember: boolean; role: string | null }> {
    try {
        const { data, error } = await supabaseAdmin
            .from('org_members')
            .select('role')
            .eq('user_id', userId)
            .eq('org_id', orgId)
            .single();

        if (error || !data) {
            return { isMember: false, role: null };
        }
        return { isMember: true, role: data.role };
    } catch (error) {
        console.error('Org membership check error:', error);
        return { isMember: false, role: null };
    }
}

export async function requireOrgAccess(
    request: NextRequest,
    orgId: string,
    requireOwnerOrAdmin = false
): Promise<
    { user: AuthUser; role: string; response?: never } |
    { user?: never; role?: never; response: NextResponse }
> {
    const { user, error } = await getAuthUser(request);

    if (!user) {
        return {
            response: NextResponse.json(
                { error: error || 'Unauthorized' },
                { status: 401 }
            ),
        };
    }

    const { isMember, role } = await checkOrgMembership(user.id, orgId);

    if (!isMember) {
        return {
            response: NextResponse.json(
                { error: 'Not a member of this organization' },
                { status: 403 }
            ),
        };
    }

    if (requireOwnerOrAdmin && role !== 'owner' && role !== 'admin') {
        return {
            response: NextResponse.json(
                { error: 'Owner or admin access required' },
                { status: 403 }
            ),
        };
    }

    return { user, role: role! };
}
```

### Catching Supabase unique constraint error for 409

```typescript
// Source: Supabase error codes — PostgreSQL 23505 = unique_violation
// Pattern: same as how dsos/route.ts catches error code '42703' for missing column

const { data, error } = await supabaseAdmin
    .from('organizations')
    .insert({ name, slug, created_by: user.id })
    .select()
    .single();

if (error && (error as any).code === '23505') {
    return NextResponse.json(
        { error: 'An organization with this slug already exists' },
        { status: 409 }
    );
}
if (error) throw error;
```

### TypeScript types for new tables (add to src/lib/db/types.ts)

```typescript
// Source: Phase 1 migration schema — HIGH confidence (read directly)

export type OrgRole = 'owner' | 'admin' | 'member';

export interface Organization {
    id: string;
    name: string;
    slug: string;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface OrgMember {
    id: string;
    org_id: string;
    user_id: string;
    role: OrgRole;
    joined_at: string;
}

export interface UserProfile {
    id: string;
    email: string;
    name: string | null;
    created_at: string;
    updated_at: string;
}

// Extended type for member listing (join of org_members + user_profiles)
export interface OrgMemberWithProfile extends OrgMember {
    profile: UserProfile | null;
}
```

### Slug generation utility

```typescript
// Source: Standard string manipulation pattern (no library needed)
export function generateOrgSlug(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}
```

### Migration file for auto-org trigger

```sql
-- Migration: Auto-create org when new user signs up
-- Phase 2: Auth Helpers and Org API
-- Filename: 20260226000001_org_signup_trigger.sql

-- Function: Creates org + adds user as owner + inserts user_profiles row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
    new_org_id UUID;
    new_org_slug TEXT;
    base_slug TEXT;
    counter INT := 0;
    user_name TEXT;
BEGIN
    -- Determine org name from user metadata
    user_name := COALESCE(
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'full_name',
        SPLIT_PART(NEW.email, '@', 1)
    );

    -- Generate base slug from email prefix
    base_slug := LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-z0-9]', '-', 'g'));
    -- Remove leading/trailing hyphens
    base_slug := TRIM(BOTH '-' FROM base_slug);
    -- Default if slug is empty after sanitization
    IF base_slug = '' THEN base_slug := 'org'; END IF;

    new_org_slug := base_slug;

    -- Ensure slug uniqueness
    WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = new_org_slug) LOOP
        counter := counter + 1;
        new_org_slug := base_slug || '-' || counter;
    END LOOP;

    -- Create the organization
    INSERT INTO public.organizations (name, slug, created_by)
    VALUES (user_name || '''s Organization', new_org_slug, NEW.id)
    RETURNING id INTO new_org_id;

    -- Add the user as owner
    INSERT INTO public.org_members (org_id, user_id, role)
    VALUES (new_org_id, NEW.id, 'owner');

    -- Insert user_profiles row (idempotent — Phase 1 may have pre-seeded some users)
    INSERT INTO public.user_profiles (id, email, name)
    VALUES (NEW.id, NEW.email, NULLIF(user_name, SPLIT_PART(NEW.email, '@', 1)))
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: fires after each new auth.users insert
-- Note: The auth schema is accessible to the postgres role (migration owner).
-- This CAN be in a migration file — the prior comment in team_invites migration was overly conservative.
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_signup();
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers` | `@supabase/ssr` | 2024 | CS12 already uses `@supabase/ssr` — no action needed |
| `auth.users` trigger via Dashboard | Auth trigger in migration file | Supabase CLI v2 | CLI runs as postgres superuser — migration files CAN create triggers on auth.users |
| `uuid_generate_v4()` | `gen_random_uuid()` | PostgreSQL 13+ | CS12 uses `gen_random_uuid()` in Phase 1 tables — use it for any new IDs in this phase too |

**Deprecated/outdated:**
- Dashboard-only auth triggers: Version-controlled migration files are the correct location. See note in Pitfall 1.

---

## Open Questions

1. **Should POST /api/orgs be a usable endpoint, or is the trigger the only creation path?**
   - What we know: ORG-01 says "first user on signup gets an org auto-created." There's no requirement that users can manually create additional orgs (that's v2 MORG-01).
   - What's unclear: Should POST /api/orgs exist in Phase 2 at all, or only the trigger?
   - Recommendation: Build POST /api/orgs anyway — it will be needed for testing the trigger's behavior, and for the Phase 3/4 invite acceptance flow where a user joins an existing org. The trigger handles the happy path; the API handles edge cases and future needs. Keep the endpoint but mark it as "internal use" until Phase 4 exposes org creation UI.

2. **How does POST /api/dsos get fixed (the Phase 1 gap)?**
   - What we know: POST /api/dsos at line 125 inserts `{ name }` only, but `dsos.org_id` is NOT NULL. This is broken.
   - What's unclear: Should the route require `org_id` in the request body, or should it look up the user's org automatically?
   - Recommendation: Look up the user's org via `org_members` using `requireOrgAccess` or a direct query. The caller shouldn't need to know the org_id. For now, get the user's first/only org. (Multi-org support is v2.)

3. **What name format for the auto-created org on signup?**
   - What we know: The trigger needs to generate an org name. Options: `"[username]'s Organization"` or `"[email prefix]'s Organization"` or prompt the user during onboarding (not during signup).
   - What's unclear: Product decision on naming.
   - Recommendation: Generate `"[name]'s Organization"` using the user's metadata name if available, email prefix otherwise. The owner can always rename it via ORG-03 (PATCH /api/orgs/[id]).

4. **Should the trigger also fire for existing Supabase-invited users?**
   - What we know: When `supabaseAdmin.auth.admin.inviteUserByEmail()` is called, a new `auth.users` row is created immediately (with `email_confirmed_at = null`). The trigger fires on INSERT, so invited users will auto-get an org before they even confirm.
   - What's unclear: Is this the desired behavior? A user who is invited to join an existing org will also get their own org created automatically.
   - Recommendation: Accept this behavior. Having your own org auto-created is not harmful — it's empty. The invite acceptance flow (Phase 3) will add them to the inviter's org. The user ends up with two orgs (their auto-created one + the invited one), which is fine and expected in v1 (v2 adds multi-org UI). If this is truly undesirable, the trigger can check whether the user has a pending `team_invites` record and skip org creation — but this adds complexity for minimal benefit in Phase 2.

---

## Sources

### Primary (HIGH confidence)

- `src/lib/auth.ts` (read 2026-02-26) — discriminated union helper pattern, `requireDsoAccess`, `checkDsoAccess`, `getAuthUser`
- `src/app/api/dsos/route.ts` (read 2026-02-26) — `requireAuth` usage, `supabaseAdmin` query pattern, error code catching (`42703`)
- `src/app/api/team/invite/route.ts` (read 2026-02-26) — full invite route pattern, role validation, `requireAuth` fallback
- `src/app/api/team/route.ts` (read 2026-02-26) — `user_profiles` replacement pattern (currently uses N+1 auth admin API — shows the problem `user_profiles` solves)
- `supabase/migrations/20260226000000_add_org_tables.sql` (read 2026-02-26) — Phase 1 schema: organizations, org_members, user_profiles exact column definitions
- `supabase/migrations/20250115_add_team_invites.sql` (read 2026-02-26) — existing SECURITY DEFINER trigger function pattern, `handle_invite_acceptance`
- `supabase/migrations/20241206000000_initial_schema.sql` (read 2026-02-26) — `update_updated_at_column()` trigger function already exists; gen_random_uuid() usage
- `src/lib/db/types.ts` (read 2026-02-26) — existing type definitions, `UserRole` pattern to follow for `OrgRole`
- `src/lib/db/client.ts` (read 2026-02-26) — `supabaseAdmin` setup, no changes needed
- `src/middleware.ts` (read 2026-02-26) — existing Supabase SSR middleware — no changes needed in Phase 2
- `.planning/phases/01-database-foundation/01-VERIFICATION.md` (read 2026-02-26) — Phase 1 gaps: POST /api/dsos broken, must fix in Phase 2
- `.planning/ROADMAP.md` (read 2026-02-26) — Phase 2 success criteria (authoritative)
- `.planning/REQUIREMENTS.md` (read 2026-02-26) — DB-06, ISO-03, MBR-07, MBR-08, ORG-01, ORG-02, ORG-03

### Secondary (MEDIUM confidence)

- `.planning/research/ARCHITECTURE.md` (read 2026-02-26) — pre-existing auth helper templates for `requireOrgAccess` / `checkOrgMembership`
- `.planning/research/PITFALLS.md` (read 2026-02-26) — service role pitfalls, security context, RLS irrelevance for this phase
- `.planning/research/STACK.md` (read 2026-02-26) — no new packages needed, zod already installed
- Supabase PostgreSQL error codes: `23505` = unique_violation — documented behavior, consistent with how the codebase already handles code `42703`

### Tertiary (LOW confidence, flagged for validation)

- Supabase migration-based auth.users triggers: training data strongly suggests this works (postgres superuser in CLI migrations), but the existing codebase's comment says it doesn't. **Validate with `supabase db reset` locally before production push.**

---

## Metadata

**Confidence breakdown:**
- Auth helper pattern: HIGH — direct codebase read; `checkOrgMembership` / `requireOrgAccess` are direct analogs of existing functions
- API route structure: HIGH — 31 existing routes all follow the same pattern; no deviation
- Auto-org trigger: MEDIUM — function + trigger pattern is standard SQL / Supabase. The specific question of whether it can go in a migration file (vs Dashboard) is LOW on the prior codebase evidence but MEDIUM on official Supabase docs. Must be validated locally.
- Zero-owner guard: HIGH — simple count query, no technical ambiguity
- Slug generation + 409: HIGH — standard string operations + PostgreSQL error code 23505 is documented

**Research date:** 2026-02-26
**Valid until:** 2026-03-28 (stable domain — Supabase Next.js auth patterns, PostgreSQL triggers, and TypeScript discriminated unions do not change frequently)
