-- Migration: Add org tables (organizations, org_members, user_profiles) and org_id to dsos
-- Phase 1: Database Foundation — Multi-Tenant Organization Support
-- Production Supabase: vekxzuupejmitvwwokrf
--
-- Before running on production, verify these user IDs exist in auth.users:
--   Alan:    8a84898d-0266-4dc1-b97c-744d70d7a4ec
--   Claudia: 6559957c-2ce6-4cea-aa15-f79fb401a685

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
-- Note: org_members.role ('owner', 'admin', 'member') is distinct from
-- user_dso_access.role ('admin', 'manager', 'viewer') — different role sets,
-- different tables, different concerns.

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
-- Caches auth.users email + name to avoid N+1 auth API calls when
-- listing org members. id mirrors auth.users(id) — no separate UUID.

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
-- 4. ADD org_id TO dsos (nullable first — zero downtime pattern)
-- ============================================================
-- Step 1 of 3: Add column as nullable (brief lock only, no row scan)

ALTER TABLE dsos ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX idx_dsos_org_id ON dsos(org_id);

-- ============================================================
-- 5. DATA MIGRATION: Create default org and backfill existing data
-- ============================================================

-- 5a. Insert default organization for Alan
-- ON CONFLICT DO NOTHING ensures idempotency on re-runs
INSERT INTO organizations (name, slug, created_by)
VALUES (
    'All Solutions Consulting',
    'all-solutions-consulting',
    '8a84898d-0266-4dc1-b97c-744d70d7a4ec'
)
ON CONFLICT (slug) DO NOTHING;

-- 5b. Backfill dsos.org_id for all existing DSOs (Step 2 of 3: backfill before constraining)
-- Slug-based lookup avoids hardcoded UUID dependency
UPDATE dsos
SET org_id = (SELECT id FROM organizations WHERE slug = 'all-solutions-consulting')
WHERE org_id IS NULL;

-- 5c. Insert org_members for Alan (owner) and Claudia (admin)
-- ON CONFLICT DO NOTHING is safe if migration runs twice
-- Note: These INSERTs will silently no-op on local dev (user IDs don't exist locally);
-- seed.sql handles local dev org membership separately.
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

-- 5d. Seed user_profiles for Alan and Claudia
-- Claudia is on the allsolutions.consulting Google Workspace domain
INSERT INTO user_profiles (id, email, name)
VALUES
    ('8a84898d-0266-4dc1-b97c-744d70d7a4ec', 'alan@allsolutions.consulting', 'Alan Hsieh'),
    ('6559957c-2ce6-4cea-aa15-f79fb401a685', 'claudia@allsolutions.consulting', 'Claudia')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 6. CONSTRAIN dsos.org_id NOT NULL (Step 3 of 3: after backfill is complete)
-- ============================================================
-- Safe to do now because all existing rows have been backfilled above.
-- New DSO inserts after Phase 2 will always provide org_id via application code.

ALTER TABLE dsos ALTER COLUMN org_id SET NOT NULL;

-- ============================================================
-- 7. DATA CLEANUP: Remove erroneous Valentina access
-- ============================================================
-- Cleanup: Valentina (d0134916-0f52-4556-9fa0-4c66cff3198e) was erroneously granted
-- access to all 5 DSOs via the invite bug. She should have no DSO access.
-- This is independent of the org migration but cleaned up here while addressing data integrity.

DELETE FROM user_dso_access WHERE user_id = 'd0134916-0f52-4556-9fa0-4c66cff3198e';
