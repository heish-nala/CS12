-- Migration: Enable RLS on organizations, org_members, user_profiles
-- Fix: Supabase Security Advisor flagged these 3 tables as missing RLS
-- Note: Our app uses supabaseAdmin (service role) which bypasses RLS,
-- but RLS protects against direct anon-key access to PostgREST.

-- ============================================================
-- 1. ORGANIZATIONS
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Members can view their own org
CREATE POLICY "Members can view their organizations"
    ON organizations FOR SELECT
    TO authenticated
    USING (
        id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
    );

-- Only owners can update their org
CREATE POLICY "Owners can update their organizations"
    ON organizations FOR UPDATE
    TO authenticated
    USING (
        id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role = 'owner')
    )
    WITH CHECK (
        id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role = 'owner')
    );

-- Any authenticated user can create an org (signup flow)
CREATE POLICY "Authenticated users can create organizations"
    ON organizations FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ============================================================
-- 2. ORG_MEMBERS
-- ============================================================

ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

-- Members can view other members in their org
CREATE POLICY "Members can view org members"
    ON org_members FOR SELECT
    TO authenticated
    USING (
        org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
    );

-- Owners and admins can add members
CREATE POLICY "Admins can add org members"
    ON org_members FOR INSERT
    TO authenticated
    WITH CHECK (
        org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
    );

-- Owners and admins can update member roles
CREATE POLICY "Admins can update org members"
    ON org_members FOR UPDATE
    TO authenticated
    USING (
        org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
    )
    WITH CHECK (
        org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
    );

-- Owners and admins can remove members
CREATE POLICY "Admins can delete org members"
    ON org_members FOR DELETE
    TO authenticated
    USING (
        org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
    );

-- ============================================================
-- 3. USER_PROFILES
-- ============================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Members can view profiles of people in their org
CREATE POLICY "Members can view profiles in their org"
    ON user_profiles FOR SELECT
    TO authenticated
    USING (
        id IN (
            SELECT om.user_id FROM org_members om
            WHERE om.org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
        )
    );

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
    ON user_profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Users can insert their own profile (signup flow)
CREATE POLICY "Users can insert their own profile"
    ON user_profiles FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());
