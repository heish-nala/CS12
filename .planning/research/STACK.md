# Stack Research

**Domain:** Multi-tenant organization/workspace layer — Next.js 16 + Supabase app
**Researched:** 2026-02-26
**Confidence:** HIGH (based on direct codebase analysis + authoritative Supabase patterns)

---

## What Already Exists (Do Not Re-Introduce)

Before recommending new packages, here is what the existing CS12 stack already has:

| Already Installed | Version | Status |
|-------------------|---------|--------|
| `next` | ^16.0.7 | Keep as-is |
| `react` / `react-dom` | 19.2.0 | Keep as-is |
| `@supabase/supabase-js` | ^2.86.0 | Keep as-is |
| `@supabase/ssr` | ^0.8.0 | Keep as-is — this is the correct SSR library for Next.js App Router |
| `typescript` | ^5 | Keep as-is |
| `tailwindcss` | ^4 | Keep as-is |
| `zod` | ^4.1.13 | Keep as-is — use for all new validation |
| Radix UI / shadcn/ui | current | Keep as-is — use for org switcher UI |

**Existing auth architecture (keep):**
- `createServerClient` from `@supabase/ssr` in middleware and server contexts
- `createBrowserClient` from `@supabase/ssr` for client-side
- `supabaseAdmin` (service role) for API routes — this pattern stays
- `user_dso_access` table — this is already a membership/org-membership table and needs to be migrated, not replaced

---

## What the Existing System Has That's Already Org-Like

This is critical context: CS12 already has partial multi-tenancy implemented. The `dsos` table IS the organizations table. The `user_dso_access` table IS the membership table. The `team_invites` table IS an invite system.

**What's missing is:**
1. An `organizations` wrapper concept distinct from DSO clients (so "org" = the CS12 account a user logs into, "client/DSO" = the dental practices they manage inside that org)
2. OR: recognition that each DSO is already an org, and the missing piece is just the org switcher UI + middleware org-scoping
3. Invite system currently grants access to ALL of the inviter's DSOs — needs to be per-org
4. No `active_org_id` persisted in session/cookie for the org switcher

The research recommendation is: **DSOs ARE organizations** — rename conceptually, add org switcher, not a separate layer.

---

## Recommended Stack for Multi-Tenancy Addition

### No New Core Libraries Needed

The existing stack already contains everything required. Do not add:
- A new auth library (Supabase Auth already handles this)
- A new ORM (direct Supabase client queries are the pattern throughout)
- A separate permissions library (Zod + Supabase RLS handles this)

### New Database Patterns (SQL-only, no new packages)

**Pattern 1: Active org stored in cookie (middleware-resolved)**

The standard approach for the Linear/Vercel org-switcher model is:

```
Cookie: active_org_id=<dso_uuid>
Middleware reads cookie → sets org context → passes to server components via header
```

No new library needed. Use Next.js `cookies()` from `next/headers` in Server Components, and `request.cookies` in middleware — both already available.

**Pattern 2: Supabase JWT custom claims for RLS**

For RLS policies that need to know the active org without a subquery on every row:

```sql
-- Set active org in JWT claim
-- Called from API route after org switch
SELECT set_config('app.active_org_id', '<uuid>', true);
```

This enables RLS policies like:
```sql
USING (dso_id = current_setting('app.active_org_id')::uuid)
```

Instead of the current subquery pattern:
```sql
USING (dso_id IN (SELECT dso_id FROM user_dso_access WHERE user_id = auth.uid()::text))
```

**Recommendation:** Keep the existing subquery RLS pattern for correctness and simplicity. The JWT claim approach adds complexity and is an optimization to defer unless query performance becomes a bottleneck.

### Supporting Libraries — New Additions

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `cookies-next` | ^4.3.0 | Persist `active_org_id` in cookie client-side | Works with Next.js App Router; the built-in `next/headers` cookies API is server-only, so client components need this when switching orgs |
| None else needed | — | — | Existing stack covers everything else |

**Confidence:** MEDIUM on `cookies-next` version (package exists and is actively maintained as of training data; verify current version with `npm show cookies-next version`). The need for it is HIGH confidence.

**Alternative to cookies-next:** Store `active_org_id` in `localStorage` via a React context, read it in Client Components, pass to API routes as a header. Simpler but breaks Server Component access. Recommend cookies approach.

### UI Components for Org Switcher

No new UI library needed. Build org switcher using existing:
- `@radix-ui/react-dropdown-menu` (already installed ^2.1.16) — for the switcher dropdown
- `@radix-ui/react-dialog` (already installed ^1.1.15) — for "Create organization" dialog
- `lucide-react` (already installed) — for icons (Building2, ChevronDown, Check)
- `cmdk` (already installed ^1.1.1) — optional command palette for org search if org count grows large

**Pattern to follow:** The Vercel/Linear org switcher is a dropdown in the sidebar showing the active org with a chevron. Clicking opens a list of orgs the user belongs to, with a "Create new" option at the bottom.

---

## Database Changes Required (SQL Migrations, No New Packages)

### Migration 1: Add `organizations` table (if separating org from DSO)

**Decision required before building:** Two valid approaches:

**Option A — DSOs ARE orgs (recommended for CS12):**
The existing `dsos` table already functions as the org table. Users log into a workspace (DSO), invite teammates, and manage clients within it. No new `organizations` table needed.

Add to `dsos` table:
```sql
ALTER TABLE dsos ADD COLUMN slug TEXT UNIQUE; -- for URL routing /org/[slug]/...
ALTER TABLE dsos ADD COLUMN logo_url TEXT;
ALTER TABLE dsos ADD COLUMN owner_id UUID REFERENCES auth.users(id);
```

Add to `user_dso_access` table:
```sql
-- Already has: user_id, dso_id, role, created_at
-- Add: invited_by reference and accepted tracking
ALTER TABLE user_dso_access ADD COLUMN invited_by UUID;
ALTER TABLE user_dso_access ADD COLUMN joined_at TIMESTAMPTZ DEFAULT NOW();
```

**Option B — Organizations as a separate layer above DSOs:**
Create `organizations` → each org has many `dso_clients` (the dental practices they manage). Users belong to an org, not directly to DSOs.

This is a larger refactor and only makes sense if CS12 customers will have multiple DSO clients to manage. Looking at the codebase, each CS12 customer (e.g., a dental consulting firm) manages multiple DSOs — so this IS the use case.

**Final recommendation: Option B.** The current model conflates "the company using CS12" with "the dental clients they manage." Adding a proper `organizations` table makes the model correct.

```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    owner_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    invited_by UUID REFERENCES auth.users(id),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, user_id)
);

-- Add org_id to dsos so each DSO client belongs to an org
ALTER TABLE dsos ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
```

Then migrate all existing `user_dso_access` data into `organization_members` with data migration SQL.

### Migration 2: Fix invite system scoping

Current `team_invites` invites to a specific `dso_id` but the accept handler grants access to ALL of the inviter's DSOs. Change invites to be org-scoped:

```sql
-- Add org_id to team_invites, keep dso_id optional
ALTER TABLE team_invites ADD COLUMN org_id UUID REFERENCES organizations(id);
```

---

## Active Org Context Pattern (No New Library)

The standard pattern for "which org am I in right now?" in Next.js App Router:

**1. Cookie (server-readable, persisted):**
```typescript
// Set when user switches org or first logs in
// In a Server Action or API Route:
import { cookies } from 'next/headers'
cookies().set('active_org_id', orgId, { httpOnly: true, path: '/' })
```

**2. URL segment (most explicit, best for bookmarking):**
```
/[orgSlug]/dashboard
/[orgSlug]/clients
/[orgSlug]/settings
```

This is the MakerKit / Linear pattern. The org slug is in the URL. No cookie needed for "which org" — it's in the URL. Middleware validates the user has access to that org.

**Recommendation: URL-based org routing.** It's explicit, bookmarkable, and avoids cookie sync bugs. The trade-off is URL migration — existing routes like `/dashboard` become `/[orgSlug]/dashboard`. This is a page restructure, not a library change.

---

## Middleware Pattern (Update Existing, No New Library)

Current `src/middleware.ts` only refreshes the Supabase session. Extend it to:

1. Parse org slug from URL (if using URL-based routing)
2. Validate user is a member of that org
3. Redirect to org selector if user has no orgs
4. Inject `x-org-id` header for downstream Server Components

```typescript
// Middleware extension — no new dependencies
// Uses existing @supabase/ssr + native NextRequest/NextResponse
```

**Confidence:** HIGH — this is the documented Supabase + Next.js App Router pattern.

---

## Email for Invites (Existing or Minimal Addition)

Current system uses `supabaseAdmin.auth.admin.inviteUserByEmail()` — this sends Supabase's built-in invite email. This works for MVP but the email is generic (Supabase-branded).

For custom invite emails:

| Option | Package | Why |
|--------|---------|-----|
| Keep Supabase built-in | None | Fastest. Works now. Supabase email is configurable via SMTP. |
| Resend | `resend` ^4.x | Best DX for custom transactional email in Next.js. React Email templates. $0 for <100 emails/day. |
| SendGrid | `@sendgrid/mail` | More established but worse DX. Only if already using SendGrid. |

**Recommendation: Keep Supabase built-in invite emails for MVP.** Add Resend only when custom branding is required. No package needed now.

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `next-auth` / `auth.js` | App already uses Supabase Auth — mixing auth libraries creates session conflicts | Supabase Auth (already installed) |
| `@clerk/nextjs` | Would require ripping out Supabase Auth entirely. Complete rewrite. | Supabase Auth (already installed) |
| `prisma` | App uses direct Supabase client, not an ORM. Adding Prisma creates two data access patterns. | Supabase client (already in use) |
| `drizzle-orm` | Same reason as Prisma — not worth the migration cost until Supabase limitations hit | Direct Supabase client |
| Separate state management (Redux, Zustand) for active org | Overkill — a React context + cookie is sufficient | `React.createContext` + cookie |
| `next-middleware-supabase` | Does not exist — don't confuse with `@supabase/ssr` | `@supabase/ssr` (already installed) |

---

## Stack Patterns by Scenario

**If staying with DSOs-as-orgs (Option A):**
- Zero new packages needed
- Add `active_dso_id` cookie tracking
- Add org switcher dropdown component
- Fix invite system scoping to specific DSO only
- Estimated complexity: LOW

**If adding proper organizations layer (Option B — recommended):**
- Zero new packages needed (maybe `cookies-next` for client-side cookie writes)
- New `organizations` + `organization_members` tables
- URL restructure: `/[orgSlug]/dashboard`
- Middleware update to validate org membership
- Data migration for existing users
- Estimated complexity: MEDIUM

**If custom invite emails become required:**
- Add `resend` ^4.x
- Add React Email templates
- Estimated complexity: LOW (add-on, not blocking)

---

## Version Compatibility Notes

| Package | Current Version | Notes |
|---------|-----------------|-------|
| `@supabase/ssr` | ^0.8.0 | Compatible with Next.js 16 App Router. The `createServerClient` pattern used in middleware.ts is correct. |
| `@supabase/supabase-js` | ^2.86.0 | `auth.admin.inviteUserByEmail()` is available in v2.x. Service role required. |
| `next` | ^16.0.7 | `cookies()` from `next/headers` available. Dynamic route segments `[orgSlug]` work as expected. |
| `zod` | ^4.1.13 | Use for validating org creation/invite request bodies. Breaking changes from v3 — do not downgrade. |
| `cookies-next` | Verify current | Must be compatible with Next.js App Router (not Pages Router). Check npm for latest v4.x. |

---

## Installation

Only one potentially new package:

```bash
# Only add if client-side org switching via cookie is needed
npm install cookies-next

# No other new packages required for multi-tenancy
```

---

## Sources

- Direct codebase analysis of CS12 `/src/supabase/schema.sql`, `/src/lib/auth.ts`, `/src/lib/db/client.ts`, `/src/contexts/auth-context.tsx`, `/src/middleware.ts`, `/src/app/api/team/invite/route.ts`, `/src/app/api/team/accept-invite/route.ts` — HIGH confidence
- Supabase `@supabase/ssr` v0.8 documentation pattern (createServerClient in middleware) — HIGH confidence, matches existing working code
- Supabase Auth admin API (`inviteUserByEmail`) — HIGH confidence, used in existing working code
- MakerKit multi-tenant SaaS boilerplate as reference pattern (org-slug in URL, organization_members table) — MEDIUM confidence (training data; architecture widely documented)
- Next.js App Router dynamic segments and `cookies()` from `next/headers` — HIGH confidence

---

## Confidence Summary

| Area | Confidence | Reason |
|------|------------|--------|
| Existing stack inventory | HIGH | Read directly from package.json and source files |
| No new packages needed | HIGH | Existing `@supabase/ssr`, Radix UI, Zod, Next.js cover all requirements |
| Database schema changes | HIGH | Standard Supabase multi-tenant patterns, SQL is not library-dependent |
| URL-based org routing | HIGH | Standard Next.js App Router pattern |
| `cookies-next` for client cookie | MEDIUM | Package exists, version number should be verified at build time |
| Performance of RLS subquery vs JWT claims | MEDIUM | Subquery pattern works at CS12 scale; JWT claim optimization is known technique but premature |

---

*Stack research for: CS12 multi-tenant organization layer*
*Researched: 2026-02-26*
