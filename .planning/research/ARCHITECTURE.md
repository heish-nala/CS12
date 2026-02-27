# Architecture Research

**Domain:** Multi-tenant organization layer — Next.js 16 App Router + Supabase
**Researched:** 2026-02-26
**Confidence:** HIGH (existing codebase fully read; patterns verified against Supabase docs and MakerKit reference)

---

## Context: What Already Exists

Before any architecture decisions, here is what CS12 currently has:

```
auth.users (Supabase managed)
    └── user_dso_access (join table: user_id, dso_id, role)
            └── dsos (workspaces — what will become clients of an org)
                    └── doctors, activities, tasks, data_tables, etc.
```

**Current access model:**
- Users have many DSOs via `user_dso_access` (role: admin / manager / viewer)
- 31 API routes check access by querying `user_dso_access` directly via `supabaseAdmin` (service role, bypasses RLS)
- Current URL structure: `/clients/[id]` — DSO ID in path
- Current org-switching: URL query param `?dso_id=xxx` on some routes
- No middleware.ts exists today
- React Context: `AuthContext` (user + session), `ClientsContext` (DSO list)

**What "organizations" adds:**
A new layer above DSOs. One organization owns multiple DSOs. Users belong to an organization, and through that get access to DSOs within that org. This is a "CS12 customer is an org" model — e.g., a dental consultancy firm is an organization, and the dentist practices they manage are DSOs.

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                           │
│  ┌───────────────────┐   ┌──────────────────────────────────┐    │
│  │  AuthContext       │   │  OrgContext (NEW)                 │    │
│  │  user + session    │   │  currentOrg + userOrgRole         │    │
│  └───────────────────┘   └──────────────────────────────────┘    │
│  ┌───────────────────┐   ┌──────────────────────────────────┐    │
│  │  ClientsContext    │   │  OrgSwitcher (NEW)                │    │
│  │  dso list          │   │  org picker in sidebar            │    │
│  └───────────────────┘   └──────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
                             │
                     (fetch / API calls)
                             │
┌──────────────────────────────────────────────────────────────────┐
│                    NEXT.JS SERVER (App Router)                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  middleware.ts (NEW)                                         │  │
│  │  - refreshes Supabase auth cookies                           │  │
│  │  - optional: validates org access from URL path              │  │
│  └─────────────────────────────────────────────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│  │  /api/orgs   │  │  /api/dsos   │  │  /api/doctors etc.   │    │
│  │  (NEW)       │  │  (updated)   │  │  (updated)           │    │
│  └──────────────┘  └──────────────┘  └──────────────────────┘    │
│         │                 │                    │                   │
│         └─────────────────┴────────────────────┘                  │
│                           │                                        │
│                   lib/auth.ts (updated)                            │
│                   requireOrgAccess() helper (NEW)                  │
└──────────────────────────────────────────────────────────────────┘
                             │
                   (supabaseAdmin — service role)
                             │
┌──────────────────────────────────────────────────────────────────┐
│                        SUPABASE (PostgreSQL)                       │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────────┐ │
│  │  organizations │  │  org_members   │  │  dsos               │ │
│  │  id, name,     │  │  org_id,       │  │  id, org_id (NEW),  │ │
│  │  slug,         │  │  user_id,      │  │  name, archived     │ │
│  │  created_at    │  │  role          │  └─────────────────────┘ │
│  └────────────────┘  └────────────────┘                           │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  user_dso_access (existing, kept or deprecated post-migrate)  │ │
│  └──────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  RLS policies (org-scoped, if and when service_role removed)  │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `organizations` table | Owns the top-level tenant entity (the CS12 customer company) | `org_members`, `dsos` |
| `org_members` table | Maps users to orgs with a role (admin, member, viewer) | `organizations`, `auth.users` |
| `dsos` table (updated) | Gets `org_id` column added; belongs to one org | `organizations`, `user_dso_access` (or replaced) |
| `OrgContext` (new React context) | Holds `currentOrg` and `userOrgRole` for the active org | `AuthContext`, `OrgSwitcher`, API routes |
| `OrgSwitcher` (new component) | Lets user pick active org; updates OrgContext | `OrgContext`, sidebar layout |
| `lib/auth.ts` (updated) | Adds `requireOrgAccess()` and `checkOrgMembership()` helpers | All API routes |
| `/api/orgs` (new routes) | CRUD for organizations + member management | `OrgContext`, `org_members` |
| `middleware.ts` (new) | Refreshes Supabase auth cookies on every request (required for SSR) | Supabase SSR client |
| Existing 31 API routes | Updated to scope data by org_id, not just dso_id | `organizations`, `dsos` |

---

## Recommended Architecture

### Decision: Keep service_role + application-level authorization

CS12 currently uses `supabaseAdmin` (service role) in all 31 API routes, bypassing RLS entirely. Authorization is enforced in application code via `requireDsoAccess()`. This is a deliberate, documented choice.

**Recommendation: Continue this pattern for organizations.** Do not attempt to migrate 31 routes to RLS-based access simultaneously. Add org-level authorization the same way DSO authorization works today — an `auth.ts` helper that checks a membership table.

**Rationale:**
- Adding RLS on top of service_role usage would require rewriting all 31 routes to use a user-scoped client instead of service_role. That is a separate migration, not part of this milestone.
- MakerKit uses RLS-first, but CS12 is an existing app with working service_role patterns. The Supabase docs confirm service_role + application-level checks is a valid architecture (MEDIUM confidence — Supabase docs don't prohibit it, and the approach is consistent with the existing codebase).
- If RLS migration is desired later, it can be done as a dedicated milestone after org structure is proven.

### Database Schema

```sql
-- New: organizations table
CREATE TABLE organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    slug        TEXT UNIQUE NOT NULL,  -- for URLs: /orgs/acme-corp
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- New: org_members join table (replaces user_dso_access at org level)
CREATE TABLE org_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, user_id)
);

-- Update: dsos gets org_id foreign key
ALTER TABLE dsos ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Backfill: org_invites (same pattern as existing team_invites)
CREATE TABLE org_invites (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'member',
    invited_by  UUID REFERENCES auth.users(id),
    status      TEXT NOT NULL DEFAULT 'pending',
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_org_members_user_id ON org_members(user_id);
CREATE INDEX idx_org_members_org_id  ON org_members(org_id);
CREATE INDEX idx_dsos_org_id         ON dsos(org_id);
```

**On `user_dso_access`:** Keep it during the transition. DSO-level roles (which specific DSOs a user can see within an org) may still be needed. Org membership gives access to the org; `user_dso_access` gives access to specific DSOs within it. If the product decision is "org membership = access to all DSOs," then `user_dso_access` can be deprecated after migration is complete.

### URL Structure

Two viable options — choose based on product needs:

**Option A: Org in URL path (MakerKit pattern)**
```
/orgs/[slug]/                    # org home
/orgs/[slug]/clients/            # clients within org
/orgs/[slug]/clients/[dso_id]/   # specific DSO
```
- Pros: Users can bookmark org-specific URLs, share links, have multiple org tabs open
- Cons: Requires updating all 31 API route fetch calls and all Link hrefs in the app — significant refactor

**Option B: Org as session state (simpler migration)**
```
/                                # same URL structure as today
/clients/[dso_id]/               # unchanged
```
- Org selection stored in React context + localStorage
- API routes receive `org_id` the same way they currently receive `dso_id`
- Pros: Zero URL refactoring, minimal disruption to existing routes
- Cons: No bookmarkable org-specific URLs, harder to share links

**Recommendation: Option B first, Option A later.** For CS12's current scale (single-team app being extended), Option B is far less disruptive and gets the org model working without touching 31 routes. Option A can be layered in a separate milestone if URL portability becomes a product need.

### `lib/auth.ts` Extensions

Add alongside existing helpers (do not replace them):

```typescript
// Check if user belongs to an organization
export async function checkOrgMembership(
    userId: string,
    orgId: string
): Promise<{ isMember: boolean; role: string | null }> {
    const { data, error } = await supabaseAdmin
        .from('org_members')
        .select('role')
        .eq('user_id', userId)
        .eq('org_id', orgId)
        .single();

    if (error || !data) return { isMember: false, role: null };
    return { isMember: true, role: data.role };
}

// Middleware helper: require org membership
export async function requireOrgAccess(
    request: NextRequest,
    orgId: string,
    requireAdmin = false
): Promise<
    { user: AuthUser; role: string; response?: never } |
    { user?: never; role?: never; response: NextResponse }
> {
    const { user, error } = await getAuthUser(request);
    if (!user) {
        return { response: NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 }) };
    }

    const { isMember, role } = await checkOrgMembership(user.id, orgId);
    if (!isMember) {
        return { response: NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 }) };
    }

    if (requireAdmin && role !== 'admin') {
        return { response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
    }

    return { user, role: role! };
}
```

### React Context: OrgContext

Add a new context alongside (not replacing) AuthContext:

```typescript
interface OrgContextType {
    currentOrg: Organization | null;
    userOrgRole: string | null;  // 'admin' | 'member' | 'viewer'
    orgs: Organization[];        // all orgs the user belongs to
    loading: boolean;
    switchOrg: (orgId: string) => void;
}
```

**Persistence:** Store `currentOrgId` in `localStorage` so the user's last org survives page refresh. On load: restore from localStorage → validate user still has membership → fall back to first org if invalid.

**Relationship to existing ClientsContext:** `ClientsContext` currently fetches all DSOs the user has access to. After org integration, it should fetch DSOs filtered by `currentOrg.id`. The `ClientsContext` interface stays the same — just the fetch URL changes to add `org_id`.

---

## Data Flow

### Request Flow: Fetching DSOs Within an Org

```
User selects DSO in sidebar
    ↓
ClientsContext (React) — already has DSOs loaded for currentOrg
    ↓
/clients/[dso_id]/page.tsx renders
    ↓
API call: GET /api/doctors?dso_id=xxx&org_id=yyy
    ↓
route.ts:
  1. requireAuth() — validates session
  2. requireOrgAccess(orgId) — validates org membership (NEW)
  3. checkDsoAccess(userId, dsoId) — validates DSO access (existing)
  4. supabaseAdmin query scoped to dso_id
    ↓
JSON response to client
```

### State Management Flow

```
app load
    ↓
AuthContext.useEffect → supabase.auth.getSession()
    ↓
OrgContext.useEffect (NEW) → GET /api/orgs?user_id=xxx
    ↓
OrgContext sets currentOrg (from localStorage or first result)
    ↓
ClientsContext.useEffect → GET /api/dsos?org_id=yyy
    ↓
Sidebar renders org-scoped DSO list
```

### Key Data Flows

1. **Org switching:** User picks new org in OrgSwitcher → OrgContext.switchOrg() updates state + localStorage → ClientsContext re-fetches DSOs for new org → sidebar updates
2. **New user invite to org:** Admin posts to `/api/orgs/[id]/invite` → `org_invites` record created → Supabase Auth invite email sent → user accepts → `org_members` record inserted → user added to relevant DSOs
3. **DSO scoping:** Every API route that queries `dsos` adds `.eq('org_id', orgId)` guard — ensures cross-org data leakage is impossible even with service_role

---

## Suggested Build Order

Dependencies drive this order:

```
Step 1: Database schema migration
        organizations + org_members + dsos.org_id + org_invites
        (nothing else can be built without the schema)
        ↓
Step 2: lib/auth.ts — add checkOrgMembership() + requireOrgAccess()
        (API routes need these helpers before they can enforce org access)
        ↓
Step 3: /api/orgs routes — CRUD for orgs + member management
        (OrgContext needs this API to exist before it can fetch)
        ↓
Step 4: OrgContext + OrgSwitcher — React context + UI component
        (can be built against the API from step 3)
        ↓
Step 5: Update /api/dsos to scope by org_id
        (ClientsContext needs dsos to be org-scoped)
        ↓
Step 6: Update ClientsContext to pass org_id in fetch
        (sidebar DSO list becomes org-scoped)
        ↓
Step 7: Update remaining 31 API routes to validate org membership
        (defense-in-depth: each route validates org before DSO access)
        ↓
Step 8: Data migration — assign existing dsos to an org
        (backfill org_id on dsos; create a "default org" for existing users)
```

**Steps 7 and 8 can be interleaved.** The most critical path is 1 → 2 → 3 → 4 → 5 → 6.

---

## Architectural Patterns

### Pattern 1: Org-Scoped API Helper (same pattern as existing DSO helpers)

**What:** Every API route that touches org-owned data calls `requireOrgAccess()` before any data operations — mirrors how `requireDsoAccess()` works today.
**When to use:** All routes that return data owned by an org or its child DSOs.
**Trade-offs:** Adds one extra DB query per request (org membership check). Acceptable at this scale; can be cached per request with React's `cache()` if needed.

```typescript
export async function GET(request: NextRequest) {
    // Step 1: Validate auth
    const authResult = await requireAuth(request);
    if ('response' in authResult) return authResult.response;

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');

    // Step 2: Validate org membership (NEW)
    if (orgId) {
        const orgResult = await requireOrgAccess(request, orgId);
        if ('response' in orgResult) return orgResult.response;
    }

    // Step 3: Validate DSO access (existing)
    const dsoId = searchParams.get('dso_id');
    if (dsoId) {
        const accessResult = await requireDsoAccessWithFallback(request, dsoId);
        if ('response' in accessResult) return accessResult.response;
    }

    // Step 4: Query data
    // ...
}
```

### Pattern 2: Backfill-Friendly Migration (add column nullable, backfill, then constrain)

**What:** Add `org_id` to `dsos` as nullable first, run the app, backfill existing rows, then add NOT NULL constraint.
**When to use:** Any schema change to an existing table with production data.
**Trade-offs:** Temporary period where `org_id` can be null — API routes must handle this gracefully during transition.

```sql
-- Phase 1: Add nullable
ALTER TABLE dsos ADD COLUMN org_id UUID REFERENCES organizations(id);

-- Phase 2: Create default org for existing users (migration script)
INSERT INTO organizations (name, slug) VALUES ('Default Org', 'default');
UPDATE dsos SET org_id = '<default-org-id>' WHERE org_id IS NULL;

-- Phase 3: Add constraint (after backfill verified)
ALTER TABLE dsos ALTER COLUMN org_id SET NOT NULL;
```

### Pattern 3: OrgContext as Thin Wrapper on AuthContext

**What:** OrgContext depends on AuthContext (user must be authenticated before fetching orgs). Load sequence: auth resolves first, then org context fetches.
**When to use:** This specific app — do not make OrgContext independent of AuthContext.
**Trade-offs:** Two loading states to manage (auth loading + org loading). Can be combined by having OrgContext watch `auth.loading` before fetching.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Adding `org_id` to Every Table Immediately

**What people do:** Add `org_id` FK to `doctors`, `activities`, `tasks`, `data_tables` etc. simultaneously with adding it to `dsos`.
**Why it's wrong:** Unnecessary if `doctors.dso_id → dsos.org_id` already provides the org chain. Direct `org_id` on leaf tables is redundant and creates a denormalization maintenance problem.
**Do this instead:** Only add `org_id` to `dsos`. Reach org context for any other table via the `dso_id → dsos.org_id` join. Add direct `org_id` to a child table only if query performance requires it.

### Anti-Pattern 2: Replacing `user_dso_access` Before Migration Is Complete

**What people do:** Delete `user_dso_access` the moment `org_members` is created, assuming org membership replaces DSO-level access.
**Why it's wrong:** The app has 31 routes calling `checkDsoAccess()` against `user_dso_access`. Deleting it breaks everything until all routes are updated.
**Do this instead:** Keep `user_dso_access` intact. Run both systems in parallel during migration. Only deprecate `user_dso_access` after all routes are updated and the decision is made on whether per-DSO roles are still needed.

### Anti-Pattern 3: Storing `currentOrgId` Only in Memory

**What people do:** Put `currentOrg` in React state but not localStorage — user loses their org selection on every page refresh.
**Why it's wrong:** Forces re-selection on every load; creates jarring UX.
**Do this instead:** Persist `currentOrgId` to localStorage. On app load: restore from localStorage → validate membership → use it or fall back to first available org.

### Anti-Pattern 4: Validating Org Access Only in OrgContext, Not in API Routes

**What people do:** Trust that the client set `org_id` correctly; don't validate it server-side.
**Why it's wrong:** With service_role bypassing RLS, a user who crafts a request with a different `org_id` gets unrestricted access to that org's data.
**Do this instead:** Every API route that accepts `org_id` as a parameter must call `requireOrgAccess(request, orgId)` before returning data. Never trust client-supplied org IDs without server-side membership verification.

---

## Recommended File Structure Changes

```
src/
├── app/
│   ├── api/
│   │   ├── orgs/                    # NEW: org CRUD
│   │   │   ├── route.ts             # GET (list user's orgs), POST (create org)
│   │   │   ├── [id]/
│   │   │   │   ├── route.ts         # GET, PATCH, DELETE org
│   │   │   │   ├── members/
│   │   │   │   │   └── route.ts     # GET members, POST add member, DELETE remove
│   │   │   │   └── invite/
│   │   │   │       └── route.ts     # POST send invite (same pattern as team/invite)
│   │   │   └── accept-invite/
│   │   │       └── route.ts         # POST accept org invite
│   │   ├── dsos/
│   │   │   └── route.ts             # UPDATED: scoped by org_id
│   │   └── ... (31 existing routes — updated to validate org)
│   └── settings/
│       └── organization/            # NEW: org settings page
│           └── page.tsx
├── components/
│   ├── navigation/
│   │   └── org-switcher.tsx         # NEW: org picker component
│   └── layout/
│       └── notion-sidebar.tsx       # UPDATED: add OrgSwitcher to top
├── contexts/
│   ├── auth-context.tsx             # unchanged
│   ├── org-context.tsx              # NEW: currentOrg + switchOrg
│   └── clients-context.tsx          # UPDATED: filter by org_id
└── lib/
    ├── auth.ts                      # UPDATED: add requireOrgAccess(), checkOrgMembership()
    └── db/
        └── types.ts                 # UPDATED: add Organization, OrgMember types
```

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 orgs | Current service_role + app-level auth is fine. No caching needed. |
| 100-10K orgs | Add index on `org_members(user_id)`. Consider memoizing `checkOrgMembership()` within a request using React's `cache()` to avoid duplicate DB round-trips per request. |
| 10K+ orgs | Consider JWT custom claims for org membership (avoids DB query per request), or dedicated middleware with org membership cache. |

**First bottleneck:** The org membership check adds one DB query per API request. At CS12's current scale this is immaterial. The `org_members` table will have at most a few hundred rows for a long time.

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| OrgContext ↔ AuthContext | OrgContext reads `user` from AuthContext; only fetches when `user` is set | Never fetch orgs before auth resolves |
| OrgContext ↔ ClientsContext | ClientsContext reads `currentOrg.id` from OrgContext; refetches DSOs when org changes | Watch for double-fetch during org switch |
| API routes ↔ lib/auth.ts | Import `requireOrgAccess()`, `requireAuth()`, `requireDsoAccess()` | Keep auth helpers pure functions — no side effects |
| `/api/orgs` ↔ `organizations` + `org_members` | Direct supabaseAdmin queries | Same pattern as `/api/dsos` ↔ `dsos` + `user_dso_access` |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Auth | `supabaseAdmin.auth.admin.inviteUserByEmail()` for org invites | Same as existing `team/invite` route — reuse the pattern |
| Supabase DB | `supabaseAdmin` (service role) for all DB queries | No change to this pattern |

---

## Sources

- Existing CS12 codebase (read Feb 26, 2026): `src/lib/auth.ts`, `src/lib/db/types.ts`, `src/app/api/dsos/route.ts`, `src/app/api/team/invite/route.ts`, `src/contexts/auth-context.tsx`, `src/contexts/clients-context.tsx` — HIGH confidence
- [Supabase RLS Official Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH confidence
- [MakerKit Organizations Overview](https://makerkit.dev/docs/next-supabase/organizations-overview) — MEDIUM confidence (used as reference for table naming conventions and patterns; CS12 does not adopt MakerKit's RLS-first architecture)
- [MakerKit Database Architecture (Turbo)](https://makerkit.dev/docs/next-supabase-turbo/development/database-architecture) — MEDIUM confidence
- [Supabase RLS with membership tables — community discussion](https://github.com/orgs/supabase/discussions/2337) — MEDIUM confidence
- [Multi-tenant RLS patterns — AntStack](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/) — LOW confidence (single source, not official)
- [Supabase best practices — Leanware](https://www.leanware.co/insights/supabase-best-practices) — LOW confidence (single source)

---

*Architecture research for: CS12 — multi-tenant organization layer (Next.js 16 + Supabase)*
*Researched: 2026-02-26*
