-- Update activity_type check constraint to match new simplified types
-- Old types: 'call', 'email', 'meeting', 'case_review', 'training', 'other'
-- New types: 'phone', 'email', 'text'

-- First, update existing data to map old types to new types
UPDATE activities SET activity_type = 'phone' WHERE activity_type IN ('call', 'meeting');
UPDATE activities SET activity_type = 'text' WHERE activity_type IN ('case_review', 'training', 'other');
-- 'email' stays as 'email'

-- Drop the old constraint
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_activity_type_check;

-- Add the new constraint with simplified types
ALTER TABLE activities ADD CONSTRAINT activities_activity_type_check
    CHECK (activity_type IN ('phone', 'email', 'text'));
