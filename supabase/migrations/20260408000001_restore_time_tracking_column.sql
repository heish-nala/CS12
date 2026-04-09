-- Restore time_tracking column to data_tables (was removed during migration fix)
ALTER TABLE public.data_tables ADD COLUMN IF NOT EXISTS time_tracking jsonb;
