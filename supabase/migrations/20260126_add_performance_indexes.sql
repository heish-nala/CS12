-- Performance optimization: Add missing indexes for common query patterns
-- These indexes target the most frequently used query patterns identified in performance analysis

-- Index for data_rows queries that sort by created_at (used in /api/data-tables/[id])
CREATE INDEX IF NOT EXISTS idx_data_rows_table_created
    ON data_rows(table_id, created_at DESC);

-- Index for data_columns queries that sort by order_index
CREATE INDEX IF NOT EXISTS idx_data_columns_table_order
    ON data_columns(table_id, order_index);

-- Composite index for period_data queries (used in periods/batch endpoint)
-- This is crucial for the batch period fetching which queries by table_id and groups by row_id
CREATE INDEX IF NOT EXISTS idx_period_data_table_row_start
    ON period_data(table_id, row_id, period_start DESC);

-- Index for faster user_dso_access lookups (used in auth checks)
CREATE INDEX IF NOT EXISTS idx_user_dso_access_user_dso
    ON user_dso_access(user_id, dso_id);

-- Index for activities queries by contact_name (used in person detail panel)
CREATE INDEX IF NOT EXISTS idx_activities_contact_name
    ON activities(contact_name);

-- Index for activities queries by created_at for timeline views
CREATE INDEX IF NOT EXISTS idx_activities_created_at
    ON activities(created_at DESC);
