import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vekxzuupejmitvwwokrf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZla3h6dXVwZWptaXR2d3dva3JmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA0Mjc0OSwiZXhwIjoyMDgwNjE4NzQ5fQ.hmQ674mn88jXf9LV2NLDsL3GlgSd_IBP8Cr9HfTHdSQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createPeriodDataTable() {
    console.log('Creating period_data table...');

    // Use raw SQL via pg_catalog or a function
    // Since direct SQL isn't available, let's try to insert and see the error
    const { error } = await supabase
        .from('period_data')
        .select('*')
        .limit(1);

    if (error) {
        console.log('Table does not exist. You need to create it via Supabase Dashboard SQL Editor.');
        console.log('');
        console.log('Go to: https://supabase.com/dashboard/project/vekxzuupejmitvwwokrf/sql/new');
        console.log('');
        console.log('Run this SQL:');
        console.log('');
        console.log(`
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
        `);
    } else {
        console.log('period_data table already exists!');
    }
}

createPeriodDataTable();
