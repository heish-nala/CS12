-- Add fields needed for Smart Report Generator
-- Task 1: Schema changes

-- 1. Add lead_ortho to dsos table
ALTER TABLE dsos ADD COLUMN IF NOT EXISTS lead_ortho TEXT;

-- 2. Add notable_quote to activities table
ALTER TABLE activities ADD COLUMN IF NOT EXISTS notable_quote TEXT;
