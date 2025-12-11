// Script to create period_data table via Supabase SQL Editor
// Run this SQL in your Supabase Dashboard -> SQL Editor

const sql = `
-- Create period_data table for time-based tracking
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

-- Enable RLS
ALTER TABLE period_data ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
CREATE POLICY "Allow all operations for service role" ON period_data
    FOR ALL
    USING (true)
    WITH CHECK (true);
`;

console.log('='.repeat(60));
console.log('Run this SQL in your Supabase Dashboard -> SQL Editor:');
console.log('='.repeat(60));
console.log(sql);
console.log('='.repeat(60));
