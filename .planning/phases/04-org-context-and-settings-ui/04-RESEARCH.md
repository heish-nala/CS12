# Phase 4: Org Context and Settings UI - Research

**Researched:** 2026-02-27
**Domain:** React context, Next.js App Router, shadcn/ui settings UI, Supabase query patterns
**Confidence:** HIGH — all findings sourced directly from codebase; no external dependencies introduced

---

## Summary

Phase 4 is a pure frontend phase. All backend infrastructure already exists: org tables, org membership API, member management endpoints, and invite endpoints are all complete from Phases 1-3. The work is entirely about wiring org data into a React context and surfacing it in the Settings page.

The existing Settings page (`src/app/settings/page.tsx`) already has the right tab structure — it has a "Team" tab backed by `TeamMembers` component and a "Workspace" tab. Phase 4 extends the Team tab to show org-aware members with roles AND DSO assignments, and adds a new "Organization" section showing the org name. The sidebar (`notion-sidebar.tsx`) already has a Settings nav link; no new routing is needed.

The most important architectural decision already made: **org is stored in context/localStorage, NOT in URL segments** (from `[Arch]` decision in STATE.md). This means a new `OrgContext` provider is needed that fetches the user's org on login and holds it in React state, similar to how `ClientsContext` holds DSOs. All settings components read from this context rather than making their own `/api/orgs` calls.

The second key constraint: **`user_dso_access` must remain in place** (Phase 5 concern). The DSO assignment UI in Phase 4 reads and writes `user_dso_access` rows — this is the bridge between the org-level member list and DSO-level permissions that will exist until Phase 5 completes the full route migration.

**Primary recommendation:** Create `OrgContext` provider (mirrors `ClientsContext` pattern), extend the existing Settings "Team" tab with org member list + DSO assignment UI, and add org name display to the sidebar footer and settings header.

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React Context API | React 19.2.0 | OrgContext state management | Already used for AuthContext, ClientsContext, OnboardingContext — same pattern |
| shadcn/ui Tabs | @radix-ui/react-tabs ^1.1.13 | Settings tab structure | Already installed, already used in settings/page.tsx |
| shadcn/ui Select | @radix-ui/react-select ^2.2.6 | Role dropdown, DSO assignment | Already installed, already used in TeamMembers |
| shadcn/ui Dialog | @radix-ui/react-dialog ^1.1.15 | DSO assignment modal | Already installed |
| shadcn/ui Badge | (shadcn source) | Role/status display | Already installed |
| shadcn/ui Table | (shadcn source) | Member list display | Already installed |
| sonner | ^2.0.7 | Toast notifications on save/error | Already installed, already used |
| lucide-react | ^0.555.0 | Icons | Already installed |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @supabase/supabase-js | ^2.86.0 | API fetch from client components | Client-side fetch to /api/orgs/* routes |
| next/navigation | Next 16.0.7 | usePathname (sidebar active state) | Already used in sidebar |
| clsx / tailwind-merge | installed | Conditional classes | Already used via `cn()` util |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Context | Zustand/Jotai | Overkill — project has 3 contexts already using this pattern, no reason to introduce a store |
| Fetch in context | React Query / SWR | Not used anywhere in the project — would be a new dependency |
| Separate Settings page file | Extending existing settings/page.tsx | Extension is correct — the page already exists with tabs |

**Installation:** No new packages needed. All dependencies already installed.

---

## Architecture Patterns

### Recommended Project Structure

New files for Phase 4:

```
src/
├── contexts/
│   └── org-context.tsx               # NEW — OrgContext provider (mirrors clients-context.tsx)
├── components/
│   └── settings/
│       ├── org-settings.tsx           # NEW — org name display + member list with DSO assignments
│       └── dso-assignment-dialog.tsx  # NEW — modal to add/remove DSO access for a member
├── app/
│   └── settings/
│       └── page.tsx                   # MODIFIED — add "Organization" tab, import OrgSettings
└── components/
    └── layout/
        └── notion-sidebar.tsx         # MODIFIED — show org name in footer
```

Modified files:

```
src/app/layout.tsx                     # MODIFIED — wrap with OrgProvider
```

### Pattern 1: OrgContext Provider (mirrors ClientsContext)

**What:** A React context provider that fetches the user's org membership on login and exposes org data to all children.

**When to use:** All settings components, sidebar org display.

**Example — follows the exact ClientsContext pattern:**

```typescript
// src/contexts/org-context.tsx
'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useAuth } from './auth-context';
import { Organization, OrgRole } from '@/lib/db/types';

interface OrgWithRole extends Organization {
    role: OrgRole;
}

interface OrgContextType {
    org: OrgWithRole | null;
    loading: boolean;
    refreshOrg: () => Promise<void>;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

export function OrgProvider({ children }: { children: ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const [org, setOrg] = useState<OrgWithRole | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchOrg = useCallback(async () => {
        if (!user?.id) {
            if (!authLoading) setLoading(false);
            return;
        }
        try {
            const response = await fetch('/api/orgs');
            if (response.ok) {
                const data = await response.json();
                // v1 assumption: user has exactly one org
                setOrg(data.orgs?.[0] ?? null);
            }
        } catch (error) {
            console.error('Error fetching org:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.id, authLoading]);

    useEffect(() => {
        if (!authLoading && user?.id) {
            fetchOrg();
        } else if (!authLoading && !user?.id) {
            setLoading(false);
        }
    }, [user?.id, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <OrgContext.Provider value={{ org, loading, refreshOrg: fetchOrg }}>
            {children}
        </OrgContext.Provider>
    );
}

export function useOrg() {
    const context = useContext(OrgContext);
    if (context === undefined) {
        throw new Error('useOrg must be used within an OrgProvider');
    }
    return context;
}
```

**Important:** `GET /api/orgs` already exists and returns `{ orgs: Array<Organization & { role: OrgRole }> }`. No new API route needed.

### Pattern 2: Settings Page — Add Organization Tab

**What:** Extend `src/app/settings/page.tsx` to add an "Organization" tab alongside the existing "Team" and "Workspace" tabs.

**Key observation:** The existing "Team" tab uses `TeamMembers`, which is scoped to `user_dso_access` (the old DSO-level model). Phase 4 adds a NEW "Organization" tab that shows org-level members + DSO assignments. The old "Team" tab can remain as-is (it will be deprecated in Phase 5 or beyond).

```typescript
// In settings/page.tsx — add import and new tab
import { OrgSettings } from '@/components/settings/org-settings';
// ...
<TabsTrigger value="organization" className="gap-2">
    <Building2 className="h-4 w-4" />
    Organization
</TabsTrigger>
// ...
<TabsContent value="organization" className="mt-0">
    <OrgSettings />
</TabsContent>
```

### Pattern 3: OrgSettings Component Structure

**What:** The main settings component for Phase 4. Shows org name, member list with org roles, and DSO assignments per member.

**Data sources:**
- Org info: `GET /api/orgs` (via OrgContext — already fetched, reuse)
- Member list with profiles: `GET /api/orgs/[id]/members` — returns `OrgMemberWithProfile[]` with `user_profiles` join
- DSO assignments per member: `GET /api/team?user_id=<memberId>` OR a new query against `user_dso_access` — see Pitfalls section
- All DSOs in org: `GET /api/dsos` (filtered to user's access — but for admin viewing all org DSOs, needs org-scoped query)

**Critical gap:** There is no existing endpoint that returns "all DSOs in this org" for an admin to see. The existing `GET /api/dsos` filters by `user_dso_access` for the requesting user. Phase 4 needs either:
  - A new route `GET /api/orgs/[id]/dsos` that returns all DSOs belonging to the org (querying `dsos WHERE org_id = id`), OR
  - Reusing `GET /api/dsos` with admin-level bypass

Given the pattern in the codebase (`supabaseAdmin` + application-level auth everywhere), adding `GET /api/orgs/[id]/dsos` is clean and consistent. This is a new route needed in Phase 4.

**Member-level DSO access:** To show which DSOs each member is assigned to, query `user_dso_access WHERE user_id = member.user_id` and join to `dsos`. Currently no single endpoint does this. Two options:
  - Add `GET /api/orgs/[id]/members/[userId]/dsos` — clean but adds 2 routes
  - Fetch all `user_dso_access` for the org's DSOs in one query from a new endpoint — more efficient
  - Simplest: fetch `GET /api/team?user_id=<memberId>` per member — but that's N requests (N = members)

Recommended: Add a single `GET /api/orgs/[id]/dso-access` endpoint that returns all `user_dso_access` rows for all DSOs in the org, grouped by user_id. The settings component fetches once and builds a lookup map. This avoids N+1.

**DSO assignment write operations:**
- Add member to DSO: `POST /api/team/invite` (existing) — but this sends an invite email. Not right for admin-adding existing members.
  - Better: add `POST /api/orgs/[id]/dso-access` that directly inserts into `user_dso_access`
- Remove member from DSO: `DELETE /api/team/[id]` (existing, deletes by membership ID) — usable
  - Or: `DELETE /api/orgs/[id]/dso-access?user_id=X&dso_id=Y` — cleaner

Given Phase 5 will deprecate `user_dso_access`, keeping these routes in the org namespace (`/api/orgs/[id]/dso-access`) makes them easy to find and remove later.

### Pattern 4: DSO Assignment Dialog

**What:** A modal (shadcn Dialog) that opens when admin clicks a member row, showing checkboxes for each DSO in the org with the member's current assignments checked.

**Pattern (from add-member-dialog.tsx):**

```typescript
// src/components/settings/dso-assignment-dialog.tsx
interface DsoAssignmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    member: OrgMemberWithProfile;
    orgId: string;
    allDsos: DSO[];
    currentAssignments: string[]; // dso_ids
    onSave: () => void;
}
```

The dialog shows all org DSOs as checkboxes. On save, computes diff (added/removed) and makes PATCH calls. Shows loading state on save. On success, calls `onSave()` to trigger parent refresh.

### Pattern 5: Sidebar Org Name Display

**What:** Show the org name in the sidebar, near the user footer or as a header section. Provides the "which org am I in" context for requirement UI-02.

**Where:** `src/components/layout/notion-sidebar.tsx` — currently shows "CS12" logo text at the top and user email at the bottom. Org name goes in the header area, replacing or augmenting the "CS12" workspace name.

**Data source:** `useOrg()` hook from OrgContext.

```typescript
// In notion-sidebar.tsx
import { useOrg } from '@/contexts/org-context';
// ...
const { org } = useOrg();
// In the header section:
<span className="font-medium text-[14px] text-foreground">
    {org?.name ?? 'CS12'}
</span>
```

### Pattern 6: OrgProvider Registration

**What:** Add `OrgProvider` to `src/app/layout.tsx` inside the `AuthProvider` wrapper but outside `AuthGuard`, so it loads after auth but before any page content.

```typescript
// src/app/layout.tsx
import { OrgProvider } from '@/contexts/org-context';

// In JSX:
<AuthProvider>
    <ClientsProvider>
        <OrgProvider>                    {/* NEW */}
            <OnboardingProvider>
                <AuthGuard>
                    <AppShell>{children}</AppShell>
                    ...
                </AuthGuard>
            </OnboardingProvider>
        </OrgProvider>                   {/* NEW */}
    </ClientsProvider>
</AuthProvider>
```

**Note:** OrgProvider must be inside AuthProvider (needs user) but can be at same level as ClientsProvider (both depend on user, neither depends on the other).

### Anti-Patterns to Avoid

- **Fetching org in every component:** Do NOT call `/api/orgs` inside `OrgSettings`, `DSOSwitcher`, or `NotionSidebar` individually. Use OrgContext — fetch once, share everywhere.
- **N+1 DSO access queries:** Do NOT fetch `user_dso_access` per member in a loop. Fetch all access rows for the org in one call.
- **Org in URL segments:** Do NOT add `/settings/[orgId]` or similar. The prior arch decision is explicit: org stored in context, not URL. Adding org to the URL would require refactoring all 31 routes.
- **Writing to new org routes for DSO access:** Do NOT create routes that bypass `user_dso_access` entirely. Phase 5 handles the full transition. Phase 4 reads/writes `user_dso_access` as the source of truth for DSO assignments.
- **Hardcoding currentUserRole as 'admin':** The existing `TeamMembers` component does `const currentUserRole: UserRole = 'admin'` (line 88 — acknowledged as demo behavior). In Phase 4, derive the role from `OrgContext` (`org.role`) for real role-based UI control.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Role-badge display | Custom role badge system | Extend the existing `ROLE_CONFIG` pattern from `team-members.tsx` | Identical pattern already exists for DSO roles; just add org roles |
| Toast notifications | Custom notification system | `sonner` (already installed) | Already used throughout the app |
| Modal dialogs | Custom overlay/portal | shadcn `Dialog` (already installed) | Consistent with all other dialogs in the codebase |
| Checkbox list for DSOs | Custom multi-select | shadcn `Checkbox` (already installed) | Consistent pattern |
| Optimistic UI updates | Complex cache management | `useState` + refetch on confirm | App doesn't use React Query; simple refetch is correct |

**Key insight:** Everything needed already exists. The only new code is wiring: context provider, settings component, assignment dialog, and 2-3 new API routes.

---

## Common Pitfalls

### Pitfall 1: OrgProvider loads before auth is ready

**What goes wrong:** `OrgProvider` calls `/api/orgs` before `AuthProvider` has established the session. The fetch returns 401. Org state stays null. Settings page shows blank.

**Why it happens:** React renders providers synchronously; the auth session is async.

**How to avoid:** Mirror the `ClientsContext` guard exactly:
```typescript
useEffect(() => {
    if (!authLoading && user?.id) {
        fetchOrg();
    } else if (!authLoading && !user?.id) {
        setLoading(false);
    }
}, [user?.id, authLoading]);
```
Do NOT start the fetch until `authLoading === false && user?.id` is truthy.

**Warning signs:** `org` is null after login but `/api/orgs` returns data when called manually.

### Pitfall 2: `GET /api/orgs` returns array — v1 assumes index 0

**What goes wrong:** `GET /api/orgs` returns `{ orgs: [...] }`. In v1, users have exactly one org. If the code does `data.orgs[0]`, it works. But if a user has zero orgs (e.g., new user before signup trigger fires), `data.orgs[0]` is undefined and downstream `org.id` throws.

**Why it happens:** The signup trigger creates the org, but there's a brief window or edge case (demo user has TWO orgs per STATE.md).

**How to avoid:** Guard with `data.orgs?.[0] ?? null`. Render org-dependent UI only when `org !== null`. Show a skeleton or "No organization found" fallback.

**Warning signs:** TypeError on `org.id` in settings component.

### Pitfall 3: DSO list for admin needs org-scoped query, not user_dso_access-scoped

**What goes wrong:** Admin opens DSO assignment dialog. It calls `GET /api/dsos?user_id=admin` which returns only DSOs the admin has access to via `user_dso_access`. A DSO that exists in the org but isn't assigned to the admin is invisible in the dialog.

**Why it happens:** `GET /api/dsos` filters by `user_dso_access`, not by `org_id`. The admin can't see DSOs they haven't been assigned to.

**How to avoid:** Create `GET /api/orgs/[id]/dsos` that queries `SELECT * FROM dsos WHERE org_id = id` (with org membership check, not DSO access check). Use this endpoint in the assignment dialog to get the full org DSO list.

**Warning signs:** Admin cannot assign a member to a DSO they themselves don't have in their `user_dso_access` list.

### Pitfall 4: Role-based UI — admin vs member visibility

**What goes wrong:** Non-admin members see the DSO assignment controls and can modify other members' access.

**Why it happens:** The existing `TeamMembers` hardcodes `currentUserRole = 'admin'`. Phase 4 must derive the real role from `OrgContext`.

**How to avoid:** Read `org.role` from `useOrg()`. Only show edit controls when `org.role === 'owner' || org.role === 'admin'`.

```typescript
const { org } = useOrg();
const canManage = org?.role === 'owner' || org?.role === 'admin';
```

**Warning signs:** Member-role users can click "Edit DSO Access" buttons.

### Pitfall 5: `OrgMemberWithProfile` join key is `user_profiles` (not `profile`)

**What goes wrong:** Trying to access `member.profile.email` throws undefined. The join returns `member.user_profiles.email`.

**Why it happens:** Supabase join key is the table name: `.select('*, user_profiles(*)')` returns `{ ..., user_profiles: { id, email, name, ... } }`.

**How to avoid:** Use `member.user_profiles?.email` and `member.user_profiles?.name`. This matches the existing `OrgMemberWithProfile` type in `src/lib/db/types.ts` (line 527-529 confirmed: `user_profiles: UserProfile | null`).

**Warning signs:** TypeScript errors on `member.profile` or `member.user_profile`.

### Pitfall 6: DSO assignment changes don't reflect immediately in sidebar DSO list

**What goes wrong:** Admin removes a member's DSO access in settings. Member's sidebar DSO list (`ClientsContext`) doesn't update because it was fetched on login and cached.

**Why it happens:** `ClientsContext` fetches once on login. DSO access changes are not propagated via WebSocket/real-time.

**How to avoid:** The success criteria says "takes effect immediately on next page load" — this is acceptable behavior. Document that DSO access changes require a page reload to reflect in the member's sidebar. The member's next navigation or refresh will call `GET /api/dsos` again with their updated `user_dso_access`.

**Warning signs:** Confusion that "change didn't work" when actually it did — just needs refresh.

---

## Code Examples

Verified patterns from existing codebase:

### Existing: GET /api/orgs response shape

```typescript
// GET /api/orgs response (from src/app/api/orgs/route.ts)
// Returns: { orgs: Array<Organization & { role: OrgRole }> }
const orgs = (data || []).map((row: any) => ({
    ...row.organizations,
    role: row.role,
}));
return NextResponse.json({ orgs });
```

### Existing: GET /api/orgs/[id]/members response shape

```typescript
// GET /api/orgs/[id]/members response (from src/app/api/orgs/[id]/members/route.ts)
// Returns: { members: OrgMemberWithProfile[] }
// Each member has: id, org_id, user_id, role, joined_at, user_profiles: { id, email, name }
const { data: members } = await supabaseAdmin
    .from('org_members')
    .select('*, user_profiles(*)')
    .eq('org_id', id)
    .order('joined_at', { ascending: true });
return NextResponse.json({ members });
```

### Existing: requireOrgAccess usage (for new routes)

```typescript
// Standard pattern for new org-scoped routes
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const authResult = await requireOrgAccess(request, id);
    if (authResult.response) return authResult.response;

    // ... business logic with supabaseAdmin
}

// Admin-only routes use requireOwnerOrAdmin = true:
const authResult = await requireOrgAccess(request, id, true);
```

### New: GET /api/orgs/[id]/dsos (to be created in Phase 4)

```typescript
// src/app/api/orgs/[id]/dsos/route.ts
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const authResult = await requireOrgAccess(request, id);
    if (authResult.response) return authResult.response;

    const { data: dsos, error } = await supabaseAdmin
        .from('dsos')
        .select('*')
        .eq('org_id', id)
        .or('archived.is.null,archived.eq.false')
        .order('name');

    if (error) {
        return NextResponse.json({ error: 'Failed to fetch DSOs' }, { status: 500 });
    }
    return NextResponse.json({ dsos });
}
```

### New: GET /api/orgs/[id]/dso-access (to be created in Phase 4)

```typescript
// Returns all user_dso_access rows for DSOs in this org
// Shape: { access: Array<{ user_id, dso_id, role }> }
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    // Require admin/owner to view all member assignments
    const authResult = await requireOrgAccess(request, id, true);
    if (authResult.response) return authResult.response;

    // Get all DSO IDs in this org
    const { data: dsos } = await supabaseAdmin
        .from('dsos')
        .select('id')
        .eq('org_id', id);

    const dsoIds = (dsos || []).map(d => d.id);

    const { data: access, error } = await supabaseAdmin
        .from('user_dso_access')
        .select('user_id, dso_id, role')
        .in('dso_id', dsoIds);

    if (error) {
        return NextResponse.json({ error: 'Failed to fetch DSO access' }, { status: 500 });
    }
    return NextResponse.json({ access });
}
```

### New: POST /api/orgs/[id]/dso-access (assign member to DSO)

```typescript
// Body: { user_id: string, dso_id: string, role?: UserRole }
// Inserts into user_dso_access (the bridge table Phase 5 will deprecate)
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const authResult = await requireOrgAccess(request, id, true);
    if (authResult.response) return authResult.response;

    const { user_id, dso_id, role = 'viewer' } = await request.json();
    // Validate dso belongs to org first
    const { data: dso } = await supabaseAdmin
        .from('dsos').select('id').eq('id', dso_id).eq('org_id', id).single();
    if (!dso) {
        return NextResponse.json({ error: 'DSO not in this organization' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
        .from('user_dso_access')
        .insert({ user_id, dso_id, role });
    if (error?.code === '23505') {
        return NextResponse.json({ error: 'User already has access to this DSO' }, { status: 409 });
    }
    if (error) {
        return NextResponse.json({ error: 'Failed to assign DSO access' }, { status: 500 });
    }
    return NextResponse.json({ success: true }, { status: 201 });
}
```

### New: DELETE /api/orgs/[id]/dso-access (remove member from DSO)

```typescript
// Query params: ?user_id=<uuid>&dso_id=<uuid>
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const authResult = await requireOrgAccess(request, id, true);
    if (authResult.response) return authResult.response;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const dsoId = searchParams.get('dso_id');

    if (!userId || !dsoId) {
        return NextResponse.json({ error: 'user_id and dso_id are required' }, { status: 400 });
    }
    // Validate dso belongs to org
    const { data: dso } = await supabaseAdmin
        .from('dsos').select('id').eq('id', dsoId).eq('org_id', id).single();
    if (!dso) {
        return NextResponse.json({ error: 'DSO not in this organization' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
        .from('user_dso_access')
        .delete()
        .eq('user_id', userId)
        .eq('dso_id', dsoId);
    if (error) {
        return NextResponse.json({ error: 'Failed to remove DSO access' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Org data fetched per component | OrgContext provider (fetch once, share everywhere) | Eliminates redundant API calls |
| `currentUserRole: UserRole = 'admin'` hardcoded | Read from `org.role` via OrgContext | Real role enforcement in UI |
| Team tab shows DSO-level members only | New Organization tab shows org-level members + DSO assignments | Satisfies UI-01, UI-02, UI-03 |
| No org display in sidebar | Org name shown in sidebar header | User always knows which org they're in |

**Deprecated/outdated after Phase 4:**
- The hardcoded `currentUserRole = 'admin'` in `TeamMembers` — replace with real role from OrgContext

---

## New API Routes Required

Phase 4 requires these new backend routes (all follow existing patterns):

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `GET /api/orgs/[id]/dsos` | GET | List all DSOs in org (for admin to assign from) | org member |
| `GET /api/orgs/[id]/dso-access` | GET | All user_dso_access rows for org's DSOs | owner/admin |
| `POST /api/orgs/[id]/dso-access` | POST | Grant member access to a DSO | owner/admin |
| `DELETE /api/orgs/[id]/dso-access` | DELETE | Remove member's access to a DSO | owner/admin |

**Note:** These 4 routes are the bridge to `user_dso_access` — they exist only for the Phase 4/5 transition period. Phase 5 will deprecate `user_dso_access` entirely and these routes will be removed or replaced.

---

## Open Questions

1. **Role change for org members (MBR-06) — in or out of Phase 4?**
   - What we know: The REQUIREMENTS.md maps MBR-06 (change member org-level role) to Phase 5. The Phase 4 success criteria don't mention it.
   - What's unclear: The org settings member list naturally invites a role dropdown. Is Phase 4 supposed to include role editing or just display?
   - Recommendation: Display org roles in Phase 4 but defer the role-change dropdown to Phase 5 (consistent with requirements traceability). Add a note/badge showing roles but no edit control.

2. **Does "member can see which DSOs they're assigned to" (UI-02) require a separate "My Access" view?**
   - What we know: A member (non-admin) visiting settings should see their own DSO assignments. An admin sees all members' assignments.
   - What's unclear: Should this be a separate tab/section or inline in the org settings?
   - Recommendation: Show the requesting user's own DSO list in a "My Access" section visible to all roles. The full member list + DSO assignment matrix is visible only to admins/owners.

3. **How to handle the demo user's two-org edge case?**
   - What we know: STATE.md notes the demo user has two orgs in local dev ("demo" slug + "demo-org"). `OrgContext` takes `data.orgs?.[0]`.
   - Recommendation: For v1, take `orgs[0]`. Log a warning if `orgs.length > 1`. The v2 org switcher (MORG-02) will handle this properly.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)

- `src/contexts/auth-context.tsx` — AuthContext pattern (provider structure, useEffect guard on authLoading)
- `src/contexts/clients-context.tsx` — ClientsContext pattern (fetch on user, expose refreshClients)
- `src/app/api/orgs/route.ts` — GET /api/orgs response shape verified
- `src/app/api/orgs/[id]/members/route.ts` — member list API verified, OrgMemberWithProfile join key confirmed
- `src/app/api/orgs/[id]/route.ts` — requireOrgAccess usage pattern verified
- `src/app/api/orgs/[id]/invites/route.ts` — POST/GET pattern for org-scoped routes
- `src/app/api/dsos/route.ts` — user_dso_access filter confirmed (pitfall source)
- `src/lib/auth.ts` — requireOrgAccess, checkOrgMembership implementations
- `src/lib/db/types.ts` — OrgMemberWithProfile type (user_profiles key confirmed line 527-529)
- `src/lib/org-utils.ts` — VALID_ORG_ROLES, OrgRole confirmed
- `src/app/settings/page.tsx` — existing settings tab structure
- `src/components/settings/team-members.tsx` — hardcoded role bug identified (line 88)
- `src/components/layout/notion-sidebar.tsx` — sidebar structure for org name placement
- `src/app/layout.tsx` — provider wrapping order
- `supabase/migrations/20260226000000_add_org_tables.sql` — org tables confirmed (organizations, org_members, user_profiles)
- `supabase/migrations/20260227000001_org_signup_trigger.sql` — signup trigger confirmed
- `supabase/migrations/20260227100000_add_org_invites.sql` — org_invites table confirmed
- `.planning/STATE.md` — arch decisions confirmed (org in context not URL, user_dso_access stays)
- `.planning/REQUIREMENTS.md` — Phase 4 requirements UI-01, UI-02, UI-03 confirmed
- `.planning/ROADMAP.md` — Phase 4 success criteria verified
- `.planning/phases/03-invite-system/03-VERIFICATION.md` — Phase 3 PASSED, all endpoints wired

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed, no new dependencies
- Architecture: HIGH — OrgContext pattern is a direct mirror of ClientsContext (verified code)
- New API routes: HIGH — all follow requireOrgAccess pattern (verified), code examples provided
- Pitfalls: HIGH — all sourced from specific bugs/patterns identified in real code
- UI component structure: HIGH — settings page, dialog pattern, and sidebar all verified in code

**Research date:** 2026-02-27
**Valid until:** 2026-04-27 (stable stack — Next.js, Supabase, shadcn versions locked in package.json)
