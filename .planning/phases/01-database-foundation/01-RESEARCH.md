# Phase 1: Database Foundation - Research

**Researched:** 2026-02-26
**Domain:** Supabase PostgreSQL schema migrations — adding multi-tenant org tables to a live production database
**Confidence:** HIGH

---

## Summary

Phase 1 is a pure database migration phase — no application code changes. The goal is to create three new tables (`organizations`, `org_members`, `user_profiles`), add `org_id` to `dsos`, and backfill all five existing DSOs into a default org for Alan. The existing `user_dso_access` table is untouched. All 31 routes continue working exactly as before.

The critical constraint is zero downtime on a live production Supabase instance. The `dsos` table has real data and cannot tolerate a lock that blocks reads. The required pattern is: add `org_id` as nullable → backfill in the same migration → add NOT NULL constraint separately. All three steps happen in one migration file, but the constraint is added via `ALTER COLUMN ... SET NOT NULL` only after the backfill completes.

The migration naming convention in this project is `YYYYMMDDHHMMSS_description.sql`. The next migration should follow the existing sequence (last: `20260128000000_fix_activities_client_scope.sql`). Use `20260226000000_add_org_tables.sql` as the filename.

**Primary recommendation:** Write one migration file that creates all tables, indexes, backfills existing data, and adds the NOT NULL constraint — in that exact order. Test locally with `supabase db reset` before pushing to production with `supabase db push`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase CLI | 2.75.0 (installed) | Run `supabase migration new`, `supabase db reset`, `supabase db push` | Already installed, already used for all 10 existing migrations |
| `supabase-js` | ^2.86.0 | `supabaseAdmin` for any verification scripts | Already installed, used by all 31 API routes |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `supabase/ssr` | ^0.8.0 | SSR client for verifying migration results | Already installed — use for post-migration verification queries against authenticated user |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase CLI migrations | Manual SQL in Supabase Dashboard | Dashboard changes are not tracked in git — never do this for schema changes |
| Single-step `ADD COLUMN ... NOT NULL` | Three-step nullable → backfill → constrain | Single-step acquires ACCESS EXCLUSIVE lock during backfill — blocks all reads. Three-step is safe. |

**Installation:**
```bash
# Nothing new to install — all tooling already present
# Supabase CLI: 2.75.0 (supabase --version confirms)
```

---

## Architecture Patterns

### Recommended Project Structure

New migration file location:
```
supabase/
└── migrations/
    └── 20260226000000_add_org_tables.sql   # NEW: Phase 1 migration
```

No application code changes in this phase.

### Pattern 1: Three-Step NOT NULL Column Addition (Zero Downtime)

**What:** Adding `org_id` to the live `dsos` table as nullable first, backfilling immediately in the same migration, then constraining to NOT NULL.

**When to use:** Any `ADD COLUMN NOT NULL` on a live table with data.

**Why:** A single `ALTER TABLE dsos ADD COLUMN org_id UUID NOT NULL` acquires an ACCESS EXCLUSIVE lock and scans every row before releasing it. On a live database this blocks all reads and writes for the lock duration. Three-step avoids this.

**Example:**
```sql
-- Step 1: Add column nullable (brief lock only)
ALTER TABLE dsos ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Step 2: Backfill all existing rows in the SAME migration
-- (Safe because organizations table was just created above and is empty to all users)
UPDATE dsos SET org_id = '<generated-uuid-from-insert-above>' WHERE org_id IS NULL;

-- Step 3: Constrain AFTER backfill is complete
ALTER TABLE dsos ALTER COLUMN org_id SET NOT NULL;
```

**Note on CS12 scale:** CS12 has 5 DSOs in production. The backfill is instantaneous. The three-step pattern is still correct practice regardless of table size.

### Pattern 2: Capture Generated UUID for Use in Backfill

**What:** When you INSERT an organization and need its generated UUID to backfill `dsos.org_id` in the same migration, use a CTE or a variable-like approach.

**When to use:** Any migration that creates a row and immediately references its ID.

**Example using CTE (works in Supabase migrations):**
```sql
WITH new_org AS (
    INSERT INTO organizations (name, slug, created_by)
    VALUES ('All Solutions Consulting', 'all-solutions-consulting', '8a84898d-0266-4dc1-b97c-744d70d7a4ec')
    RETURNING id
)
UPDATE dsos
SET org_id = (SELECT id FROM new_org)
WHERE org_id IS NULL;
```

**Source:** Standard PostgreSQL CTE with data-modifying statements — HIGH confidence.

### Pattern 3: Migration File Structure Convention

**What:** This project's migrations follow a consistent structure pattern observed across all 10 existing files.

**Convention:**
```sql
-- Migration: [Human description]
-- [Optional: Problem being solved]

-- ============================================================
-- TABLE CREATION
-- ============================================================

CREATE TABLE table_name ( ... );

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_... ON ...;

-- ============================================================
-- DATA MIGRATION
-- ============================================================

INSERT INTO ... ;
UPDATE ... SET ... WHERE ... ;

-- ============================================================
-- CONSTRAINTS
-- ============================================================

ALTER TABLE dsos ALTER COLUMN org_id SET NOT NULL;
```

**Source:** Observed across `20241206000000_initial_schema.sql`, `20260128000000_fix_activities_client_scope.sql`, and 8 other existing migrations — HIGH confidence.

### Pattern 4: `user_profiles` Table — Avoiding N+1 Auth API Calls

**What:** The `user_profiles` table caches `auth.users` email and name so API routes don't need to call `supabaseAdmin.auth.admin.getUserById()` for each user in a list.

**When to use:** Any place in Phases 2-5 that needs to display user names/emails (org members list, invite history, etc.).

**Why it belongs in Phase 1:** It's a pure database table with no application dependencies. Creating it now as an empty table is zero-risk and unblocks Phase 2 immediately.

**Schema:**
```sql
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Seed it with existing users (Alan, Claudia, Valentina) in the same migration** so Phase 2 auth helpers have data to work with.

### Pattern 5: org_members Roles

**What:** The project decisions specify three roles: `owner`, `admin`, `member`. The existing `user_dso_access` table uses `admin`, `manager`, `viewer`. These are different role sets for different tables.

**Important:** `org_members.role` and `user_dso_access.role` are parallel, not merged. The CHECK constraint on `org_members.role` must use the new three-value set.

```sql
role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member'))
```

**Source:** REQUIREMENTS.md MBR-07 — HIGH confidence.

### Anti-Patterns to Avoid

- **Adding `org_id` to child tables (doctors, activities, etc.):** Unnecessary. The chain `doctors.dso_id → dsos.org_id` already provides org context. Direct `org_id` on leaf tables is denormalized and creates maintenance burden. Only `dsos` gets `org_id`.

- **Dropping or modifying `user_dso_access`:** Zero-downtime constraint means this table must remain completely untouched in Phase 1. Do not add columns, change constraints, or add RLS changes to it.

- **Adding RLS to new tables:** The application uses `supabaseAdmin` (service role) which bypasses RLS entirely. Adding RLS policies to `organizations` or `org_members` would be a no-op for existing API routes and creates confusing dead code. Defer RLS to a future separate milestone (explicitly out of scope).

- **Enabling RLS on `dsos` during this migration:** RLS is already enabled on `dsos` (from initial schema). Adding new policies to it here would change existing query behavior. This phase adds only a column and index — no policy changes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom ID logic | `gen_random_uuid()` (already used throughout schema) | Already the pattern in all 10 existing migrations |
| `updated_at` auto-update | Manual triggers | `update_updated_at_column()` function already exists | Already defined in initial schema, already applied to 6 tables — reuse it |
| Migration tracking | Manual SQL log | Supabase CLI migration files | Already the workflow — `supabase migration new`, `db reset`, `db push` |

**Key insight:** This codebase has no custom tooling — everything runs through the Supabase CLI. Do not deviate from that.

---

## Common Pitfalls

### Pitfall 1: `ADD COLUMN ... NOT NULL` Lock on Live Table

**What goes wrong:** `ALTER TABLE dsos ADD COLUMN org_id UUID NOT NULL` acquires ACCESS EXCLUSIVE lock for the full duration of the backfill scan. Blocks all reads and writes.

**Why it happens:** Postgres must validate NOT NULL against every existing row before releasing the lock.

**How to avoid:** Three-step pattern: add nullable → backfill → constrain. See Pattern 1 above.

**Warning signs:** Migration SQL has `ADD COLUMN ... NOT NULL` in a single statement.

### Pitfall 2: Hardcoded UUIDs May Not Match Production

**What goes wrong:** The migration hardcodes Alan's user_id `8a84898d-0266-4dc1-b97c-744d70d7a4ec` and Claudia's `6559957c-2ce6-4cea-aa15-f79fb401a685`. If these IDs are wrong (typo, different in production vs staging), the org_members INSERT fails silently or with a foreign key error.

**Why it happens:** UUIDs are copied from a document — typos happen.

**How to avoid:** Before running `supabase db push`, verify the user IDs exist in production: query `auth.users` via Supabase Dashboard → Authentication → Users. The migration should include a comment noting the source of these IDs and what to check if the migration fails.

**Warning signs:** Foreign key violation on `auth.users(id)` when the migration runs.

### Pitfall 3: Migration Runs Cleanly Locally But Fails in Production

**What goes wrong:** `supabase db reset` passes locally (using seed.sql with local demo users), but `supabase db push` fails on production because the hardcoded user IDs don't exist locally.

**Why it happens:** Local `seed.sql` creates a demo user with ID `00000000-0000-0000-0000-000000000001`. The production IDs are different. The migration's INSERT into `org_members` uses production IDs — these don't exist in the local demo database.

**How to avoid:** The migration's data-seeding section (INSERT into org_members, user_profiles) should be **production-only** or use `ON CONFLICT DO NOTHING` to handle the mismatch. Local testing can use `supabase db reset` to verify the schema DDL runs clean, then separately verify the data INSERT is correct before pushing to production.

**Recommended approach:** Use `ON CONFLICT DO NOTHING` on all INSERT statements in the migration. This makes the migration idempotent and safe to re-run.

**Warning signs:** Migration passes `supabase db reset` but fails `supabase db push` with "foreign key constraint violation."

### Pitfall 4: Valentina Cleanup in the Same Migration

**What goes wrong:** Valentina (`d0134916-0f52-4556-9fa0-4c66cff3198e`) has erroneous `user_dso_access` rows. If her cleanup (DELETE from `user_dso_access`) is bundled with the Phase 1 migration, a failure in any part rolls back the entire migration — including the cleanup. Conversely, doing the cleanup without documenting it creates an untracked schema change.

**How to avoid:** Handle Valentina's cleanup as a separate, explicitly commented SQL block in the Phase 1 migration. Keep it clearly labeled: `-- Cleanup: Remove erroneous access for Valentina (user_id: d0134916...)`. If the cleanup needs to be skippable, note it explicitly.

**Decision for planner:** Should Valentina's `user_dso_access` cleanup happen in Phase 1 migration (cleaning access table), or is it deferred to Phase 5 (when user_dso_access is being fully audited)? Either is valid — but the planner must choose one and be explicit.

### Pitfall 5: `slug` Uniqueness for Default Org

**What goes wrong:** The `organizations.slug` column has a UNIQUE constraint. If the migration runs twice (e.g., during local reset cycles), the INSERT for the default org fails on the second run with a unique constraint violation.

**How to avoid:** Use `ON CONFLICT (slug) DO NOTHING` on the organizations INSERT. This makes the migration safely re-runnable.

```sql
INSERT INTO organizations (id, name, slug, created_by)
VALUES ('...', 'All Solutions Consulting', 'all-solutions-consulting', '8a84898d-...')
ON CONFLICT (slug) DO NOTHING;
```

---

## Code Examples

Verified patterns from official sources and the existing codebase:

### Complete Migration Structure for Phase 1

```sql
-- Migration: Add org tables (organizations, org_members, user_profiles) and org_id to dsos
-- Phase 1: Database Foundation
-- Production Supabase: vekxzuupejmitvwwokrf
-- Prerequisite check: verify user IDs exist in auth.users before running on production

-- ============================================================
-- 1. CREATE organizations TABLE
-- ============================================================

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_created_by ON organizations(created_by);

CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. CREATE org_members TABLE
-- ============================================================

CREATE TABLE org_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, user_id)
);

CREATE INDEX idx_org_members_org_id ON org_members(org_id);
CREATE INDEX idx_org_members_user_id ON org_members(user_id);

-- ============================================================
-- 3. CREATE user_profiles TABLE
-- ============================================================

CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. ADD org_id TO dsos (nullable first — zero downtime)
-- ============================================================

ALTER TABLE dsos ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX idx_dsos_org_id ON dsos(org_id);

-- ============================================================
-- 5. DATA MIGRATION: Create default org and backfill
-- ============================================================

-- 5a. Insert default organization for Alan
INSERT INTO organizations (id, name, slug, created_by)
VALUES (
    gen_random_uuid(),   -- planner should decide: hardcode a specific UUID for predictability
    'All Solutions Consulting',
    'all-solutions-consulting',
    '8a84898d-0266-4dc1-b97c-744d70d7a4ec'  -- Alan's user_id
)
ON CONFLICT (slug) DO NOTHING;

-- 5b. Backfill dsos.org_id (all 5 existing DSOs → default org)
UPDATE dsos
SET org_id = (SELECT id FROM organizations WHERE slug = 'all-solutions-consulting')
WHERE org_id IS NULL;

-- 5c. Insert org_members for Alan (owner) and Claudia (admin)
INSERT INTO org_members (org_id, user_id, role)
SELECT
    (SELECT id FROM organizations WHERE slug = 'all-solutions-consulting'),
    '8a84898d-0266-4dc1-b97c-744d70d7a4ec',
    'owner'
ON CONFLICT (org_id, user_id) DO NOTHING;

INSERT INTO org_members (org_id, user_id, role)
SELECT
    (SELECT id FROM organizations WHERE slug = 'all-solutions-consulting'),
    '6559957c-2ce6-4cea-aa15-f79fb401a685',
    'admin'
ON CONFLICT (org_id, user_id) DO NOTHING;

-- 5d. Seed user_profiles for existing users
INSERT INTO user_profiles (id, email, name)
VALUES
    ('8a84898d-0266-4dc1-b97c-744d70d7a4ec', 'alan@allsolutions.consulting', 'Alan Hsieh'),
    ('6559957c-2ce6-4cea-aa15-f79fb401a685', 'claudia@...', 'Claudia')  -- planner must fill in Claudia's email
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 6. CONSTRAIN dsos.org_id NOT NULL (after backfill complete)
-- ============================================================

ALTER TABLE dsos ALTER COLUMN org_id SET NOT NULL;

-- ============================================================
-- 7. OPTIONAL: Valentina access cleanup (erroneous access)
-- ============================================================
-- Valentina (d0134916-0f52-4556-9fa0-4c66cff3198e) has access to all 5 DSOs erroneously
-- Decision: clean up here or defer to Phase 5?
-- DELETE FROM user_dso_access WHERE user_id = 'd0134916-0f52-4556-9fa0-4c66cff3198e';
```

### Verify Migration Success (Run After Push)

```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('organizations', 'org_members', 'user_profiles');

-- Verify all 5 DSOs have org_id
SELECT name, org_id FROM dsos ORDER BY name;

-- Verify org_members for Alan and Claudia
SELECT om.user_id, om.role, o.name AS org_name
FROM org_members om
JOIN organizations o ON o.id = om.org_id;

-- Verify user_dso_access still exists and has its rows (zero downtime check)
SELECT COUNT(*) FROM user_dso_access;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers` | `@supabase/ssr` | 2024 | CS12 already uses `@supabase/ssr` — correct |
| RLS-first multi-tenancy | Service-role + application-level auth | Project decision | CS12 uses service_role in all 31 routes — no RLS-first in this milestone |
| `uuid_generate_v4()` | `gen_random_uuid()` | PostgreSQL 13+ | CS12's initial schema already uses `gen_random_uuid()`. The team_invites migration still uses `uuid_generate_v4()` which requires uuid-ossp extension. Use `gen_random_uuid()` (no extension needed) for new tables. |

**Deprecated/outdated:**
- `uuid_generate_v4()`: Requires `CREATE EXTENSION "uuid-ossp"` — already enabled in initial schema, but `gen_random_uuid()` is the modern alternative (built-in, no extension required). New tables in this migration should use `gen_random_uuid()`.

---

## Open Questions

1. **Claudia's email address**
   - What we know: Claudia's user_id is `6559957c-2ce6-4cea-aa15-f79fb401a685`
   - What's unclear: Her email is not documented in any file reviewed
   - Recommendation: Alan provides her email before the migration runs, OR the planner seeds `user_profiles` from a query against `auth.users` rather than hardcoding email values

2. **Should the default org UUID be hardcoded or generated?**
   - What we know: The migration can use `gen_random_uuid()` for the org ID, then look it up by slug for the backfill
   - What's unclear: If the UUID is generated at migration-run time, it varies between local and production environments. This is fine since the org is referenced by slug in the migration itself.
   - Recommendation: Generate at runtime via `gen_random_uuid()`. Use slug-based lookups for cross-references within the migration. If production code later needs to reference the org ID directly, fetch it by slug — not by hardcoded UUID.

3. **Valentina cleanup: Phase 1 or Phase 5?**
   - What we know: Valentina has erroneous `user_dso_access` rows and is not being added to `org_members`
   - What's unclear: Is Phase 1 the right place to fix this (clean house before building), or Phase 5 (when all user_dso_access rows are being audited)?
   - Recommendation: Do it in Phase 1 — removing erroneous access is independent of org structure and is lower risk now than later. Include it as a clearly labeled block with a comment explaining the cleanup.

4. **Should `organizations` have RLS enabled?**
   - What we know: All current tables have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` in the initial schema. Application uses `supabaseAdmin` which bypasses RLS anyway.
   - What's unclear: Should new tables follow the same pattern for consistency?
   - Recommendation: Do NOT enable RLS on new tables in Phase 1. The existing RLS setup is a legacy artifact that has no effect since `supabaseAdmin` bypasses it. Adding RLS policies to `organizations` and `org_members` with no intention of using them creates confusing dead code. Keep new tables clean.

5. **Seed file needs updating for local dev**
   - What we know: `supabase/seed.sql` creates a demo user with ID `00000000-0000-0000-0000-000000000001` and grants them access to 3 local DSOs
   - What's unclear: After Phase 1, the seed file should also insert a demo organization and seed `org_members` for the demo user so local dev works end-to-end
   - Recommendation: Update `seed.sql` as part of Phase 1 to add a demo organization + org_member row. This ensures `supabase db reset` produces a complete local environment for Phase 2 development.

---

## Sources

### Primary (HIGH confidence)
- CS12 codebase (read 2026-02-26):
  - `/supabase/migrations/20241206000000_initial_schema.sql` — complete production schema, all existing tables, RLS policies, triggers
  - `/supabase/migrations/20260128000000_fix_activities_client_scope.sql` — example of ADD COLUMN + backfill pattern
  - `/supabase/migrations/20251209_add_archived_to_dsos.sql` — minimal ALTER TABLE example on live dsos table
  - `/supabase/migrations/20250115_add_team_invites.sql` — existing invite table, role patterns
  - `/src/lib/auth.ts` — discriminated union auth helper pattern to follow for new org helpers
  - `/src/lib/db/client.ts` — supabaseAdmin service role pattern
  - `/.planning/research/ARCHITECTURE.md` — org schema design, three-step migration pattern, auth helper templates
  - `/.planning/research/PITFALLS.md` — NOT NULL lock pitfall, user_dso_access keep-intact requirement, invite bug risk
  - `/.planning/research/STACK.md` — no new packages needed, gen_random_uuid vs uuid_generate_v4
  - `/.planning/REQUIREMENTS.md` — DB-01 through DB-05, ORG-04, ISO-01 column specs
  - `/.planning/STATE.md` — three-step NOT NULL constraint pattern, Valentina cleanup, key user IDs
  - `/supabase/seed.sql` — local demo user ID, DSO UUIDs for local dev context
  - `/supabase/config.toml` — Supabase CLI local config, confirms db major version 15

### Secondary (MEDIUM confidence)
- Supabase CLI 2.75.0 installed and working — verified via `supabase --version`
- PostgreSQL 15 (local config) — `gen_random_uuid()` available natively without extension

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all tooling already installed and in use
- Architecture: HIGH — schema design lifted directly from ARCHITECTURE.md research (already validated against Supabase docs and MakerKit patterns)
- Pitfalls: HIGH — directly relevant pitfalls documented in PITFALLS.md with prevention patterns; code examples verified against existing migration files
- Migration pattern: HIGH — three-step NOT NULL pattern observed in existing migration, confirmed in ARCHITECTURE.md and PITFALLS.md

**Research date:** 2026-02-26
**Valid until:** 2026-03-28 (stable domain — Supabase PostgreSQL migration patterns do not change frequently)
