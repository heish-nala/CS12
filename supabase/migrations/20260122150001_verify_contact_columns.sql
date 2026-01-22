-- Ensure contact columns exist on activities table
ALTER TABLE activities ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS contact_phone TEXT;
