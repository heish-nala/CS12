-- Remove "Cases Submitted" from time_tracking.metrics in all Attendee Tracker tables
-- This restores the clinical funnel to 3 stages: Diagnosed, Scans, Accepted
-- Existing period_data values are preserved; the metric just won't show in the UI

DO $$
DECLARE
    tbl RECORD;
    filtered_metrics JSONB;
    col_exists BOOLEAN;
BEGIN
    -- Check if time_tracking column exists on data_tables
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'data_tables' AND column_name = 'time_tracking'
    ) INTO col_exists;

    IF NOT col_exists THEN
        RAISE NOTICE 'time_tracking column does not exist yet, skipping migration';
        RETURN;
    END IF;

    -- Find all data_tables that have time_tracking with metrics containing "Cases Submitted"
    FOR tbl IN
        SELECT id, time_tracking
        FROM data_tables
        WHERE time_tracking IS NOT NULL
          AND time_tracking->'metrics' IS NOT NULL
          AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements(time_tracking->'metrics') AS m
              WHERE m->>'name' = 'Cases Submitted'
          )
    LOOP
        -- Build filtered metrics array without "Cases Submitted"
        SELECT jsonb_agg(m)
        INTO filtered_metrics
        FROM jsonb_array_elements(tbl.time_tracking->'metrics') AS m
        WHERE m->>'name' != 'Cases Submitted';

        -- Update the table's time_tracking.metrics
        UPDATE data_tables
        SET time_tracking = jsonb_set(time_tracking, '{metrics}', COALESCE(filtered_metrics, '[]'::jsonb))
        WHERE id = tbl.id;
    END LOOP;
END $$;
