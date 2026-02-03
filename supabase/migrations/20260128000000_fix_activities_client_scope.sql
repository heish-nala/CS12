-- Migration: Fix activities table to support client-scoped activities
-- Problem: Activities were not filtered by client, showing "no activity" even when activities exist

-- 1. Make doctor_id nullable (activities can now be for data table contacts, not just doctors)
ALTER TABLE activities ALTER COLUMN doctor_id DROP NOT NULL;

-- 2. Add client_id column for direct client association
ALTER TABLE activities ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES dsos(id) ON DELETE CASCADE;

-- 3. Backfill client_id from doctor's dso_id for existing activities
UPDATE activities
SET client_id = doctors.dso_id
FROM doctors
WHERE activities.doctor_id = doctors.id
AND activities.client_id IS NULL;

-- 4. Create index for efficient client_id queries
CREATE INDEX IF NOT EXISTS idx_activities_client_id ON activities(client_id);

-- 5. Update RLS policy to support both doctor-based and client-based access
DROP POLICY IF EXISTS "Users can view activities for their DSO doctors" ON activities;
DROP POLICY IF EXISTS "Users can create activities for their DSO doctors" ON activities;

-- New SELECT policy: Users can view activities for their clients
CREATE POLICY "Users can view activities for their clients"
    ON activities FOR SELECT
    USING (
        -- Direct client_id match
        client_id IN (SELECT dso_id FROM user_dso_access WHERE user_id = auth.uid()::text)
        OR
        -- Legacy: via doctor's dso_id
        doctor_id IN (
            SELECT id FROM doctors WHERE dso_id IN (
                SELECT dso_id FROM user_dso_access WHERE user_id = auth.uid()::text
            )
        )
    );

-- New INSERT policy: Users can create activities for their clients
CREATE POLICY "Users can create activities for their clients"
    ON activities FOR INSERT
    WITH CHECK (
        -- Direct client_id match
        client_id IN (
            SELECT dso_id FROM user_dso_access
            WHERE user_id = auth.uid()::text AND role IN ('admin', 'manager')
        )
        OR
        -- Legacy: via doctor's dso_id
        doctor_id IN (
            SELECT id FROM doctors WHERE dso_id IN (
                SELECT dso_id FROM user_dso_access
                WHERE user_id = auth.uid()::text AND role IN ('admin', 'manager')
            )
        )
    );
