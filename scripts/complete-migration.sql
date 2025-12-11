-- Complete migration script for data tables system
-- Run this in Supabase Dashboard -> SQL Editor
-- https://supabase.com/dashboard/project/vekxzuupejmitvwwokrf/sql/new

-- =============================================
-- 1. Add missing columns to data_tables
-- =============================================
ALTER TABLE data_tables ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE data_tables ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'table';
ALTER TABLE data_tables ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'blue';
ALTER TABLE data_tables ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false;
ALTER TABLE data_tables ADD COLUMN IF NOT EXISTS template_id TEXT;
ALTER TABLE data_tables ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
ALTER TABLE data_tables ADD COLUMN IF NOT EXISTS time_tracking JSONB;

-- =============================================
-- 2. Add missing columns to data_columns
-- =============================================
ALTER TABLE data_columns ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE data_columns ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT false;
ALTER TABLE data_columns ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;
ALTER TABLE data_columns ADD COLUMN IF NOT EXISTS width INTEGER DEFAULT 150;
ALTER TABLE data_columns ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- =============================================
-- 3. Create period_data table
-- =============================================
CREATE TABLE IF NOT EXISTS period_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_id UUID NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
    row_id UUID NOT NULL REFERENCES data_rows(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_label TEXT NOT NULL,
    metrics JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_period_data_table_id ON period_data(table_id);
CREATE INDEX IF NOT EXISTS idx_period_data_row_id ON period_data(row_id);
CREATE INDEX IF NOT EXISTS idx_period_data_table_row ON period_data(table_id, row_id);

-- =============================================
-- 4. Verify tables exist with correct schema
-- =============================================
-- You should see: data_tables, data_columns, data_rows, period_data
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'data%' OR table_name = 'period_data';
