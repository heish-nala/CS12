-- Add outcome column to activities table
ALTER TABLE activities ADD COLUMN IF NOT EXISTS outcome TEXT;
