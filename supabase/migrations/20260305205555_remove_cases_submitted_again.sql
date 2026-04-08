-- Remove "Cases Submitted" metric that was re-added by 20260304 migration.
-- Only 3 metrics should exist: Diagnosed, Scans, Accepted.

DO $$
DECLARE
    tbl RECORD;
    filtered JSONB;
BEGIN
    FOR tbl IN
        SELECT id, time_tracking
        FROM data_tables
        WHERE time_tracking IS NOT NULL
          AND time_tracking->'metrics' IS NOT NULL
          AND time_tracking->'metrics' @> '[{"name": "Cases Submitted"}]'
    LOOP
        SELECT jsonb_agg(m)
        INTO filtered
        FROM jsonb_array_elements(tbl.time_tracking->'metrics') AS m
        WHERE m->>'name' != 'Cases Submitted';

        UPDATE data_tables
        SET time_tracking = jsonb_set(time_tracking, '{metrics}', COALESCE(filtered, '[]'::jsonb))
        WHERE id = tbl.id;
    END LOOP;

    -- Also remove any period_data entries keyed by metric-cases-submitted
    UPDATE period_data
    SET metrics = metrics - 'metric-cases-submitted'
    WHERE metrics ? 'metric-cases-submitted';
END $$;
