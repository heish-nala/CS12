# Project Research Summary

**Project:** CS12 — Multi-Tenant Organization Layer
**Domain:** Retrofitting org/workspace multi-tenancy onto an existing Next.js 16 + Supabase SaaS app
**Researched:** 2026-02-26
**Confidence:** HIGH

## Executive Summary

CS12 is a dental DSO management platform that currently has one-level multi-tenancy: users belong to one or more DSOs (dental practices) via a flat `user_dso_access` table. The milestone at hand adds a proper organization layer above DSOs — modeling the reality that CS12's customers are dental consulting firms (organizations) who manage multiple DSO clients. This is a standard "tenant above tenant" pattern that has well-documented implementations in products like Linear, Notion, and MakerKit. The key insight from research is that significant multi-tenancy infrastructure already exists in CS12; the work is primarily lifting the access model one level up, not building from scratch.

The recommended approach is to add `organizations` and `org_members` tables, add `org_id` to `dsos`, and build an OrgContext + OrgSwitcher alongside the existing DSO-level access patterns — running both models in parallel during the transition. No new core libraries are needed; the existing stack (Next.js App Router, Supabase, Radix UI, Zod) covers all requirements. URL routing should stay flat for now (org stored in context/localStorage) to avoid refactoring 31 API routes, with URL-segment org routing deferred to a follow-on milestone.

The dominant risk in this build is a class of silent failures: RLS misconfiguration that returns empty data without errors, the service role key masking security bugs during testing, and the live `user_dso_access` table being dropped before the new access model is verified. All three risks follow the same pattern — they look fine in development, fail silently in production, and are difficult to diagnose. The mitigation is consistent: run both access models in parallel, always test with real user-scoped Supabase clients (not the service role), and treat every migration as a three-step nullable-backfill-constrain sequence.

## Key Findings

### Recommended Stack

The existing CS12 stack already contains everything required for this milestone. No new core libraries should be added. The app uses Next.js 16 App Router, Supabase (`@supabase/ssr` v0.8 for SSR auth, `supabase-js` v2.86 for data access), TypeScript 5, Tailwind CSS 4, Zod 4, and Radix UI / shadcn/ui — all of which are correctly in place.

The only potentially new package is `cookies-next` (for client-side cookie writes during org switching), and even that can be avoided by using localStorage for org persistence. Auth, database access, UI components, and validation are all already covered. The STACK research explicitly recommends against introducing next-auth, Clerk, Prisma, or Drizzle — all would require significant rewrites for no benefit given the existing Supabase-first patterns.

**Core technologies:**
- `@supabase/ssr` v0.8: SSR-compatible auth client — already in use, keep pattern
- `supabaseAdmin` (service role): API route data access — keep, extend with org auth helpers
- Next.js App Router dynamic segments + `cookies()`: for org context in server components — no change
- Radix UI / shadcn/ui: build OrgSwitcher dropdown — already installed
- Zod 4: validate org creation / invite request bodies — already installed
- `cookies-next` (optional): client-side cookie write for active org ID — add only if needed

**Database-only additions (no new packages):**
- `organizations` table (id, name, slug, created_at, updated_at)
- `org_members` table (org_id, user_id, role, created_at)
- `org_invites` table (mirrors existing `team_invites` pattern)
- `dsos.org_id` foreign key column (nullable first, backfill, then NOT NULL)

### Expected Features

CS12 already has substantial invite and member management infrastructure. The table stakes list is largely "wire up existing plumbing to the org level" rather than "build from scratch."

**Must have (table stakes — this milestone):**
- Create an organization — the entry point; blocks everything else
- Org memberships with roles (admin / member / viewer) — lifted from DSO level
- Data migration — wrap existing 5 DSOs in a default org for current 3 users
- Data isolation via org-scoped API checks — `requireOrgAccess()` in all routes
- Invite members by email, scoped to org — wire up existing invite infrastructure
- Accept invite on login — already built; needs to create `org_members` row
- View and cancel pending invites — already built at DSO level; re-scope to org
- Member list per org with roles — already built (partial); re-scope to org
- Remove a member from org — not yet built; must ship with invite capability
- Change a member's role within an org — not yet built
- Org switcher in sidebar — upgrade existing DSO switcher to org switcher
- Prevent zero-admin state (block removing last admin) — not yet built

**Should have — add after core is stable (v1.x):**
- Leave organization (self-removal)
- Transfer org ownership
- Resend expired invite
- Invite with pre-set DSO access

**Defer to v2+:**
- Org activity audit log (compliance use case — build when customers request it)
- Role-based onboarding path (build when membership volume creates onboarding confusion)
- SSO/SAML per org (enterprise feature; irrelevant at current scale)
- Custom roles/permission builder (fixed 3-role model is correct; matches Linear, Slack, Notion)
- Teams within orgs (premature hierarchy for current org > DSO structure)

### Architecture Approach

The architecture adds one new layer above the existing DSO model without replacing it. The approach is service_role + application-level authorization throughout (matching the existing pattern across all 31 routes), not an RLS-first rewrite. A new `OrgContext` React context is added alongside `AuthContext` — it fetches the user's orgs, exposes `currentOrg` and `switchOrg()`, and persists `currentOrgId` in localStorage. Org selection stays out of the URL for this milestone to avoid refactoring all route fetch calls.

**Major components:**
1. `organizations` + `org_members` tables — top-level tenant entities; org_members replaces `user_dso_access` at the org level
2. `lib/auth.ts` extensions — `checkOrgMembership()` and `requireOrgAccess()` helpers; every API route calls these before returning data
3. `OrgContext` + `OrgSwitcher` — React context holds `currentOrg`; OrgSwitcher dropdown in sidebar
4. `/api/orgs` routes — CRUD for orgs + member management (new route group)
5. Updated `ClientsContext` — re-fetches DSOs filtered by `currentOrg.id`
6. `middleware.ts` — new file; refreshes Supabase auth cookies (required for SSR); optionally validates org from URL later

**Build order (dependency-driven):**
Database schema → `lib/auth.ts` helpers → `/api/orgs` routes → `OrgContext` + `OrgSwitcher` → Update `/api/dsos` → Update `ClientsContext` → Update remaining 31 API routes → Data migration (backfill existing DSOs to a default org)

### Critical Pitfalls

1. **Enabling RLS on live tables silently breaks existing queries** — When RLS is enabled with no policies, Postgres returns empty results (not errors) for real users. The service role key bypasses this in testing, masking the bug entirely. Prevention: add a permissive policy first, then enable RLS, then tighten. Always test with a real authenticated user client, not the SQL editor.

2. **Dropping `user_dso_access` before the new access model is verified** — All 31 routes currently depend on `user_dso_access`. Removing it in the same migration that creates `org_members` causes an immediate production outage. Prevention: parallel-run both access models for at least one release cycle. Only drop `user_dso_access` after all routes are verified using the new model in production.

3. **The existing invite bug amplified to org level** — CS12 has a known bug: inviting a user grants them access to ALL of the inviter's DSOs. If the org invite flow is built on top of this unfixed bug, invitees may silently inherit access to all DSOs across an entire org (cross-org data leak). Prevention: fix the DSO-scoping bug as a standalone item before building org-level invites.

4. **`ADD COLUMN ... NOT NULL` locks the live table** — Adding `org_id NOT NULL` to `dsos` in a single statement acquires an `ACCESS EXCLUSIVE` lock during backfill. Prevention: always use the three-step pattern — add nullable column, batch-update existing rows, then add NOT NULL constraint separately.

5. **Client-side AuthGuard does not protect API routes** — CS12 currently uses a client-side `AuthGuard` with no `middleware.ts`. A user who crafts a direct HTTP request bypasses it entirely. When org context is added client-side, the same gap applies. Prevention: every API route must independently validate both user authentication and org membership from the database. URL-supplied `org_id` must never be trusted without server-side membership verification.

## Implications for Roadmap

Based on research, the feature dependency graph and architectural build order both point to a clear 5-phase structure. The data model must exist before any feature can be built; auth helpers must exist before any API route can enforce access; and the existing invite bug must be fixed in isolation before org invites are built.

### Phase 1: Database Schema and Data Migration

**Rationale:** Nothing else can be built until the `organizations`, `org_members`, and `org_invites` tables exist and existing DSOs are assigned to a default org. This is the foundation phase — it blocks everything.

**Delivers:** New database tables, `dsos.org_id` column, backfill of existing 5 DSOs and 3 users into a default org, and database indexes on all new columns.

**Addresses:** Organization data model (P1), org memberships (P1), data migration (P1), data isolation foundation (P1).

**Avoids:** NOT NULL lock on backfill (use nullable-first + batched UPDATE + constrain pattern), `user_dso_access` removal before new model is ready (keep in parallel), missing RLS indexes (create indexes in same migration as any RLS policy).

### Phase 2: Auth Helpers and API Foundation

**Rationale:** API routes need `requireOrgAccess()` and `checkOrgMembership()` helpers before org-scoped features can be built. This phase also establishes middleware for Supabase SSR cookie refresh — required by the App Router pattern — and addresses the client-side AuthGuard gap.

**Delivers:** `lib/auth.ts` extended with org helpers, `middleware.ts` created, `/api/orgs` route group (list, create, get, update, delete org), org member management API (list members, change role, remove member).

**Addresses:** Data isolation per org (P1), roles scoped per org (P1), remove member (P1), change member role (P1), prevent zero-admin state (P1).

**Avoids:** Client-side AuthGuard insufficient for API protection (every new route validates org membership server-side), service role key masking security bugs (new org routes use user-scoped client for validation, not just service role).

### Phase 3: Fix Invite Bug, then Build Org Invites

**Rationale:** The existing DSO-scoping bug in `team_invites` must be fixed as a standalone item before org invites are built. Shipping org invites on top of the unfixed bug creates cross-org data leakage — a worse failure mode. These are two separate work items even though they touch the same code.

**Delivers:** Fixed DSO-scoping bug in existing invite system, new org-level invite flow (POST to `/api/orgs/[id]/invite`), accept invite creates `org_members` row, existing cancel/view invite features re-scoped to org.

**Addresses:** Invite members by email scoped to org (P1), accept invite → join org (P1), cancel pending invite (P2), view pending invites (P2).

**Avoids:** Invite bug amplified to org level (fix DSO-scoping first as a prerequisite), invite touching both `user_dso_access` and `org_members` in the same function without isolation testing.

### Phase 4: OrgContext and Org Switcher UI

**Rationale:** With the API layer in place (Phase 2 and 3), the React context and UI components can be built against real endpoints. Context depends on auth resolving first; org switcher depends on context.

**Delivers:** `OrgContext` provider (currentOrg, userOrgRole, orgs, switchOrg), `OrgSwitcher` dropdown component in sidebar (replaces/wraps existing DSO switcher), localStorage persistence of active org ID with membership re-validation on load, loading state during org switch.

**Addresses:** Org switcher UI (P1), org name / basic profile display.

**Avoids:** React Context stale on org switch (switchOrg() clears stale DSO data before fetching new org's DSOs), storing `currentOrgId` only in memory without persistence (use localStorage), OrgContext loading before AuthContext resolves (watch auth.loading before fetching orgs).

### Phase 5: Org-Scope All 31 Existing API Routes

**Rationale:** Defense-in-depth. Each existing API route must validate org membership before DSO access. This is the last phase because it touches everything and can be done incrementally once the org model is stable. The `ClientsContext` DSO-filtering by org also lands here.

**Delivers:** All 31 existing API routes updated to call `requireOrgAccess()` before `requireDsoAccess()`, `ClientsContext` updated to fetch DSOs filtered by `currentOrg.id`, `user_dso_access` deprecated (but not dropped) once all routes are verified.

**Addresses:** Full data isolation per org (P1), complete org-scoping of the app.

**Avoids:** Adding `org_id` to every leaf table (unnecessary — access org context via `dso_id → dsos.org_id` join), cross-org data exposure via missing WHERE clauses in any of the 31 routes.

### Phase Ordering Rationale

- Phase 1 is non-negotiable first — the data model is a hard dependency for everything else.
- Phase 2 before Phase 3 — auth helpers must exist before invite routes can use them.
- Phase 3 before Phase 4 — invite API should be functional before the UI that triggers it is built.
- Phase 4 before Phase 5 — OrgContext must exist so the 31 routes have something to scope against from the client.
- The invite bug fix (Phase 3, part 1) is explicitly separated from org invite build (Phase 3, part 2) within the same phase — they should be separate commits, tested independently.

### Research Flags

Phases needing deeper research during planning:
- **Phase 5 (Route Update):** 31 routes need individual audit — complexity varies. Some routes may have edge cases where org scoping interacts with existing DSO access patterns unexpectedly. Recommend a research-phase or at minimum a route inventory before starting.
- **Phase 1 (RLS decisions):** The research recommends keeping service_role + application-level auth (not RLS-first). If the decision changes to RLS-first during planning, Phase 1 becomes significantly more complex and needs a dedicated research pass on RLS policy design.

Phases with standard, well-documented patterns (can skip research-phase):
- **Phase 2 (Auth helpers):** Mirrors the existing `requireDsoAccess()` pattern exactly — direct lift-and-extend.
- **Phase 3 (Invite system):** Mirrors existing `team/invite` route pattern — same Supabase auth admin invite call, same token flow.
- **Phase 4 (OrgContext):** Standard React context pattern; well-documented in Next.js App Router ecosystem.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Read directly from package.json and source files; all recommendations are zero-new-package or one optional package (`cookies-next`) |
| Features | HIGH | Based on direct codebase inspection of what exists vs. what is missing; cross-validated against Linear, Slack, and Notion as reference implementations |
| Architecture | HIGH | Existing 31 routes and context files were read directly; patterns are grounded in the actual CS12 codebase, not generic boilerplate |
| Pitfalls | HIGH | Grounded in Supabase official documentation (RLS, migrations, API keys) + verified CVE; not speculative |

**Overall confidence:** HIGH

### Gaps to Address

- **`cookies-next` version number:** Research notes the package exists but recommends verifying the current version with `npm show cookies-next version` at build time. May not be needed at all if localStorage approach is used for org persistence.
- **Per-DSO access within an org:** Research identifies an open product decision — does org membership grant access to all DSOs in that org, or should per-DSO access control (`user_dso_access`) remain? If the latter, `user_dso_access` must stay permanently and Phase 5 becomes more nuanced. This decision should be made before Phase 5 planning begins.
- **RLS vs. service_role long-term:** Research recommends staying with service_role + application auth for this milestone. A future RLS migration is documented but not scoped. This gap should be flagged in the roadmap as a post-milestone follow-on with its own planning cycle.
- **Supabase local dev setup for org migration testing:** The CLAUDE.md instructions require testing all DB migrations locally with `supabase db reset` before production push. Confirm local Supabase is running and migrations apply cleanly before Phase 1 begins.

## Sources

### Primary (HIGH confidence)
- CS12 codebase direct inspection (Feb 26, 2026): `src/lib/auth.ts`, `src/lib/db/types.ts`, `src/contexts/auth-context.tsx`, `src/contexts/clients-context.tsx`, `src/app/api/team/invite/route.ts`, `src/app/api/team/accept-invite/route.ts`, `supabase/schema.sql`, `package.json` — authoritative source for what already exists
- Supabase Row Level Security Official Docs — RLS pitfalls and enable/policy ordering
- Supabase RLS Performance and Best Practices (official) — index requirements, `initPlan` caching
- Supabase Database Migrations Docs (official) — safe migration patterns
- Supabase API Keys Docs (official) — service role vs. anon key behavior
- Next.js App Router docs — `cookies()` from `next/headers`, dynamic segments, middleware pattern

### Secondary (MEDIUM confidence)
- MakerKit multi-tenant SaaS boilerplate — organization table naming conventions and URL patterns
- WorkOS: Model your B2B SaaS with organizations — org/member table structure
- Zero-downtime Postgres migrations (GoCardless) — NOT NULL backfill pattern
- CVE-2025-29927 Next.js middleware bypass — documented and patched; informs defense-in-depth recommendation
- Flightcontrol: Ultimate guide to multi-tenant SaaS data modeling

### Tertiary (LOW confidence)
- Multi-Tenant Leakage: When RLS Fails in SaaS (Medium/InstaTunnel) — useful patterns, single source
- Multi-Tenant Applications with RLS on Supabase (AntStack) — validated against Supabase docs

---
*Research completed: 2026-02-26*
*Ready for roadmap: yes*
