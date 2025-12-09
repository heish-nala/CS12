-- Add archived column to dsos table for soft-delete functionality
ALTER TABLE dsos ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_dsos_archived ON dsos(archived);
