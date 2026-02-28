-- ============================================================
-- DEPRECATION: user_dso_access table
-- ============================================================
-- As of Phase 5 (2026-02-27), org_members is the primary access control gate.
-- user_dso_access remains active as the per-DSO assignment filter (ISO-02):
--   - org_members gates the org boundary (who is in the org)
--   - user_dso_access gates per-DSO visibility (which DSOs within the org)
--
-- This table is NOT removed in this migration. It is flagged as deprecated
-- for a future cleanup milestone.
--
-- CLEANUP MIGRATION (future milestone):
-- Step 1: Verify all routes use requireOrgDsoAccess (org check + DSO check)
-- Step 2: Confirm no route relies solely on user_dso_access for auth
-- Step 3: Evaluate whether user_dso_access can be merged into a simpler
--         org_dso_assignments table (same data, clearer name)
-- Step 4: Remove legacy checkDsoAccess / requireDsoAccessWithFallback from lib/auth.ts
-- Step 5: Remove requireDsoAccess from lib/auth.ts
-- Step 6: Rename or restructure user_dso_access if keeping per-DSO assignments
-- Step 7: Update team_invites to use org_invites if team_invites is no longer needed
-- ============================================================

COMMENT ON TABLE user_dso_access IS 'DEPRECATED (Phase 5, 2026-02-27): Per-DSO assignment filter. Primary access control is now org_members. See cleanup steps above.';

COMMENT ON TABLE team_invites IS 'LEGACY (Phase 5, 2026-02-27): DSO-scoped invite system. Superseded by org_invites for org-level invitations. Kept for backward compatibility with existing team routes.';
