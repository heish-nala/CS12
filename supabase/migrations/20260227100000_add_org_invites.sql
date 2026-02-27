-- ==========================================================
-- 1. Create org_invites table
-- ==========================================================
-- Stores org-level invitations. Separate from team_invites (DSO-level).
-- Roles are org roles (owner/admin/member), not DSO roles (admin/manager/viewer).

CREATE TABLE org_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, email, status)  -- one pending invite per email per org
);

-- ==========================================================
-- 2. Indexes for lookups
-- ==========================================================

CREATE INDEX idx_org_invites_org_id ON org_invites(org_id);
CREATE INDEX idx_org_invites_email ON org_invites(email);
CREATE INDEX idx_org_invites_status ON org_invites(status);
