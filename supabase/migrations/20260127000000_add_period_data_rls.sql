-- Migration: Add RLS policies for period_data table
-- This table was missing RLS which could allow unauthorized access

-- Enable RLS on period_data table
ALTER TABLE period_data ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view period data for tables they have access to
CREATE POLICY "Users can view period_data for accessible tables"
ON period_data FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM data_tables dt
        JOIN user_dso_access uda ON dt.client_id = uda.dso_id
        WHERE dt.id = period_data.table_id
        AND uda.user_id = auth.uid()::text
    )
);

-- RLS Policy: Users with write access can insert period data
CREATE POLICY "Users can insert period_data for accessible tables"
ON period_data FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM data_tables dt
        JOIN user_dso_access uda ON dt.client_id = uda.dso_id
        WHERE dt.id = period_data.table_id
        AND uda.user_id = auth.uid()::text
        AND uda.role IN ('admin', 'manager')
    )
);

-- RLS Policy: Users with write access can update period data
CREATE POLICY "Users can update period_data for accessible tables"
ON period_data FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM data_tables dt
        JOIN user_dso_access uda ON dt.client_id = uda.dso_id
        WHERE dt.id = period_data.table_id
        AND uda.user_id = auth.uid()::text
        AND uda.role IN ('admin', 'manager')
    )
);

-- RLS Policy: Only admins can delete period data
CREATE POLICY "Admins can delete period_data for accessible tables"
ON period_data FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM data_tables dt
        JOIN user_dso_access uda ON dt.client_id = uda.dso_id
        WHERE dt.id = period_data.table_id
        AND uda.user_id = auth.uid()::text
        AND uda.role = 'admin'
    )
);
