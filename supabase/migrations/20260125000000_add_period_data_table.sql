-- Migration: Create period_data table for time-tracking metrics
-- This table stores monthly metrics for data table rows

CREATE TABLE period_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
    row_id UUID NOT NULL REFERENCES data_rows(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_label TEXT NOT NULL,
    metrics JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queries by table and row
CREATE INDEX idx_period_data_table_row ON period_data(table_id, row_id);

-- Trigger for updated_at
CREATE TRIGGER update_period_data_updated_at
    BEFORE UPDATE ON period_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
