-- Team Invites Table for tracking pending invitations
CREATE TABLE IF NOT EXISTS team_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    dso_id UUID NOT NULL REFERENCES dsos(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'viewer' CHECK (role IN ('admin', 'manager', 'viewer')),
    invited_by TEXT NOT NULL, -- user_id of who sent the invite
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    UNIQUE(email, dso_id, status) -- Only one pending invite per email/dso combo
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON team_invites(email);
CREATE INDEX IF NOT EXISTS idx_team_invites_dso_id ON team_invites(dso_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_status ON team_invites(status);

-- Enable RLS
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see invites for DSOs they have admin access to
CREATE POLICY "Admins can view invites for their DSOs"
    ON team_invites FOR SELECT
    USING (
        dso_id IN (
            SELECT dso_id FROM user_dso_access
            WHERE user_id = auth.uid()::text
            AND role = 'admin'
        )
    );

-- Policy: Admins can create invites for their DSOs
CREATE POLICY "Admins can create invites"
    ON team_invites FOR INSERT
    WITH CHECK (
        dso_id IN (
            SELECT dso_id FROM user_dso_access
            WHERE user_id = auth.uid()::text
            AND role = 'admin'
        )
    );

-- Policy: Admins can update (cancel) invites for their DSOs
CREATE POLICY "Admins can update invites"
    ON team_invites FOR UPDATE
    USING (
        dso_id IN (
            SELECT dso_id FROM user_dso_access
            WHERE user_id = auth.uid()::text
            AND role = 'admin'
        )
    );

-- Function to handle when a user signs up with a pending invite
-- This automatically adds them to the team when they accept
CREATE OR REPLACE FUNCTION handle_invite_acceptance()
RETURNS TRIGGER AS $$
DECLARE
    invite_record RECORD;
BEGIN
    -- Find any pending invites for this email
    FOR invite_record IN
        SELECT * FROM team_invites
        WHERE email = NEW.email
        AND status = 'pending'
        AND expires_at > NOW()
    LOOP
        -- Add the user to the DSO
        INSERT INTO user_dso_access (user_id, dso_id, role)
        VALUES (NEW.id::text, invite_record.dso_id, invite_record.role)
        ON CONFLICT (user_id, dso_id) DO NOTHING;

        -- Mark the invite as accepted
        UPDATE team_invites
        SET status = 'accepted', accepted_at = NOW()
        WHERE id = invite_record.id;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: The trigger on auth.users needs to be created via Supabase dashboard
-- or through a separate migration with superuser privileges.
-- This is because auth.users is in a protected schema.
--
-- In Supabase Dashboard, go to Database > Functions and create:
-- CREATE TRIGGER on_auth_user_created
--     AFTER INSERT ON auth.users
--     FOR EACH ROW
--     EXECUTE FUNCTION handle_invite_acceptance();
