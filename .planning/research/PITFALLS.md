# Pitfalls Research

**Domain:** Multi-tenant organization/workspace layer — retrofitting onto existing Next.js + Supabase app with live data
**Researched:** 2026-02-26
**Confidence:** HIGH (Supabase official docs + multiple verified community sources)

---

## Critical Pitfalls

### Pitfall 1: Enabling RLS on Live Tables Silently Breaks Existing Queries

**What goes wrong:**
You run `ALTER TABLE dso_data ENABLE ROW LEVEL SECURITY` on a table with live users. Every existing query that doesn't match any policy now returns zero rows — no error, just empty results. Your UI appears functional but shows no data. Users see blank screens. Because there's no error message, debugging takes hours.

**Why it happens:**
Supabase/Postgres RLS default is "deny all" when enabled with no policies. The SQL Editor runs as the `postgres` superuser (which bypasses RLS entirely), so local testing passes — but real users with `anon` or `authenticated` roles get nothing. The existing service role key in CS12's API routes also bypasses RLS, masking the problem in testing.

**How to avoid:**
Use a three-step process: (1) Add the permissive policy FIRST (allow all authenticated users), (2) THEN enable RLS, (3) THEN tighten to org-scoped policies. Never enable RLS and write restrictive policies in the same deployment step on live tables. Verify by testing with a real authenticated Supabase client (not the SQL editor or service role client).

**Warning signs:**
- Queries returning empty arrays with no error after a migration
- Dashboard showing "0 records" for data that definitely exists
- Only API routes using the service role key still return data correctly

**Phase to address:**
Database schema migration phase — must be resolved before any RLS policy is written.

---

### Pitfall 2: The Service Role Key Masks All Security Bugs Until Go-Live

**What goes wrong:**
CS12 currently uses the Supabase service role key in all API routes, which bypasses RLS entirely. During the entire organizations build, every test passes because the service role client sees all data regardless of which org a user belongs to. The first time a real user hits a user-scoped Supabase client, they either see nothing (if RLS is misconfigured) or cross-org data (if RLS is missing).

**Why it happens:**
The service role key's `BYPASSRLS` Postgres attribute skips every policy unconditionally. It's the equivalent of testing with root access — everything works in dev, nothing fails, so bugs are invisible until the moment they matter most.

**How to avoid:**
Introduce a second Supabase client (user-scoped, using `@supabase/ssr` with the user's session JWT) for all data-access code paths that will go through RLS. Keep the service role client only for admin operations (invite creation, seeding). Write all new org-scoped queries against the user client from day one. Test every RLS policy with an actual authenticated user session — not the SQL editor, not the service role client.

**Warning signs:**
- All API routes import `createClient` with `process.env.SUPABASE_SERVICE_ROLE_KEY`
- No `@supabase/ssr` package in `package.json`
- "It all works" during development but no tenant isolation test has been run

**Phase to address:**
Auth / middleware phase — establish user-scoped client before writing any org data access.

---

### Pitfall 3: The Flat `user_dso_access` Table Cannot Be Safely Dropped Without a Backfill Window

**What goes wrong:**
The existing `user_dso_access` table is the only thing keeping 3 live users' access intact. Adding an organizations layer means creating `organizations`, `org_members`, and potentially `org_dso_access` tables. If any migration drops or replaces `user_dso_access` before backfilling the new structure, existing users lose all access instantly — zero downtime is violated.

**Why it happens:**
Migrations that "replace" old access models tend to drop the old table in the same transaction that creates the new one. On small datasets this seems safe, but the window where old data is gone and new data hasn't been verified is a production outage for live users.

**How to avoid:**
Never drop `user_dso_access` until the new org-based access tables have been verified working in production with real user sessions. The order must be: (1) Create new tables, (2) Backfill from old tables, (3) Deploy code that reads from new tables, (4) Verify in production, (5) Then (and only then) deprecate old tables. Run both models in parallel for at least one release cycle.

**Warning signs:**
- Migration file that drops `user_dso_access` in the same file that creates `org_members`
- No backfill SQL in the migration
- No explicit verification step before the old table removal

**Phase to address:**
Database schema migration phase — parallel-run period must be explicitly planned.

---

### Pitfall 4: `organization_id` Column Added as NOT NULL Locks the Table

**What goes wrong:**
Running `ALTER TABLE dso_data ADD COLUMN organization_id UUID NOT NULL` on a live table acquires an `ACCESS EXCLUSIVE` lock — the most restrictive Postgres lock — for the duration of the backfill. All reads and writes queue behind it. On a busy production database, this freezes the app.

**Why it happens:**
Postgres must validate the NOT NULL constraint against every existing row before releasing the lock. Even on small tables (CS12 has 5 DSOs and 3 users today), the pattern will cause real downtime at any scale and establishes a dangerous precedent for future migrations.

**How to avoid:**
Three-step safe pattern: (1) `ALTER TABLE ... ADD COLUMN organization_id UUID` (nullable, no constraint — brief lock only), (2) `UPDATE ... SET organization_id = '<default-org-id>' WHERE organization_id IS NULL` in batches, (3) `ALTER TABLE ... ALTER COLUMN organization_id SET NOT NULL` after all rows are backfilled. Always set `lock_timeout = '2s'` before DDL on live tables so the command fails fast rather than queuing.

**Warning signs:**
- Migration SQL has `ADD COLUMN ... NOT NULL` in a single statement
- No `lock_timeout` setting in migration files
- No batched UPDATE — single `UPDATE table SET x = y` with no `WHERE` batching

**Phase to address:**
Database schema migration phase — every `ADD COLUMN` migration must follow this pattern.

---

### Pitfall 5: RLS Policies Without Indexes on `organization_id` Kill Query Performance

**What goes wrong:**
An RLS policy like `USING (organization_id = (SELECT auth.jwt() ->> 'org_id')::uuid)` performs a sequential scan on every query against the protected table. At CS12's current scale (5 DSOs, small dataset) this is invisible. As data grows, queries that were 2ms become 2 seconds. The performance degrades silently — no error, just slowness.

**Why it happens:**
RLS policies are effectively a hidden WHERE clause appended to every query. Without an index on the column being filtered, Postgres scans the entire table. Because the policies are invisible in application code, the missing index is also invisible until the query is already slow.

**How to avoid:**
Every column referenced in any RLS policy — `organization_id`, `user_id`, `created_by` — must have a B-tree index created in the same migration that creates the policy. Also wrap `auth.uid()` and `auth.jwt()` calls in `(SELECT ...)` to enable Postgres `initPlan` caching (evaluates once per query, not once per row). Use Supabase's built-in Performance Advisor (Dashboard > Database > Performance Advisor) after every RLS migration.

**Warning signs:**
- RLS policy referencing `organization_id` with no corresponding `CREATE INDEX` in the migration
- Policies using bare `auth.uid()` rather than `(SELECT auth.uid())`
- Supabase Performance Advisor showing sequential scan warnings

**Phase to address:**
Database schema migration phase — index creation must be bundled with policy creation.

---

### Pitfall 6: The Invite Bug Ships to Organizations — Invitees Still Get All-DSO Access

**What goes wrong:**
CS12 has a known bug: inviting a user grants them access to ALL of the inviter's DSOs. When organizations are added, this bug mutates: if the invite flow is updated to assign org membership but the underlying `user_dso_access` grant is not scoped, invitees may silently inherit access to all DSOs in the org (or all DSOs the inviter touches, depending on implementation order).

**Why it happens:**
The invite system is being modified at the same time as the access model. Two in-flight changes to the same code path create race conditions in logic: the new org membership grant and the old DSO access grant both run, but only one is tested thoroughly.

**How to avoid:**
Treat the invite system as two separate work items: (1) Fix the existing DSO-scoping bug independently, completely, with tests — before starting the org migration. (2) Then add org-level invite semantics. Never ship both changes in the same migration/deployment. The old bug becoming an org-level bug is strictly worse because it now leaks data across organizational boundaries, not just DSO boundaries.

**Warning signs:**
- Invite code touching both `user_dso_access` and `org_members` tables in the same function
- No test that invites a user and verifies exactly which DSOs they can access
- The "grant all inviter's DSOs" logic still present anywhere in the codebase

**Phase to address:**
Invite system phase — fix DSO-scoping bug first as a prerequisite, org-level invites second.

---

### Pitfall 7: Client-Side AuthGuard Cannot Protect API Routes or Server Components

**What goes wrong:**
CS12 currently uses a client-side `AuthGuard` component for auth — no `middleware.ts`. When the organizations layer is added, organization context (which org the user is viewing) also lives client-side. Any API route or server component that doesn't independently verify both (a) the user is authenticated and (b) the user belongs to the org they're requesting can be accessed by constructing a direct HTTP request. The UI guard is bypassed entirely.

**Why it happens:**
Client-side guards are UI conveniences, not security controls. They prevent accidental navigation but do not protect API routes, server actions, or direct fetches. CVE-2025-29927 (March 2025) also demonstrated that even Next.js middleware is bypassable via the `x-middleware-subrequest` header on self-hosted deployments — meaning neither layer alone is sufficient.

**How to avoid:**
Implement a Data Access Layer (DAL) pattern: every server-side data access function (API routes, server actions, server components) independently verifies session AND org membership before returning data. The RLS policies at the database layer provide the final backstop. The auth check order must be: (1) Is the user authenticated? (2) Does the user belong to the org they're requesting? (3) Does the RLS policy agree? All three layers must be independent.

**Warning signs:**
- No `middleware.ts` in the project
- API routes that read `params.orgId` but don't check user membership in that org
- Org membership check only in the React component, not in the API handler

**Phase to address:**
Auth architecture phase — establish middleware + DAL pattern before building org-scoped features.

---

### Pitfall 8: React Context Org Switching Produces Stale State

**What goes wrong:**
When an org context provider is added (to track which org the user is currently viewing), organization switching — navigating from Org A's DSO view to Org B's DSO view — does not update the context if `onAuthStateChange` is not properly re-subscribed after the switch. The user sees Org A's data in Org B's UI. No error is thrown.

**Why it happens:**
React Context is not supported in Server Components — it only works in Client Components. In Next.js App Router, Server Components render before client context is initialized. `onAuthStateChange` subscriptions created in a `useEffect` that lacks a cleanup function will hold references to old org state. Switching orgs doesn't trigger the auth change event if the session itself doesn't change.

**How to avoid:**
Store the active organization ID in a combination of: (1) URL segment (`/org/[orgId]/...`) as the source of truth — this is always fresh on navigation; (2) Server-side validation on every data fetch using the URL parameter. Avoid storing active org only in React Context. If a context provider is used for UX convenience (header display, etc.), ensure `useEffect` cleanup properly unsubscribes the `onAuthStateChange` listener and that org switches force a full context refresh. Use `@supabase/ssr` (not the deprecated `@supabase/auth-helpers`) for session management.

**Warning signs:**
- `activeOrgId` only in a `useState` or React Context with no URL backing
- `onAuthStateChange` subscription without a return cleanup in `useEffect`
- Using `@supabase/auth-helpers` instead of `@supabase/ssr`

**Phase to address:**
Org context / navigation phase — URL-first org routing must be established before UI is built.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep service role key in all API routes during org migration | No immediate code change needed | RLS bugs are invisible in testing; security holes ship silently | Never for org-scoped queries — acceptable only for truly admin-only operations |
| One organization auto-created per existing DSO | Fastest path to unblock users | Creates confusing "org per DSO" mental model; real org structure requires a re-migration | Acceptable as temporary backfill IF clearly labeled and migration plan exists |
| Skip `WITH CHECK` on INSERT/UPDATE policies | Less boilerplate | Users can insert rows with arbitrary `organization_id` — cross-org data injection | Never |
| Test RLS with the SQL Editor (superuser) | Fast iteration | Policies that look correct silently fail for real users | Never — always test with `authenticated` role client |
| Disable RLS on new tables "temporarily" during development | Faster early iteration | Tables ship to production without RLS, silently exposing all rows | Only if table has no user data and a tracked issue exists to enable RLS before merge |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase client in Next.js API routes | Using one `createClient(url, SERVICE_ROLE_KEY)` for everything | Create two clients: one service-role for admin ops, one user-scoped (`createClient(url, ANON_KEY, { auth: { persistSession: false } })` with user JWT from request) |
| Supabase Auth metadata | Storing `organization_id` in `user_metadata` | Store org memberships in a DB table; `user_metadata` is user-editable and unsafe for access control |
| Next.js App Router + Supabase | Using deprecated `@supabase/auth-helpers` | Use `@supabase/ssr` — auth-helpers is deprecated as of 2024, no bug fixes |
| Views in Postgres | Creating views over multi-tenant tables | Views bypass RLS by default (security definer). Must set `security_invoker = true` (Postgres 15+) or avoid exposing views via Supabase API |
| Supabase Realtime subscriptions | Subscribing to a table without org-scoped filter | Realtime bypasses RLS on the filter level — always use `.filter('organization_id=eq.X')` in subscription and verify server-side |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| RLS policy joins without indexes | Queries slow as data grows; no error | Create B-tree index on every column in every RLS policy in the same migration | Noticeable at ~10K rows per tenant; severe at ~100K |
| Bare `auth.uid()` in RLS (no `SELECT` wrapper) | Postgres evaluates the function once per row, not per query | Use `(SELECT auth.uid())` to enable initPlan caching | Always slightly slower than it needs to be; compounds with table size |
| Org membership lookup in RLS policy (subquery per row) | Policies like `organization_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())` are slow at scale | Use custom JWT claims with `org_id` baked in at session creation, or use a security-definer function with caching | Hits at ~1K membership rows |
| Sequential backfill without batching | Migration takes minutes, holds row locks | Batch updates in blocks of 1000, with `pg_sleep(0.1)` between batches | Any table with >10K rows at migration time |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| RLS policies that look correct but use `SECURITY DEFINER` functions | SECURITY DEFINER runs with the function owner's permissions, bypassing RLS of tables accessed inside the function | Always use `SECURITY INVOKER` unless the explicit intent is to bypass RLS; audit all functions |
| Invite link that assigns org membership without re-checking current policies | Tenant can enable stricter access rules after invites are sent; old invites bypass new rules | Validate org membership policies at invite acceptance time, not just at invite creation time |
| Missing `WITH CHECK` on INSERT/UPDATE RLS policies | User can insert a row with `organization_id` of another org — data is written into the wrong org | Every INSERT/UPDATE policy must have a `WITH CHECK` clause that mirrors the `USING` clause |
| `organization_id` in URL without server-side membership check | User crafts URL `/org/OTHER_ORG_ID/data` and accesses data if API only trusts URL param | API routes must verify `user is member of org` from the database, never trust the URL param alone |
| Cross-tenant cache pollution | Background jobs or API responses cached under generic keys; Tenant B reads Tenant A's cached data | Always include `organization_id` in cache keys; never use generic keys like `latest_dashboard` |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| User loses access when org structure changes | Existing users suddenly see "unauthorized" after migration with no explanation | Parallel-run both access models; show a clear message if org migration is in progress |
| Invite accepts and lands user in wrong org | User accepts invite for Org A but lands in Org B's context due to routing bug | Invite acceptance URL must encode the target org ID; post-accept redirect must validate org membership before landing |
| Org switcher with no loading state | User clicks "switch org" and the UI shows stale data from previous org while new org data loads | Show an explicit loading state during org switch; clear stale data from state before fetching new org data |
| Silent empty state when RLS denies access | User sees blank dashboard instead of "you don't have access to this" | Distinguish between "no data" (empty state) and "access denied" (403/permission error) in UI handling |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Organization creation:** Often missing the auto-assignment of creator as org admin — verify that the user who creates the org is inserted into `org_members` with an `admin` role in the same transaction.
- [ ] **RLS policies:** Often missing the `WITH CHECK` clause on INSERT/UPDATE — verify each policy covers both read isolation (USING) and write isolation (WITH CHECK).
- [ ] **Invite system:** Often missing the post-accept membership verification — verify that accepting an invite checks current org policies, not just the invite record.
- [ ] **API routes:** Often still using service role key after "migrating to user-scoped client" — verify no API route that serves user data still uses the service role client.
- [ ] **Org context in URL:** Often missing the org segment on some routes — verify every protected route has `/org/[orgId]` in its path and that orphaned routes without it are either restricted or removed.
- [ ] **Database indexes:** Often missing on `organization_id` after adding column — verify `\d table_name` shows an index on `organization_id` for every table with an RLS policy referencing it.
- [ ] **Views:** Often not updated to respect RLS — verify all existing views have `security_invoker = true` or are replaced with org-scoped equivalents.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| RLS enabled with no policies — users see no data | LOW | Write a permissive `TO authenticated USING (true)` policy immediately; deploy; then tighten incrementally |
| Wrong org's data exposed via missing WHERE clause | HIGH | Identify all affected queries; audit access logs; notify affected org admins; patch query; add RLS as backstop |
| `user_dso_access` dropped before new access model verified | HIGH | Restore from Supabase point-in-time recovery (verify PITR is enabled and retention window before starting migration); do not re-run migration until dual-write period is validated |
| Invite bug shipped with org-level access — users over-permissioned | MEDIUM | Audit `org_members` and `user_dso_access` tables to identify incorrectly granted access; revoke rows; notify affected users; hotfix invite function |
| Lock timeout on NOT NULL backfill — migration failed mid-run | MEDIUM | Column now exists as nullable with partial backfill; run batched UPDATE to complete backfill; then re-attempt NOT NULL constraint with `NOT VALID` + `VALIDATE CONSTRAINT` pattern |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| RLS enabled without policies silences queries | Database schema migration phase | Run test query as authenticated user (not superuser) against each newly RLS-enabled table; verify data returns |
| Service role key masks RLS bugs | Auth architecture phase | Remove service role client from all user-facing data paths; verify user-scoped client is used in all routes that return org data |
| `user_dso_access` dropped before new model verified | Database schema migration phase | Parallel-run period: keep old table, verify new org access model works in production, only then add migration to drop old table |
| NOT NULL lock on backfill | Database schema migration phase | Use nullable-first + batched UPDATE + `NOT VALID` constraint pattern for every `ADD COLUMN` in the org migration |
| Missing indexes on RLS columns | Database schema migration phase | Run Supabase Performance Advisor after each migration; verify index exists via `\d table_name` |
| Invite bug amplified to org level | Invite system phase (must fix before org invites) | Test: invite user, verify exact DSO list they can access, confirm it matches exactly what was intended — not more |
| Client-side AuthGuard insufficient for API protection | Auth architecture phase | Verify all API routes independently check org membership from DB, not from URL param alone |
| React Context stale on org switch | Org context / navigation phase | Test org switch with browser DevTools network tab open; verify all subsequent fetches use the new org ID |

---

## Sources

- [Supabase Row Level Security Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH confidence (official)
- [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — HIGH confidence (official)
- [Supabase Performance Advisors](https://supabase.com/docs/guides/database/database-advisors?lint=0003_auth_rls_initplan) — HIGH confidence (official)
- [Supabase Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations) — HIGH confidence (official)
- [Supabase API Keys](https://supabase.com/docs/guides/api/api-keys) — HIGH confidence (official)
- [Zero-downtime Postgres migrations — GoCardless](https://gocardless.com/blog/zero-downtime-postgres-migrations-the-hard-parts/) — MEDIUM confidence (verified post-mortem)
- [Postgres schema migration without downtime — Bytebase](https://www.bytebase.com/blog/postgres-schema-migration-without-downtime/) — MEDIUM confidence (multiple sources agree)
- [Multi-Tenant Applications with RLS on Supabase — AntStack](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/) — MEDIUM confidence (verified against Supabase docs)
- [Next.js Authentication Best Practices 2025](https://www.franciscomoretti.com/blog/modern-nextjs-authentication-best-practices) — MEDIUM confidence (verified against Next.js docs)
- [CVE-2025-29927 Next.js middleware bypass](https://clerk.com/articles/complete-authentication-guide-for-nextjs-app-router) — HIGH confidence (CVE is documented and patched)
- [Broken Access Control in Multi-Tenant SaaS — FusionAuth](https://fusionauth.io/blog/multi-tenant-hijack-3) — MEDIUM confidence (multiple sources agree on patterns)
- [Multi-Tenant Leakage: When RLS Fails in SaaS — Medium/InstaTunnel](https://medium.com/@instatunnel/multi-tenant-leakage-when-row-level-security-fails-in-saas-da25f40c788c) — LOW confidence (single source, useful patterns)
- [Tenant Isolation in Multi-Tenant Systems — Security Boulevard](https://securityboulevard.com/2025/12/tenant-isolation-in-multi-tenant-systems-architecture-identity-and-security/) — MEDIUM confidence

---
*Pitfalls research for: CS12 — multi-tenant organization layer migration on Next.js + Supabase*
*Researched: 2026-02-26*
